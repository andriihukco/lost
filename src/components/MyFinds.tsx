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

// The finder's own finds, with undo for a mistaken "found" (spec: send it back to the map).
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
    <section className="flex flex-col gap-3 p-5">
      <h2 className="text-2xl font-bold tracking-tight">Мої знахідки</h2>
      {finds.length === 0 && <p className="text-neutral-500">Поки що немає знахідок</p>}
      <ul className="flex flex-col gap-2">
        {finds.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-neutral-100 px-4 py-3">
            <span className="font-medium">{t.title}</span>
            <button
              type="button"
              disabled={busyId === t.id}
              onClick={() => void undo(t)}
              className="text-sm font-semibold text-blue-600 disabled:opacity-40"
            >
              Повернути на карту
            </button>
          </li>
        ))}
      </ul>
      {message && <p role="status" className="text-sm">{message}</p>}
    </section>
  );
}
