'use client';

import type { MapMark } from '@/lib/mapMarks';

// A map mark (a warning or a note), in the same sheet as a treasure, so every object on the map opens alike.
export default function MarkSheet({ mark }: { mark: MapMark }) {
  return (
    <div className="flex flex-col gap-4 px-5 pb-10 pt-2">
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <span aria-hidden className="text-[72px] leading-none">{mark.emoji}</span>
        <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted)]">Мітка на карті</p>
        <p className="text-[22px] font-extrabold">{mark.title}</p>
      </div>
      {mark.note && <p className="rounded-2xl bg-[var(--paper)] p-4 text-[16px] leading-relaxed">{mark.note}</p>}
      <p className="text-center text-[13px] font-semibold tabular-nums text-[var(--muted)]">{mark.lat.toFixed(5)}, {mark.lng.toFixed(5)}</p>
      <p className="text-center text-[13px] text-[var(--muted)]">Мітки — попередження. Їх не можна знайти.</p>
    </div>
  );
}
