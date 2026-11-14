'use client';

import { useEffect, useRef } from 'react';
import { Map as MapLibreMap } from 'maplibre-gl';
import { configureMapLibre } from '@/lib/mapSetup';
import { isBusinessLayer, type MapKind, styleFor } from '@/lib/mapStyle';

export type View = { lat: number; lng: number; zoom: number };

const LABEL: Record<MapKind, string> = { outdoor: 'Карта', hybrid: 'Гібрид' };
const OTHER: Record<MapKind, MapKind> = { outdoor: 'hybrid', hybrid: 'outdoor' };

// A live, non-interactive copy of the map in one style, centred on the area in view. It uses the same style code
// as the main map, so the preview is the real map (MapTiler when keyed, the free sources otherwise).
function MiniMap({ kind, view, className }: { kind: MapKind; view: View; className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!container.current) return;
    configureMapLibre();
    const m = new MapLibreMap({
      container: container.current,
      style: styleFor(kind, process.env.NEXT_PUBLIC_MAPTILER_KEY),
      center: [view.lng, view.lat],
      zoom: view.zoom,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    });
    // Same policy as the main map: no businesses or places.
    m.on('style.load', () => {
      for (const layer of m.getStyle()?.layers ?? []) {
        const sourceLayer = (layer as { 'source-layer'?: string })['source-layer'];
        if (isBusinessLayer(layer.id, sourceLayer)) m.setLayoutProperty(layer.id, 'visibility', 'none');
      }
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // The map is created once per kind; the view is followed with jumpTo below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  useEffect(() => {
    map.current?.jumpTo({ center: [view.lng, view.lat], zoom: view.zoom });
  }, [view]);

  // MapLibre's stylesheet makes its container position:relative, so the positioning lives on a wrapper.
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ''}`}>
      <div ref={container} className="h-full w-full" />
    </div>
  );
}

// One button, no menu: it shows the current map type live, and a tap switches to the other type.
export default function MapKindPicker({ value, onChange, view }: { value: MapKind; onChange: (k: MapKind) => void; view: View }) {
  return (
    <div className="absolute right-3 z-10" style={{ top: 'calc(env(safe-area-inset-top) + 72px)' }}>
      <button
        type="button"
        aria-label={`Вигляд карти: ${LABEL[value]}. Перемкнути на ${LABEL[OTHER[value]]}`}
        onClick={() => onChange(OTHER[value])}
        className="relative grid h-[68px] w-[68px] items-end overflow-hidden rounded-2xl border-2 border-[var(--paper)] elev-md"
      >
        <MiniMap kind={value} view={view} />
        <span className="relative m-1 rounded-lg bg-black/45 py-0.5 text-center text-[11px] font-bold leading-tight text-white">{LABEL[value]}</span>
      </button>
    </div>
  );
}
