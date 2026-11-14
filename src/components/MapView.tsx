'use client';

import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LatLng } from '@/lib/geo';
import { avatarEmoji } from '@/lib/avatars';
import { configureMapLibre, mapStyle, reserveStyle } from '@/lib/mapSetup';
import { isBusinessLayer } from '@/lib/mapStyle';
import { INTERP_MS, lerpLatLng, opacityForAge } from '@/lib/interpolate';
import { formatDistance } from '@/lib/geoFormat';
import { edgePoint, type Box } from '@/lib/offscreen';
import type { Treasure } from '@/lib/useTreasures';

export type OtherPlayer = {
  id: string;
  nickname: string;
  avatar: string;
  lat: number;
  lng: number;
  heading: number | null;
  seenAt: number;
};

type Props = {
  treasures: Treasure[]; // only unfound treasures are passed in
  distances: Record<string, number>; // metres from me, by treasure id
  me: LatLng | null;
  meAvatar: string | null;
  meName: string | null;
  meHeading: number | null;
  others: OtherPlayer[];
  onSelectTreasure?: (t: Treasure) => void;
  bottomInset?: number; // px covered by the tab bar and the nearby notice
};

// Room kept clear at the top for the status card and chips.
const TOP_INSET = 170;
const SIDE_INSET = 16;

// Player: emoji in a circle, a tip that points where the player faces, and the name below.
function renderPlayer(el: HTMLElement, p: { avatar: string | null; name: string; heading: number | null; me: boolean }) {
  el.replaceChildren();
  // Add classes, never overwrite: MapLibre keeps its own 'maplibregl-marker' class on this element.
  el.classList.add('dl-player');
  el.classList.toggle('dl-player-me', p.me);
  el.setAttribute('aria-label', p.name);
  const root = document.createElement('div');
  root.className = 'dl-player-root';
  if (p.heading !== null) {
    const heading = document.createElement('div');
    heading.className = 'dl-heading';
    heading.style.transform = `rotate(${p.heading}deg)`;
    const tip = document.createElement('div');
    tip.className = 'dl-heading-tip';
    heading.append(tip);
    root.append(heading);
  }
  const avatar = document.createElement('div');
  avatar.className = 'dl-player-avatar';
  avatar.textContent = p.avatar ? avatarEmoji(p.avatar) : '📍';
  const name = document.createElement('span');
  name.className = 'dl-tag dl-player-name';
  name.textContent = p.me ? 'Ви' : p.name;
  root.append(avatar, name);
  el.append(root);
}

// Pin: a circle centred on the treasure's coordinate, with its distance under it.
function buildPin(): { el: HTMLButtonElement; label: HTMLSpanElement } {
  const el = document.createElement('button');
  el.type = 'button';
  el.classList.add('dl-pin');
  const root = document.createElement('div');
  root.style.cssText = 'position:relative;width:44px;height:44px';
  const badge = document.createElement('span');
  badge.className = 'dl-pin-badge';
  badge.textContent = '🍄';
  const label = document.createElement('span');
  label.className = 'dl-tag';
  label.style.cssText = 'position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:4px';
  root.append(badge, label);
  el.append(root);
  return { el, label };
}

type OtherEntry = { marker: Marker; el: HTMLDivElement; from: LatLng; to: LatLng; startedAt: number; seenAt: number };
type PinEntry = { marker: Marker; el: HTMLButtonElement; label: HTMLSpanElement; treasure: Treasure };

export default function MapView({ treasures, distances, me, meAvatar, meName, meHeading, others, onSelectTreasure, bottomInset = 96 }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const meMarker = useRef<Marker | null>(null);
  const meEl = useRef<HTMLDivElement | null>(null);
  const centered = useRef(false);
  const otherMarkers = useRef(new Map<string, OtherEntry>());
  const pinMap = useRef(new Map<string, PinEntry>());
  const overlay = useRef<HTMLDivElement | null>(null);
  const edgeEls = useRef(new Map<string, HTMLButtonElement>());
  const treasuresRef = useRef(treasures);
  const distancesRef = useRef(distances);
  const insetRef = useRef(bottomInset);
  const updateRef = useRef<() => void>(() => {});
  const selectRef = useRef(onSelectTreasure); // read through a ref: a new callback must not rebuild pins
  useEffect(() => {
    selectRef.current = onSelectTreasure;
  }, [onSelectTreasure]);
  useEffect(() => {
    treasuresRef.current = treasures;
    distancesRef.current = distances;
    insetRef.current = bottomInset;
    updateRef.current();
  }, [treasures, distances, bottomInset]);

  useEffect(() => {
    if (!container.current) return;
    configureMapLibre();
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: container.current,
        style: mapStyle(),
        center: [24.0315, 49.8419],
        zoom: 15,
        attributionControl: { compact: true },
      });
    } catch (err) {
      console.error('MapLibre failed to start', err);
      return;
    }
    // Reserve provider: if the primary style cannot load, switch to OpenStreetMap once.
    let fellBack = false;
    const primaryIsMapTiler = Boolean(process.env.NEXT_PUBLIC_MAPTILER_KEY);
    map.on('error', (e: { error?: { status?: number; message?: string } }) => {
      const status = e.error?.status;
      const styleFailure = status === 401 || status === 403 || status === 429 || /style/i.test(e.error?.message ?? '');
      if (!fellBack && primaryIsMapTiler && styleFailure) {
        fellBack = true;
        map.setStyle(reserveStyle());
      }
    });
    // Hide businesses and places as soon as a style is ready (primary or reserve).
    const hideBusinesses = () => {
      for (const layer of map.getStyle()?.layers ?? []) {
        const sourceLayer = (layer as { 'source-layer'?: string })['source-layer'];
        if (isBusinessLayer(layer.id, sourceLayer)) map.setLayoutProperty(layer.id, 'visibility', 'none');
      }
    };
    map.on('style.load', hideBusinesses);
    // Off-screen treasures are re-placed while the map moves.
    map.on('move', () => updateRef.current());
    map.on('resize', () => updateRef.current());
    mapRef.current = map;
    const pins = pinMap.current;
    const others = otherMarkers.current;
    return () => {
      map.remove();
      mapRef.current = null;
      meMarker.current = null;
      meEl.current = null;
      pins.clear();
      others.clear();
      centered.current = false;
    };
  }, []);


  // Off-screen treasures: a marker on the screen edge, turned toward the treasure, with its distance.
  // Visible treasures are not drawn here; their pins are on the map.
  const updateEdges = () => {
    const map = mapRef.current;
    const layer = overlay.current;
    if (!map || !layer) return;
    const { clientWidth: w, clientHeight: h } = map.getContainer();
    const box: Box = {
      minX: SIDE_INSET,
      minY: TOP_INSET,
      maxX: w - SIDE_INSET,
      maxY: h - insetRef.current - SIDE_INSET,
    };
    const origin = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
    const seen = new Set<string>();
    for (const t of treasuresRef.current) {
      const p = map.project([t.lng, t.lat]);
      const edge = edgePoint({ x: p.x, y: p.y }, origin, box);
      if (!edge) continue;
      seen.add(t.id);
      let el = edgeEls.current.get(t.id);
      if (!el) {
        el = buildEdge(t.id);
        layer.append(el);
        edgeEls.current.set(t.id, el);
      }
      el.style.transform = `translate(${edge.x}px, ${edge.y}px) translate(-50%, -50%)`;
      const dir = el.querySelector<HTMLElement>('.dl-heading');
      if (dir) dir.style.transform = `rotate(${edge.angle + 90}deg)`;
      const label = el.querySelector<HTMLElement>('[data-label]');
      const d = distancesRef.current[t.id];
      if (label) label.textContent = d === undefined ? '' : formatDistance(d);
    }
    for (const [id, el] of edgeEls.current) {
      if (!seen.has(id)) {
        el.remove();
        edgeEls.current.delete(id);
      }
    }
  };
  updateRef.current = updateEdges;

  function buildEdge(id: string): HTMLButtonElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'dl-edge';
    el.setAttribute('aria-label', 'Скарб поза екраном');
    el.onclick = () => {
      const t = treasuresRef.current.find((x) => x.id === id);
      if (t) selectRef.current?.(t);
    };
    const core = document.createElement('span');
    core.className = 'dl-edge-core';
    const wrap = document.createElement('span');
    wrap.className = 'dl-edge-wrap';
    const dir = document.createElement('span');
    dir.className = 'dl-heading';
    const tip = document.createElement('span');
    tip.className = 'dl-heading-tip';
    dir.append(tip);
    const badge = document.createElement('span');
    badge.className = 'dl-edge-badge';
    badge.textContent = '🍄';
    wrap.append(dir, badge);
    const label = document.createElement('span');
    label.className = 'dl-tag';
    label.setAttribute('data-label', '');
    core.append(wrap, label);
    el.append(core);
    return el;
  }

  // Pins are keyed by treasure id: adding or removing one touches only that pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const wanted = new Set(treasures.map((t) => t.id));
    for (const [id, entry] of pinMap.current) {
      if (!wanted.has(id)) {
        entry.marker.remove();
        pinMap.current.delete(id);
      }
    }
    for (const t of treasures) {
      const existing = pinMap.current.get(t.id);
      if (existing) {
        existing.treasure = t;
        existing.marker.setLngLat([t.lng, t.lat]);
        continue;
      }
      const { el, label } = buildPin();
      el.setAttribute('aria-label', t.title);
      const entry: PinEntry = {
        marker: new Marker({ element: el, anchor: 'center' }).setLngLat([t.lng, t.lat]).addTo(map),
        el,
        label,
        treasure: t,
      };
      el.onclick = () => selectRef.current?.(entry.treasure);
      pinMap.current.set(t.id, entry);
    }
  }, [treasures]);

  useEffect(() => {
    for (const [id, entry] of pinMap.current) {
      const d = distances[id];
      entry.label.textContent = d === undefined ? '' : formatDistance(d);
      entry.label.style.display = d === undefined ? 'none' : ''; // no empty pill while GPS is unknown
    }
  }, [distances, treasures]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !me) return;
    if (!meMarker.current) {
      const el = document.createElement('div');
      meEl.current = el;
      meMarker.current = new Marker({ element: el, anchor: 'center' }).setLngLat([me.lng, me.lat]).addTo(map);
    }
    if (meEl.current) renderPlayer(meEl.current, { avatar: meAvatar, name: meName ?? 'Ви', heading: meHeading, me: true });
    meMarker.current.setLngLat([me.lng, me.lat]);
    if (!centered.current) {
      map.jumpTo({ center: [me.lng, me.lat] });
      centered.current = true;
    }
  }, [me, meAvatar, meName, meHeading]);

  // Other players: sync markers to the latest positions; the loop below glides them.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const now = performance.now();
    const ids = new Set<string>();
    for (const o of others) {
      ids.add(o.id);
      const to = { lat: o.lat, lng: o.lng };
      const entry = otherMarkers.current.get(o.id);
      if (!entry) {
        const el = document.createElement('div');
        renderPlayer(el, { avatar: o.avatar, name: o.nickname, heading: o.heading, me: false });
        const marker = new Marker({ element: el, anchor: 'center' }).setLngLat([to.lng, to.lat]).addTo(map);
        otherMarkers.current.set(o.id, { marker, el, from: to, to, startedAt: now, seenAt: o.seenAt });
      } else {
        const t = Math.min(1, (now - entry.startedAt) / INTERP_MS);
        entry.from = lerpLatLng(entry.from, entry.to, t); // start from where the marker is now
        entry.to = to;
        entry.startedAt = now;
        entry.seenAt = o.seenAt;
        renderPlayer(entry.el, { avatar: o.avatar, name: o.nickname, heading: o.heading, me: false });
      }
    }
    for (const [id, entry] of otherMarkers.current) {
      if (!ids.has(id)) {
        entry.marker.remove();
        otherMarkers.current.delete(id);
      }
    }
  }, [others]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      for (const entry of otherMarkers.current.values()) {
        const t = reduce ? 1 : Math.min(1, (now - entry.startedAt) / INTERP_MS);
        const p = lerpLatLng(entry.from, entry.to, t);
        entry.marker.setLngLat([p.lng, p.lat]);
        entry.el.style.opacity = String(opacityForAge(Date.now() - entry.seenAt));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // MapLibre's stylesheet makes its container position:relative, which would override "absolute inset-0".
  // A wrapper keeps the sizing; the map fills it.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
      <div ref={overlay} className="pointer-events-none absolute inset-0 overflow-hidden" />
    </div>
  );
}
