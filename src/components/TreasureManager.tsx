'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import Icon from '@/components/Icon';
import TreasureEditor from '@/components/TreasureEditor';
import TreasureModal from '@/components/TreasureModal';
import { listTreasures, type AdminTreasure } from '@/lib/adminTreasures';
import { pinOrDefault } from '@/lib/pinEmoji';
import { getAllPlayers } from '@/lib/player';

type Filter = 'all' | 'active' | 'found';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Усі' },
  { id: 'active', label: 'На карті' },
  { id: 'found', label: 'Знайдено' },
];

// Every treasure with its status. Filter the list, tap a row to open it in its own view to edit, and use the + button to add a new one.
export default function TreasureManager() {
  const [items, setItems] = useState<AdminTreasure[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [list, players] = await Promise.all([listTreasures(), getAllPlayers()]);
      setItems(list);
      setNames(Object.fromEntries(players.map((p) => [p.user_id, p.nickname])));
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

  const activeCount = items.filter((t) => !t.is_found).length;
  const foundCount = items.length - activeCount;
  const shown = items.filter((t) => (filter === 'all' ? true : filter === 'active' ? !t.is_found : t.is_found));
  // The treasure open in the modal. Read from the list, so the modal shows the latest saved data.
  const selected = items.find((t) => t.id === selectedId) ?? null;

  return (
    <section className="mx-auto w-full max-w-3xl flex flex-col gap-4 px-4 pb-32">
      <div className="flex items-end justify-between pt-2">
        <div>
          <h1 className="dl-title text-[30px]">Скарби</h1>
          <p className="text-sm font-semibold text-[var(--muted)]">
            На карті {activeCount} · знайдено {foundCount}
          </p>
        </div>
        <button type="button" onClick={() => void reload()} className="min-h-[44px] px-2 text-sm font-bold text-[var(--green-deep)]">Оновити</button>
      </div>

      <div role="tablist" aria-label="Фільтр скарбів" className="grid grid-cols-3 gap-1 rounded-full bg-[var(--line)] p-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`min-h-[40px] rounded-full text-sm font-bold transition-colors ${filter === f.id ? 'bg-[var(--paper)] text-[var(--ink)] elev-sm' : 'text-[var(--muted)]'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="dl-card p-4 text-sm font-semibold text-[var(--danger)]">{error}</p>}

      {loaded && items.length === 0 && !error && (
        <div className="dl-card flex flex-col items-center gap-2 p-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--green-soft)] text-[var(--green-deep)]"><Icon name="travel_explore" size={28} /></span>
          <p className="text-[17px] font-bold">Ще немає скарбів</p>
          <p className="text-sm text-[var(--muted)]">Натисніть +, щоб додати перший.</p>
        </div>
      )}
      {loaded && items.length > 0 && shown.length === 0 && (
        <p className="py-6 text-center text-[var(--muted)]">У цьому фільтрі порожньо</p>
      )}

      <ul className="flex flex-col gap-2">
        {shown.map((t) => (
          <li key={t.id} className="dl-card overflow-hidden">
            <div className="flex items-center gap-2 p-2">
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setSelectedId(t.id)}
                className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-1 text-left"
              >
                <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-[var(--green)] bg-[var(--paper)] text-2xl">
                  {pinOrDefault(t.pin_emoji)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-bold leading-tight">{t.title}</span>
                  <span className={`mt-0.5 block truncate text-[13px] font-semibold ${t.is_found ? 'text-[var(--muted)]' : 'text-[var(--green-deep)]'}`}>
                    {t.is_found ? `Знайдено: ${names[t.found_by ?? ''] ?? 'гравець'}${t.found_manual ? ' · вручну' : ''}` : 'На карті'}
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-label={`Редагувати «${t.title}»`}
                aria-haspopup="dialog"
                onClick={() => setSelectedId(t.id)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--page)] text-[var(--green-deep)]"
              >
                <Icon name="edit" size={20} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <AnimatePresence>
        {selected && (
          <TreasureModal key={selected.id} title={selected.title} onClose={() => setSelectedId(null)}>
            <TreasureEditor
              treasure={selected}
              names={names}
              onChanged={() => void reload()}
              onDeleted={() => { setSelectedId(null); void reload(); }}
            />
          </TreasureModal>
        )}
      </AnimatePresence>

      <Link
        href="/admin/new"
        aria-label="Новий скарб"
        className="fixed right-5 z-30 grid h-16 w-16 place-items-center rounded-full bg-[var(--green)] text-white elev-green transition-transform active:scale-95"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 104px)' }}
      >
        <Icon name="add" size={30} />
      </Link>

    </section>
  );
}
