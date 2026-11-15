'use client';

import Icon from '@/components/Icon';
import type { AdminTreasure } from '@/lib/adminTreasures';
import type { MapMark } from '@/lib/mapMarks';
import { pinOrDefault } from '@/lib/pinEmoji';

export type ListFilter = 'all' | 'treasures' | 'marks' | 'found';
export type ListSelection = { kind: 'treasure' | 'mark'; id: string } | null;

// The admin's list of everything on the map, with filters. A row opens the object on the map; the map follows.
export default function AdminObjectList({
  treasures,
  marks,
  names,
  filter,
  onFilter,
  selected,
  onOpenTreasure,
  onOpenMark,
}: {
  treasures: AdminTreasure[];
  marks: MapMark[];
  names: Record<string, string>;
  filter: ListFilter;
  onFilter: (f: ListFilter) => void;
  selected: ListSelection;
  onOpenTreasure: (t: AdminTreasure) => void;
  onOpenMark: (m: MapMark) => void;
}) {
  const found = treasures.filter((t) => t.is_found);
  const counts: Record<ListFilter, number> = {
    all: treasures.length + marks.length,
    treasures: treasures.length,
    marks: marks.length,
    found: found.length,
  };
  const chips: { id: ListFilter; label: string }[] = [
    { id: 'all', label: 'Усі' },
    { id: 'treasures', label: 'Скарби' },
    { id: 'marks', label: 'Мітки' },
    { id: 'found', label: 'Знайдені' },
  ];

  const showTreasures = filter === 'all' || filter === 'treasures' || filter === 'found';
  const showMarks = filter === 'all' || filter === 'marks';
  const shownTreasures = filter === 'found' ? found : treasures;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div role="tablist" aria-label="Що показувати" className="flex gap-2 overflow-x-auto">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={filter === c.id}
            onClick={() => onFilter(c.id)}
            className={`min-h-[36px] shrink-0 rounded-full px-3.5 text-[14px] font-bold transition-colors ${
              filter === c.id ? 'bg-[var(--green)] text-white' : 'bg-[var(--line)]/70 text-[var(--muted)]'
            }`}
          >
            {c.label} <span className="tabular-nums opacity-80">{counts[c.id]}</span>
          </button>
        ))}
      </div>

      <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain pb-1">
        {showTreasures &&
          shownTreasures.map((t) => {
            const on = selected?.kind === 'treasure' && selected.id === t.id;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onOpenTreasure(t)}
                  aria-current={on ? 'true' : undefined}
                  className={`flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors ${on ? 'bg-[var(--green-soft)]' : 'hover:bg-[var(--page)]'}`}
                >
                  <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-[var(--green)] bg-[var(--paper)] text-xl">
                    {pinOrDefault(t.pin_emoji)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">{t.title}</span>
                    <span className={`block truncate text-[13px] font-semibold ${t.is_found ? 'text-[var(--muted)]' : 'text-[var(--green-deep)]'}`}>
                      {t.is_found ? `Знайдено: ${names[t.found_by ?? ''] ?? 'гравець'}` : 'На карті'}
                    </span>
                  </span>
                  <Icon name="arrow_forward" size={18} className="shrink-0 text-[var(--muted)]" />
                </button>
              </li>
            );
          })}

        {showMarks &&
          marks.map((m) => {
            const on = selected?.kind === 'mark' && selected.id === m.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onOpenMark(m)}
                  aria-current={on ? 'true' : undefined}
                  className={`flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors ${on ? 'bg-[var(--green-soft)]' : 'hover:bg-[var(--page)]'}`}
                >
                  <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-[#f2a900] bg-[var(--paper)] text-xl">
                    {m.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">{m.title}</span>
                    <span className="block truncate text-[13px] font-medium text-[var(--muted)]">Мітка · {m.note ?? `${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}`}</span>
                  </span>
                  <Icon name="arrow_forward" size={18} className="shrink-0 text-[var(--muted)]" />
                </button>
              </li>
            );
          })}

        {((showTreasures && shownTreasures.length === 0) && (!showMarks || marks.length === 0)) && (
          <li className="px-3 py-6 text-center text-[14px] font-semibold text-[var(--muted)]">Тут поки порожньо. Додайте скарб або мітку кнопкою «+».</li>
        )}
      </ul>
    </div>
  );
}
