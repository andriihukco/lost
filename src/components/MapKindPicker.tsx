'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import type { IconName } from '@/components/iconPaths';
import type { MapKind } from '@/lib/mapStyle';

// Each map type has a preview: a gradient that stands for the look of the map (paper-like, satellite, hybrid).
const OPTIONS: { id: MapKind; label: string; icon: IconName; preview: string }[] = [
  { id: 'outdoor', label: 'Карта', icon: 'map', preview: 'linear-gradient(135deg, #cfe8b8, #f0e6c8 60%, #a8d0e6)' },
  { id: 'satellite', label: 'Супутник', icon: 'satellite_alt', preview: 'linear-gradient(135deg, #2f4a2a, #5a6b3d 45%, #3b3f3a)' },
  { id: 'hybrid', label: 'Гібрид', icon: 'layers', preview: 'linear-gradient(135deg, #3b4f35, #6b7a55 50%, #d5d9c8)' },
];

// One control, as in Google Maps: a card shows the current map type. Tap it to open the options; pick one to close.
export default function MapKindPicker({ value, onChange }: { value: MapKind; onChange: (k: MapKind) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((o) => o.id === value) ?? OPTIONS[0];

  // Tap outside or press Escape to close without choosing.
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
                <span
                  aria-hidden
                  style={{ background: o.preview }}
                  className={`grid h-16 w-16 place-items-center rounded-xl text-white ${active ? 'ring-2 ring-[var(--green)] ring-offset-2' : ''}`}
                >
                  <Icon name={o.icon} size={24} />
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
        style={{ background: current.preview }}
        className="grid h-[68px] w-[68px] shrink-0 items-end rounded-2xl border-2 border-[var(--paper)] p-1 elev-md"
      >
        <span className="rounded-lg bg-black/45 py-0.5 text-center text-[11px] font-bold leading-tight text-white">{current.label}</span>
      </button>
    </div>
  );
}
