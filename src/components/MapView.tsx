'use client';

import { type CSSProperties, useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LatLng } from '@/lib/geo';
import { avatarEmoji } from '@/lib/avatars';
import { configureMapLibre, reserveStyle } from '@/lib/mapSetup';
import { isBusinessLayer, type MapKind, styleFor } from '@/lib/mapStyle';
import { INTERP_MS, lerpLatLng, opacityForAge } from '@/lib/interpolate';
import { formatDistance } from '@/lib/geoFormat';
import { edgePoint, type Box } from '@/lib/offscreen';
import { pinOrDefault } from '@/lib/pinEmoji';
import { MAP_PAD_M, viewBounds } from '@/lib/mapBounds';
import type { Treasure } from '@/lib/useTreasures';
import type { MapMark } from '@/lib/mapMarks';
import type { GeoJSONSource } from 'maplibre-gl';

export type RouteStop = { id: string; lat: number; lng: number; index: number };
export type RouteView = { coords: LatLng[]; stops: RouteStop[] };

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
  route?: RouteView | null;
  focusId?: string | null;
  focusNonce?: number;
  recenterNonce?: number; // changes when the player asks to see their own location
  unlimited?: boolean; // admin view: no movement limit around me and the treasures
  mapKind?: MapKind; // outdoor, satellite or hybrid; switching keeps pins and the route
  marks?: MapMark[]; // admin warnings and notes: emoji pins only (no distance, not treasures)
  onViewChange?: (v: { lat: number; lng: number; zoom: number }) => void; // the centre and zoom, for the map-type previews
  onSelectMark?: (m: MapMark) => void;
  fitTo?: LatLng[]; // when this array changes, the camera fits these points once (admin: everyone on the map)
};

// Room kept clear at the top for the status card and chips.
const TOP_INSET = 72;
const SIDE_INSET = 16;

const CONE_SVG = `<svg viewBox="0 0 160 160" width="160" height="160" aria-hidden="true">
  <defs>
    <radialGradient id="dl-cone-grad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#4285F4" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#4285F4" stop-opacity="0.04"/>
    </radialGradient>
  </defs>
  <path d="M80 80 L36 14 Q80 -4 124 14 Z" fill="url(#dl-cone-grad)"/>
</svg>`;

// Player: emoji in a circle, a tip that points where the player faces, and the name below.
function renderPlayer(el: HTMLElement, p: { avatar: string | null; name: string; heading: number | null; me: boolean }) {
  el.replaceChildren();
  // Add classes, never overwrite: MapLibre keeps its own 'maplibregl-marker' class on this element.
  el.classList.add('dl-player');
  el.classList.toggle('dl-player-me', p.me);
  el.setAttribute('aria-label', p.name);
  const root = document.createElement('div');
  root.className = 'dl-player-root';
  if (p.heading !== null && p.me) {
    // My own view cone: a soft blue sector, as in Google Maps, turned by the compass.
    const cone = document.createElement('div');
    cone.className = 'dl-cone';
    cone.style.transform = `rotate(${p.heading}deg)`;
    cone.innerHTML = CONE_SVG;
    root.append(cone);
  } else if (p.heading !== null) {
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
function buildPin(emoji: string): { el: HTMLButtonElement; label: HTMLSpanElement; badge: HTMLSpanElement } {
  const el = document.createElement('button');
  el.type = 'button';
  el.classList.add('dl-pin');
  const root = document.createElement('div');
  root.style.cssText = 'position:relative;width:44px;height:44px';
  const badge = document.createElement('span');
  badge.className = 'dl-pin-badge';
  badge.textContent = pinOrDefault(emoji);
  const label = document.createElement('span');
  label.className = 'dl-tag';
  label.style.cssText = 'position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:4px';
  root.append(badge, label);
  el.append(root);
  return { el, label, badge };
}

type OtherEntry = { marker: Marker; el: HTMLDivElement; from: LatLng; to: LatLng; startedAt: number; seenAt: number };
type PinEntry = { marker: Marker; el: HTMLButtonElement; label: HTMLSpanElement; badge: HTMLSpanElement; treasure: Treasure };

export default function MapView({ treasures, distances, me, meAvatar, meName, meHeading, others, onSelectTreasure, bottomInset = 96, route = null, focusId = null, focusNonce = 0, recenterNonce = 0, unlimited = false, fitTo, mapKind = 'outdoor', marks = [], onSelectMark, onViewChange }: Props) {
  const viewRef = useRef(onViewChange);
  useEffect(() => {
    viewRef.current = onViewChange;
  }, [onViewChange]);
  const kindRef = useRef<MapKind>(mapKind); // the kind the map is currently showing
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
  const routeRef = useRef<RouteView | null>(route);
  const meRef = useRef<LatLng | null>(me);
  useEffect(() => {
    meRef.current = me;
  }, [me]);
  const applyRouteRef = useRef<() => void>(() => {});
  const stopEls = useRef(new Map<string, Marker>());
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
        style: styleFor(kindRef.current, process.env.NEXT_PUBLIC_MAPTILER_KEY),
        center: [24.0315, 49.8419],
        zoom: 15,
        attributionControl: false, // attributions are logged to the console instead of shown on the map
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
    // The map's data credits, for the console (the on-map attribution control is off).
    map.on('style.load', () => {
      const credits = Object.values(map.getStyle()?.sources ?? {})
        .map((src) => (src as { attribution?: string }).attribution)
        .filter((a): a is string => Boolean(a));
      if (credits.length) console.info('Map attribution:', [...new Set(credits)]);
    });
    map.on('style.load', () => applyRouteRef.current()); // a new style drops our route layers
    // Off-screen treasures are re-placed while the map moves.
    map.on('move', () => updateRef.current());
    map.on('resize', () => updateRef.current());
    const emitView = () => {
      const c = map.getCenter();
      viewRef.current?.({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    };
    map.on('moveend', emitView);
    map.on('load', emitView);
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



  // The view is limited to me and the open treasures, plus MAP_PAD_M on each side: the camera cannot pan or zoom past it.
  const meLat = me?.lat ?? null;
  const meLng = me?.lng ?? null;
  // The last limit applied. A limit is set only when it really changes: a fresh one on every GPS tick made the
  // camera re-adjust over and over (the slow zoom-out while a route was shown).
  const appliedBounds = useRef<string>('');
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (unlimited) {
      if (appliedBounds.current !== 'none') {
        map.setMaxBounds(null);
        appliedBounds.current = 'none';
      }
      return;
    }
    const pts: LatLng[] = treasures.map((t) => ({ lat: t.lat, lng: t.lng }));
    if (meLat !== null && meLng !== null) pts.push({ lat: meLat, lng: meLng });
    // The route is inside the limit too, so the camera never has to pull it back.
    for (const c of route?.coords ?? []) pts.push(c);
    const b = viewBounds(pts, MAP_PAD_M);
    const key = b ? `${b.west.toFixed(6)},${b.south.toFixed(6)},${b.east.toFixed(6)},${b.north.toFixed(6)}` : 'none';
    if (key === appliedBounds.current) return;
    appliedBounds.current = key;
    map.setMaxBounds(b ? [[b.west, b.south], [b.east, b.north]] : null);
  }, [meLat, meLng, treasures, unlimited, route]);

  // Map marks: emoji pins for admin warnings. Not treasures: no distance, no edge arrow, not in any list.
  const markEntries = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>());
  const markSelectRef = useRef(onSelectMark);
  useEffect(() => {
    markSelectRef.current = onSelectMark;
  }, [onSelectMark]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const wanted = new Set(marks.map((m) => m.id));
    for (const [id, entry] of markEntries.current) {
      if (!wanted.has(id)) {
        entry.marker.remove();
        markEntries.current.delete(id);
      }
    }
    for (const m of marks) {
      if (markEntries.current.has(m.id)) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'dl-mark';
      el.textContent = m.emoji;
      el.setAttribute('aria-label', m.title);
      el.onclick = () => markSelectRef.current?.(m);
      const marker = new Marker({ element: el, anchor: 'center' }).setLngLat([m.lng, m.lat]).addTo(map);
      markEntries.current.set(m.id, { marker, el });
    }
  }, [marks]);

  // Switch the map kind: a new style keeps the pins (DOM markers) and the route is re-applied on style.load.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || kindRef.current === mapKind) return;
    kindRef.current = mapKind;
    map.setStyle(styleFor(mapKind, process.env.NEXT_PUBLIC_MAPTILER_KEY), { diff: false });
  }, [mapKind]);

  // Admin: fit the camera to the given points when they are first supplied.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitTo || fitTo.length === 0) return;
    const b = viewBounds(fitTo, 200);
    if (b) map.fitBounds([[b.west, b.south], [b.east, b.north]], { padding: 40, duration: 0 });
  }, [fitTo]);

  // Walking route: a line along the path and numbered stops. Re-applied after every style load.
  useEffect(() => {
    routeRef.current = route;
    applyRouteRef.current();
    const map = mapRef.current;
    if (!map) return;
    for (const m of stopEls.current.values()) m.remove();
    stopEls.current.clear();
    if (!route) return;
    for (const st of route.stops) {
      const el = document.createElement('div');
      el.className = 'dl-stop';
      el.textContent = String(st.index);
      el.setAttribute('aria-label', `Точка ${st.index}`);
      stopEls.current.set(st.id, new Marker({ element: el, anchor: 'center' }).setLngLat([st.lng, st.lat]).addTo(map));
    }
    if (route.coords.length > 1) {
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      for (const c of route.coords) {
        minLng = Math.min(minLng, c.lng); maxLng = Math.max(maxLng, c.lng);
        minLat = Math.min(minLat, c.lat); maxLat = Math.max(maxLat, c.lat);
      }
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
        padding: { top: TOP_INSET + 24, bottom: insetRef.current + 24, left: 40, right: 40 },
        duration: 600,
      });
    }
  }, [route]);

  applyRouteRef.current = () => {
    const map = mapRef.current;
    if (!map || !map.getStyle()) return;
    const r = routeRef.current;
    const data = {
      type: 'FeatureCollection' as const,
      features: r && r.coords.length > 1
        ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: r.coords.map((c) => [c.lng, c.lat]) } }]
        : [],
    };
    const src = map.getSource('route') as GeoJSONSource | undefined;
    if (src) {
      src.setData(data);
    } else {
      map.addSource('route', { type: 'geojson', data });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#1cb0f6', 'line-width': 6, 'line-opacity': 0.95 },
      });
    }
  };

  // Tapping a treasure centres it in the area above the sheet, which opens at half height and covers the lower half.
  function centerOn(m: MapLibreMap, t: Treasure) {
    // The sheet opens at half height: its top sits at about (height - tab bar) / 2. The pin should sit in the middle of
    // the band between TOP_INSET and that top. A positive offset moves the pin down, so the shift is negated.
    const h = m.getContainer().clientHeight;
    const sheetTop = (h - insetRef.current) / 2;
    const visibleMid = (TOP_INSET + sheetTop) / 2;
    const up = h / 2 - visibleMid;
    m.easeTo({
      center: [t.lng, t.lat],
      zoom: Math.max(m.getZoom(), 16),
      duration: 500,
      offset: [0, -up],
    });
  }

  // "Show my location": centre on me at a street-level zoom.
  useEffect(() => {
    const map = mapRef.current;
    const here = meRef.current;
    if (!map || !here || recenterNonce === 0) return;
    map.easeTo({ center: [here.lng, here.lat], zoom: Math.max(map.getZoom(), 16), duration: 500 });
  }, [recenterNonce]);

  // Show a treasure from the Знахідки tab: fly the map to it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusId) return;
    const pin = pinMap.current.get(focusId);
    if (!pin) return;
    const { lng, lat } = pin.treasure;
    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 16), duration: 700, padding: { top: TOP_INSET, bottom: insetRef.current, left: 0, right: 0 } });
  }, [focusNonce, focusId]);

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
      const badgeEl = el.querySelector<HTMLElement>('.dl-edge-badge');
      if (badgeEl) badgeEl.textContent = pinOrDefault(t.pin_emoji);
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
      const m = mapRef.current;
      if (t && m) centerOn(m, t);
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
        existing.badge.textContent = pinOrDefault(t.pin_emoji);
        existing.marker.setLngLat([t.lng, t.lat]);
        continue;
      }
      const { el, label, badge } = buildPin(t.pin_emoji);
      el.setAttribute('aria-label', t.title);
      const entry: PinEntry = {
        marker: new Marker({ element: el, anchor: 'center' }).setLngLat([t.lng, t.lat]).addTo(map),
        el,
        label,
        badge,
        treasure: t,
      };
      el.onclick = () => {
        const m = mapRef.current;
        if (m) centerOn(m, entry.treasure);
        selectRef.current?.(entry.treasure);
      };
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
  // --map-bottom lifts the map's bottom controls (attribution) above the tab bar.
  return (
    <div className="lost-map absolute inset-0" style={{ '--map-bottom': `${bottomInset}px` } as CSSProperties}>
      <div ref={container} className="h-full w-full" />
      <div ref={overlay} className="pointer-events-none absolute inset-0 overflow-hidden" />
    </div>
  );
}
