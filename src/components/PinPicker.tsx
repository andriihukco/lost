'use client';

import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LatLng } from '@/lib/geo';
import { configureMapLibre, mapStyle } from '@/lib/mapSetup';

// Tap the map to place the pin, or drag it to refine (spec §6.3).
export default function PinPicker({ value, onChange }: { value: LatLng | null; onChange: (p: LatLng) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!container.current) return;
    configureMapLibre();
    const map = new MapLibreMap({
      container: container.current,
      style: mapStyle(),
      center: [24.0315, 49.8419],
      zoom: 14,
      attributionControl: { compact: true },
    });
    map.on('click', (e) => onChangeRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !value) return;
    if (!markerRef.current) {
      const marker = new Marker({ draggable: true }).setLngLat([value.lng, value.lat]).addTo(map);
      marker.on('dragend', () => {
        const ll = marker.getLngLat();
        onChangeRef.current({ lat: ll.lat, lng: ll.lng });
      });
      markerRef.current = marker;
      map.jumpTo({ center: [value.lng, value.lat] });
    } else {
      markerRef.current.setLngLat([value.lng, value.lat]);
    }
  }, [value]);

  return <div ref={container} className="relative h-56 w-full overflow-hidden rounded-2xl" />;
}
