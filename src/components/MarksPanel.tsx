'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { deleteMapMark, listMapMarks, type MapMark } from '@/lib/mapMarks';

// Map marks: the admin's list of warnings and notes shown on the map. Add with +, delete with confirm.
export default function MarksPanel() {
  const [marks, setMarks] = useState<MapMark[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setMarks(await listMapMarks());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function remove(m: MapMark) {
    if (!window.confirm(`Видалити мітку «${m.title}» з мапи?`)) return;
    setBusyId(m.id);
    try {
      await deleteMapMark(m.id);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="flex flex-col gap-4 px-4 pb-32">
      <div className="flex items-end justify-between pt-2">
        <div>
          <h1 className="dl-title text-[30px]">Мітки</h1>
          <p className="text-sm font-semibold text-[var(--muted)]">Попередження на мапі, не скарби: їх не можна знайти</p>
        </div>
        <button type="button" onClick={() => void reload()} className="min-h-[44px] px-2 text-sm font-bold text-[var(--green-deep)]">Оновити</button>
      </div>

      {error && <p role="alert" className="dl-card p-4 text-sm font-semibold text-[var(--danger)]">{error}</p>}

      {loaded && marks.length === 0 && !error && (
        <div className="dl-card flex flex-col items-center gap-2 p-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--green-soft)] text-[var(--green-deep)]"><Icon name="warning" size={28} /></span>
          <p className="text-[17px] font-bold">Міток ще немає</p>
          <p className="text-sm text-[var(--muted)]">Натисніть +, щоб позначити небезпеку чи зачинений вхід.</p>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {marks.map((m) => (
          <li key={m.id} className="dl-card flex items-center gap-2 p-2">
            <Link
              href={`/admin/marks/new?id=${m.id}`}
              aria-label={`Редагувати мітку «${m.title}»`}
              className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-1"
            >
              <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-[#f2a900] bg-[var(--paper)] text-2xl">
                {m.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-bold leading-tight">{m.title}</span>
                <span className="mt-0.5 block truncate text-[13px] font-medium text-[var(--muted)]">
                  {m.note ?? `${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}`}
                </span>
              </span>
            </Link>
            <Link
              href={`/admin/marks/new?id=${m.id}`}
              aria-label={`Редагувати «${m.title}»`}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--page)] text-[var(--green-deep)]"
            >
              <Icon name="edit" size={20} />
            </Link>
            <button
              type="button"
              disabled={busyId === m.id}
              onClick={() => void remove(m)}
              aria-label={`Видалити «${m.title}»`}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--page)] text-[var(--danger)] disabled:opacity-40"
            >
              <Icon name="delete" size={20} />
            </button>
          </li>
        ))}
      </ul>

      <Link
        href="/admin/marks/new"
        aria-label="Нова мітка"
        className="fixed right-5 z-30 grid h-16 w-16 place-items-center rounded-full bg-[var(--green)] text-white elev-green transition-transform active:scale-95"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 104px)' }}
      >
        <Icon name="add" size={30} />
      </Link>
    </section>
  );
}
