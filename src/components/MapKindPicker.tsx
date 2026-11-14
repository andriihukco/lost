'use client';

import { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap } from 'maplibre-gl';
import Icon from '@/components/Icon';
import type { IconName } from '@/components/iconPaths';
import { configureMapLibre } from '@/lib/mapSetup';
import { isBusinessLayer, type MapKind, styleFor } from '@/lib/mapStyle';

export type View = { lat: number; lng: number; zoom: number };

const OPTIONS: { id: MapKind; label: string; icon: IconName }[] = [
  { id: 'outdoor', label: 'Карта', icon: 'map' },
  { id: 'satellite', label: 'Супутник', icon: 'satellite_alt' },
  { id: 'hybrid', label: 'Гібрид', icon: 'layers' },
];

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

// One control, as in Google Maps: a card shows the current map type, live. Tap it to open the options, each
// with its own live preview of the same area. Pick one to close; tap outside or press Escape to close.
export default function MapKindPicker({ value, onChange, view }: { value: MapKind; onChange: (k: MapKind) => void; view: View }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((o) => o.id === value) ?? OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="absolute right-3 z-10 flex items-start gap-2" style={{ top: 'calc(env(safe-area-inset-top) + 72px)' }}>
      {open && (
        <div role="radiogroup" aria-label="Вигляд мапи" className="flex gap-2 rounded-2xl bg-[var(--paper)] p-2.5 elev-lg">
          {OPTIONS.map((o) => {
            const active = o.id === value;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className="flex min-w-[64px] flex-col items-center gap-1.5"
              >
                <span className={`relative h-16 w-16 overflow-hidden rounded-xl ${active ? 'ring-2 ring-[var(--green)] ring-offset-2' : ''}`}>
                  <MiniMap kind={o.id} view={view} className="rounded-xl" />
                </span>
                <span className={`text-[12px] font-semibold ${active ? 'text-[var(--green-deep)]' : 'text-[var(--ink)]'}`}>{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
      <button
        type="button"
        aria-label={`Вигляд мапи: ${current.label}. Змінити`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-[68px] w-[68px] shrink-0 items-end overflow-hidden rounded-2xl border-2 border-[var(--paper)] elev-md"
      >
        <MiniMap kind={value} view={view} />
        <span className="relative m-1 rounded-lg bg-black/45 py-0.5 text-center text-[11px] font-bold leading-tight text-white">{current.label}</span>
      </button>
    </div>
  );
}
