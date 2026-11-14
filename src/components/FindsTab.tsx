'use client';

import { useMemo, useState } from 'react';
import { unmarkFound, type UnfoundStatus } from '@/lib/found';
import { formatDistance } from '@/lib/geoFormat';
import type { Treasure } from '@/lib/useTreasures';

const MESSAGES: Record<UnfoundStatus, string> = {
  unfound: 'Скарб повернуто на карту',
  not_yours: 'Повернути може лише той, хто знайшов',
  not_found: 'Скарб не знайдено',
  not_found_state: 'Скарб уже на карті',
};

type Props = {
  treasures: Treasure[];
  myId: string | null;
  names: Record<string, string>;
  distances: Record<string, number>;
  gpsReady: boolean;
  onShow: (id: string) => void;
  onRoute: (ids: string[]) => void;
  onChanged: () => void;
};

// "Знахідки" tab: every treasure by status. Tap one to see it on the map. Select open treasures to build a route.
export default function FindsTab({ treasures, myId, names, distances, gpsReady, onShow, onRoute, onChanged }: Props) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const open = useMemo(() => treasures.filter((t) => !t.is_found), [treasures]);
  const mine = useMemo(() => treasures.filter((t) => t.is_found && t.found_by === myId), [treasures, myId]);
  const others = useMemo(() => treasures.filter((t) => t.is_found && t.found_by !== myId), [treasures, myId]);
  const foundCount = treasures.length - open.length;

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  const row = 'flex min-h-[56px] items-center gap-3 px-4 py-2.5 text-left';

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-40 pt-safe-top">
      <h1 className="ios-large-title pt-4">Знахідки</h1>
      <p className="mt-1 text-[15px] font-medium text-[var(--muted)]">Знайдено {foundCount} з {treasures.length}</p>

      {open.length > 0 && (
        <>
          <p className="ios-section mt-6">На карті · {open.length}</p>
          <ul className="ios-group">
            {open.map((t) => {
              const on = picked.has(t.id);
              return (
                <li key={t.id} className="ios-row !p-0">
                  <button type="button" onClick={() => toggle(t.id)} aria-pressed={on} aria-label={on ? 'Прибрати з маршруту' : 'Додати до маршруту'}
                    className="grid min-h-[44px] min-w-[44px] place-items-center pl-4">
                    <span className={`grid h-6 w-6 place-items-center rounded-full border-2 text-[13px] font-extrabold ${on ? 'border-[var(--green)] bg-[var(--green)] text-white' : 'border-[var(--line)]'}`}>
                      {on ? '✓' : ''}
                    </span>
                  </button>
                  <button type="button" onClick={() => onShow(t.id)} className={`${row} flex-1`}>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--green-soft)] text-xl">🍄</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-semibold">{t.title}</span>
                      <span className="block text-[13px] text-[var(--muted)]">
                        {distances[t.id] !== undefined ? `${formatDistance(distances[t.id])} від вас` : gpsReady ? '' : 'Немає GPS'}
                      </span>
                    </span>
                    <span aria-hidden className="text-[var(--muted)]">›</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {mine.length > 0 && (
        <>
          <p className="ios-section mt-6">Знайдені мною · {mine.length}</p>
          <ul className="ios-group">
            {mine.map((t) => (
              <li key={t.id} className="ios-row !p-0">
                <button type="button" onClick={() => onShow(t.id)} className={`${row} flex-1`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--green-soft)] text-xl">✅</span>
                  <span className="min-w-0 flex-1 truncate text-[17px] font-semibold">{t.title}</span>
                </button>
                <button type="button" disabled={busyId === t.id} onClick={() => void undo(t)} className="min-h-[44px] shrink-0 rounded-xl px-3 pr-4 text-[15px] font-semibold text-[var(--danger)] disabled:opacity-40">
                  Повернути
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {others.length > 0 && (
        <>
          <p className="ios-section mt-6">Знайдені іншими · {others.length}</p>
          <ul className="ios-group">
            {others.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => onShow(t.id)} className={`${row} w-full`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-100 text-xl">🔎</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] font-semibold">{t.title}</span>
                    <span className="block text-[13px] text-[var(--muted)]">Знайшов(ла) {names[t.found_by ?? ''] ?? 'гравець'}</span>
                  </span>
                  <span aria-hidden className="text-[var(--muted)]">›</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {treasures.length === 0 && (
        <div className="ios-group mt-6 px-5 py-10 text-center">
          <p className="text-[17px] font-semibold">Скарбів ще немає</p>
          <p className="mt-2 text-[15px] text-[var(--muted)]">Адміністратор ще не додав жодного гриба.</p>
        </div>
      )}

      {picked.size > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+68px)] z-30 px-4">
          <button type="button" disabled={!gpsReady} onClick={() => onRoute([...picked])} className="dl-btn">
            {gpsReady ? `Маршрут до ${picked.size} ${picked.size === 1 ? 'точки' : 'точок'}` : 'Потрібен GPS для маршруту'}
          </button>
        </div>
      )}

      {message && <p role="status" className="mt-4 text-center text-[15px] font-semibold text-[var(--green-deep)]">{message}</p>}
    </div>
  );
}
