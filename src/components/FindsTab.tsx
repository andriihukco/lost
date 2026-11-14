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

// "Знахідки" tab: the player's own finds as a grouped list, with send-back for a mistaken find.
export default function FindsTab({ finds, onChanged }: { finds: Treasure[]; onChanged: () => void }) {
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
    <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-safe-top">
      <h1 className="ios-large-title pt-4">Знахідки</h1>
      <p className="mt-1 text-[15px] font-medium text-[var(--muted)]">
        {finds.length === 0 ? 'Поки що порожньо' : `${finds.length} ${finds.length === 1 ? 'знахідка' : 'знахідки'}`}
      </p>

      {finds.length === 0 ? (
        <div className="ios-group mt-6 px-5 py-10 text-center">
          <p className="text-[17px] font-semibold">Знайдіть перший скарб</p>
          <p className="mt-2 text-[15px] text-[var(--muted)]">Підійдіть до гриба на карті, щоб відмітити місце.</p>
        </div>
      ) : (
        <ul className="ios-group mt-5">
          {finds.map((t) => (
            <li key={t.id} className="ios-row">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--green-soft)] text-xl">🍄</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-semibold">{t.title}</span>
                <span className="block text-[13px] text-[var(--muted)]">Знайдено</span>
              </span>
              <button
                type="button"
                disabled={busyId === t.id}
                onClick={() => void undo(t)}
                className="min-h-[44px] shrink-0 rounded-xl px-3 text-[15px] font-semibold text-[var(--danger)] disabled:opacity-40"
              >
                Повернути
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <p role="status" className="mt-4 text-center text-[15px] font-semibold text-[var(--green-deep)]">{message}</p>}
    </div>
  );
}
