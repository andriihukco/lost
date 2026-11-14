'use client';

import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LatLng } from '@/lib/geo';
import { avatarEmoji } from '@/lib/avatars';
import { configureMapLibre, mapStyle } from '@/lib/mapSetup';
import { INTERP_MS, lerpLatLng, opacityForAge } from '@/lib/interpolate';
import type { Treasure } from '@/lib/useTreasures';

export type OtherPlayer = { id: string; nickname: string; avatar: string; lat: number; lng: number; seenAt: number };

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

type Props = {
  treasures: Treasure[];
  me: LatLng | null;
  meAvatar: string | null;
  others: OtherPlayer[];
  onSelectTreasure?: (t: Treasure) => void;
};

export default function MapView({ treasures, me, meAvatar, others, onSelectTreasure }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const meMarker = useRef<Marker | null>(null);
  const pins = useRef<Marker[]>([]);
  const centered = useRef(false);
  // Read through a ref so a new callback identity does not rebuild every pin (review finding F1).
  const selectRef = useRef(onSelectTreasure);
  useEffect(() => {
    selectRef.current = onSelectTreasure;
  }, [onSelectTreasure]);
  const otherMarkers = useRef(new Map<string, OtherEntry>());

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
      // A map that cannot start (no WebGL, worker failure) must not blank the whole screen.
      console.error('MapLibre failed to start', err);
      return;
    }
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      meMarker.current = null;
      pins.current = [];
      centered.current = false;
      otherMarkers.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pins.current.forEach((m) => m.remove());
    pins.current = treasures.map((t) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.setAttribute('aria-label', t.title);
      el.className = `h-5 w-5 rounded-full border-2 border-white shadow ${
        t.is_found ? 'bg-neutral-400' : 'bg-orange-500'
      }`;
      el.onclick = () => selectRef.current?.(t);
      return new Marker({ element: el }).setLngLat([t.lng, t.lat]).addTo(map);
    });
  }, [treasures]);

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

  return <div ref={container} className="absolute inset-0" />;
}
