'use client';

import Icon from '@/components/Icon';
import type { IconName } from '@/components/iconPaths';
import type { MapKind } from '@/lib/mapStyle';

const OPTIONS: { id: MapKind; label: string; icon: IconName }[] = [
  { id: 'outdoor', label: 'Карта', icon: 'map' },
  { id: 'satellite', label: 'Супутник', icon: 'satellite_alt' },
  { id: 'hybrid', label: 'Гібрид', icon: 'layers' },
];

// Map style switch, a vertical group of round buttons under the locate button (Apple Maps style).
export default function MapKindPicker({ value, onChange }: { value: MapKind; onChange: (k: MapKind) => void }) {
  return (
    <div role="radiogroup" aria-label="Вигляд мапи" className="absolute right-3 z-10 flex flex-col gap-1 rounded-full bg-[var(--paper)] p-1 elev-md" style={{ top: 'calc(env(safe-area-inset-top) + 72px)' }}>
      {OPTIONS.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => onChange(o.id)}
            className={`grid h-11 w-11 place-items-center rounded-full transition-colors ${active ? 'bg-[var(--green-soft)] text-[var(--green-deep)]' : 'text-[var(--muted)]'}`}
          >
            <Icon name={o.icon} filled={active} size={22} />
          </button>
        );
      })}
    </div>
  );
}
