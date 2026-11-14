'use client';

import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker, setWorkerUrl, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LatLng } from '@/lib/geo';
import { INTERP_MS, lerpLatLng, opacityForAge } from '@/lib/interpolate';
import type { Treasure } from '@/lib/useTreasures';

export type OtherPlayer = { id: string; nickname: string; color: string; lat: number; lng: number; seenAt: number };

type OtherEntry = {
  marker: Marker;
  el: HTMLDivElement;
  from: LatLng;
  to: LatLng;
  startedAt: number;
  seenAt: number;
};

// MapTiler streets style when the key is set; otherwise a blank style so the map still renders offline.
// Public OSM tile servers are not used (spec C5).
const BLANK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e9e7e1' } }],
};

function styleFor(): string | StyleSpecification {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  return key ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}` : BLANK_STYLE;
}

type Props = {
  treasures: Treasure[];
  me: LatLng | null;
  others: OtherPlayer[];
  onSelectTreasure?: (t: Treasure) => void;
};

export default function MapView({ treasures, me, others, onSelectTreasure }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const meMarker = useRef<Marker | null>(null);
  const pins = useRef<Marker[]>([]);
  const centered = useRef(false);
  const otherMarkers = useRef(new Map<string, OtherEntry>());

  useEffect(() => {
    if (!container.current) return;
    // Turbopack cannot resolve MapLibre's worker chunk; serve it from /public (copied by postinstall).
    // Absolute URL: a relative one is re-resolved against the chunk path and 404s.
    setWorkerUrl(new URL('/maplibre-gl-worker.mjs', window.location.origin).href);
    const map = new MapLibreMap({
      container: container.current,
      style: styleFor(),
      center: [24.0315, 49.8419],
      zoom: 15,
      attributionControl: { compact: true },
    });
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
      el.onclick = () => onSelectTreasure?.(t);
      return new Marker({ element: el }).setLngLat([t.lng, t.lat]).addTo(map);
    });
  }, [treasures, onSelectTreasure]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !me) return;
    if (!meMarker.current) {
      const el = document.createElement('div');
      el.className = 'h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow';
      el.setAttribute('aria-label', 'Ви');
      meMarker.current = new Marker({ element: el }).setLngLat([me.lng, me.lat]).addTo(map);
    } else {
      meMarker.current.setLngLat([me.lng, me.lat]);
    }
    if (!centered.current) {
      map.jumpTo({ center: [me.lng, me.lat] });
      centered.current = true;
    }
  }, [me]);

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
        el.className = 'h-4 w-4 rounded-full border-2 border-white shadow';
        el.style.backgroundColor = o.color;
        el.setAttribute('aria-label', o.nickname);
        const marker = new Marker({ element: el }).setLngLat([to.lng, to.lat]).addTo(map);
        otherMarkers.current.set(o.id, { marker, el, from: to, to, startedAt: now, seenAt: o.seenAt });
      } else {
        const t = Math.min(1, (now - entry.startedAt) / INTERP_MS);
        entry.from = lerpLatLng(entry.from, entry.to, t); // start from where the marker is now
        entry.to = to;
        entry.startedAt = now;
        entry.seenAt = o.seenAt;
        entry.el.style.backgroundColor = o.color;
        entry.el.setAttribute('aria-label', o.nickname);
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
