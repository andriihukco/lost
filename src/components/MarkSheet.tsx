'use client';

import Icon from '@/components/Icon';
import type { MapMark } from '@/lib/mapMarks';

// A map mark, as a compact card above the tab bar: its emoji, title, and a short note. Close it with ×.
export default function MarkSheet({ mark, onClose }: { mark: MapMark; onClose: () => void }) {
  return (
    <>
      <span aria-hidden className="shrink-0 text-[40px] leading-none">{mark.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-bold">{mark.title}</p>
        {mark.note && <p className="mt-0.5 line-clamp-2 text-[14px] leading-snug text-[var(--muted)]">{mark.note}</p>}
      </div>
      <button type="button" aria-label="Закрити" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--line)]/70 text-[var(--muted)]">
        <Icon name="close" size={18} />
      </button>
    </>
  );
}
