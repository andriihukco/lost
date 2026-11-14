'use client';

import { useState } from 'react';
import { unmarkFound, type UnfoundStatus } from '@/lib/found';
import type { Treasure } from '@/lib/useTreasures';

const MESSAGES: Record<UnfoundStatus, string> = {
  unfound: 'Скарб повернуто на карту',
  not_yours: 'Повернути може лише той, хто знайшов',
  not_found: 'Скарб не знайдено',
  not_found_state: 'Скарб уже на карті',
};

// The finder's own finds, with undo for a mistaken "found".
export default function MyFinds({ finds, onChanged }: { finds: Treasure[]; onChanged: () => void }) {
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function undo(t: Treasure) {
    setBusyId(t.id);
    setMessage(null);
    try {
      setMessage(MESSAGES[await unmarkFound(t.id)]);
      onChanged();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pb-6">
      <h2 className="dl-title text-3xl">Мої знахідки</h2>
      {finds.length === 0 && <p className="text-base font-semibold text-[var(--muted)]">Поки що немає знахідок. Знайдіть перший скарб!</p>}
      <ul className="flex flex-col gap-3">
        {finds.map((t) => (
          <li key={t.id} className="dl-card flex items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0 truncate text-base font-extrabold">🍄 {t.title}</span>
            <button type="button" disabled={busyId === t.id} onClick={() => void undo(t)} className="dl-btn-secondary !w-auto !px-4 !py-2 !text-sm">
              Повернути
            </button>
          </li>
        ))}
      </ul>
      {message && <p role="status" className="text-sm font-bold text-[var(--green-deep)]">{message}</p>}
    </section>
  );
}
