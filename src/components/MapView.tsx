'use client';

import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker, setWorkerUrl, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LatLng } from '@/lib/geo';
import type { Treasure } from '@/lib/useTreasures';

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
  onSelectTreasure?: (t: Treasure) => void;
};

export default function MapView({ treasures, me, onSelectTreasure }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const meMarker = useRef<Marker | null>(null);
  const pins = useRef<Marker[]>([]);
  const centered = useRef(false);

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

  return <div ref={container} className="absolute inset-0" />;
}
