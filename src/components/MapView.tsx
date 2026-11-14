'use client';

import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LatLng } from '@/lib/geo';
import { avatarEmoji } from '@/lib/avatars';
import { configureMapLibre, mapStyle, osmStyle } from '@/lib/mapSetup';
import { INTERP_MS, lerpLatLng, opacityForAge } from '@/lib/interpolate';
import { formatDistance } from '@/lib/geoFormat';
import type { Treasure } from '@/lib/useTreasures';

export type OtherPlayer = { id: string; nickname: string; avatar: string; lat: number; lng: number; seenAt: number };

type Props = {
  treasures: Treasure[]; // only unfound treasures are passed in
  distances: Record<string, number>; // metres from me, by treasure id
  me: LatLng | null;
  meAvatar: string | null;
  others: OtherPlayer[];
  onSelectTreasure?: (t: Treasure) => void;
};

// A player marker is their animal emoji, with the nickname as the accessible label.
function applyAvatar(el: HTMLElement, avatar: string | null, label: string) {
  el.className = 'grid h-8 w-8 place-items-center text-2xl drop-shadow';
  el.textContent = avatar ? avatarEmoji(avatar) : '📍';
  el.setAttribute('aria-label', label);
}

type OtherEntry = {
  marker: Marker;
  el: HTMLDivElement;
  from: LatLng;
  to: LatLng;
  startedAt: number;
  seenAt: number;
};

type PinEntry = { marker: Marker; el: HTMLButtonElement; label: HTMLSpanElement; treasure: Treasure };

export default function MapView({ treasures, distances, me, meAvatar, others, onSelectTreasure }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const meMarker = useRef<Marker | null>(null);
  const centered = useRef(false);
  const otherMarkers = useRef(new Map<string, OtherEntry>());
  const pinMap = useRef(new Map<string, PinEntry>());
  // Read through refs so a new callback identity does not rebuild pins (review finding F1).
  const selectRef = useRef(onSelectTreasure);
  useEffect(() => {
    selectRef.current = onSelectTreasure;
  }, [onSelectTreasure]);

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
    // Reserve provider: if the primary style cannot load (bad key, quota, network), switch to OpenStreetMap once.
    let fellBack = false;
    const primaryIsMapTiler = Boolean(process.env.NEXT_PUBLIC_MAPTILER_KEY);
    map.on('error', (e: { error?: { status?: number; message?: string } }) => {
      const status = e.error?.status;
      const styleFailure = status === 401 || status === 403 || status === 429 || /style/i.test(e.error?.message ?? '');
      if (!fellBack && primaryIsMapTiler && styleFailure) {
        fellBack = true;
        map.setStyle(osmStyle());
      }
    });
    mapRef.current = map;
    const pins = pinMap.current;
    const others = otherMarkers.current;
    return () => {
      map.remove();
      mapRef.current = null;
      meMarker.current = null;
      pins.clear();
      others.clear();
      centered.current = false;
    };
  }, []);

  // Pins: keyed by treasure id. Adding or removing a treasure touches only that pin.
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
      const el = document.createElement('button');
      el.type = 'button';
      el.setAttribute('aria-label', t.title);
      el.className = 'flex flex-col items-center text-3xl drop-shadow';
      const mushroom = document.createElement('span');
      mushroom.textContent = '🍄';
      const label = document.createElement('span');
      label.className = 'rounded-full bg-white/90 px-2 text-xs font-semibold tabular-nums shadow';
      el.append(mushroom, label);
      const entry: PinEntry = {
        marker: new Marker({ element: el }).setLngLat([t.lng, t.lat]).addTo(map),
        el,
        label,
        treasure: t,
      };
      el.onclick = () => selectRef.current?.(entry.treasure);
      pinMap.current.set(t.id, entry);
    }
  }, [treasures]);

  // Distance labels update without rebuilding any pin.
  useEffect(() => {
    for (const [id, entry] of pinMap.current) {
      const d = distances[id];
      entry.label.textContent = d === undefined ? '' : formatDistance(d);
    }
  }, [distances, treasures]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !me) return;
    if (!meMarker.current) {
      const el = document.createElement('div');
      el.setAttribute('aria-label', 'Ви');
      meMarker.current = new Marker({ element: el }).setLngLat([me.lng, me.lat]).addTo(map);
    }
    applyAvatar(meMarker.current.getElement(), meAvatar, 'Ви');
    meMarker.current.setLngLat([me.lng, me.lat]);
    if (!centered.current) {
      map.jumpTo({ center: [me.lng, me.lat] });
      centered.current = true;
    }
  }, [me, meAvatar]);

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
        applyAvatar(el, o.avatar, o.nickname);
        const marker = new Marker({ element: el }).setLngLat([to.lng, to.lat]).addTo(map);
        otherMarkers.current.set(o.id, { marker, el, from: to, to, startedAt: now, seenAt: o.seenAt });
      } else {
        const t = Math.min(1, (now - entry.startedAt) / INTERP_MS);
        entry.from = lerpLatLng(entry.from, entry.to, t); // start from where the marker is now
        entry.to = to;
        entry.startedAt = now;
        entry.seenAt = o.seenAt;
        applyAvatar(entry.el, o.avatar, o.nickname);
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

  // MapLibre's stylesheet makes its own container position:relative, which would override "absolute inset-0"
  // and collapse the map to 0 px. A wrapper keeps the sizing; the map fills it.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
    </div>
  );
}
