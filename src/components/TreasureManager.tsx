'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import TreasureEditor from '@/components/TreasureEditor';
import TreasureForm from '@/components/TreasureForm';
import { listTreasures, type AdminTreasure } from '@/lib/adminTreasures';
import { pinOrDefault } from '@/lib/pinEmoji';
import { getAllPlayers } from '@/lib/player';

type Filter = 'all' | 'active' | 'found';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Усі' },
  { id: 'active', label: 'На карті' },
  { id: 'found', label: 'Знайдено' },
];

// Every treasure with its status. Filter the list, tap a row to edit, and use the + button to add a new one.
export default function TreasureManager() {
  const [items, setItems] = useState<AdminTreasure[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
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

  // The new-treasure sheet closes with Escape too.
  useEffect(() => {
    if (!creating) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCreating(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [creating]);

  const activeCount = items.filter((t) => !t.is_found).length;
  const foundCount = items.length - activeCount;
  const shown = items.filter((t) => (filter === 'all' ? true : filter === 'active' ? !t.is_found : t.is_found));

  return (
    <section className="flex flex-col gap-4 px-4 pb-32">
      <div className="flex items-end justify-between pt-2">
        <div>
          <h1 className="dl-title text-[30px]">Скарби</h1>
          <p className="text-sm font-semibold text-[var(--muted)]">
            На карті {activeCount} · знайдено {foundCount}
          </p>
        </div>
        <button type="button" onClick={() => void reload()} className="min-h-[44px] px-2 text-sm font-bold text-[var(--green-deep)]">Оновити</button>
      </div>

      <div role="tablist" aria-label="Фільтр скарбів" className="grid grid-cols-3 gap-1 rounded-2xl bg-[var(--line)] p-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`min-h-[40px] rounded-xl text-sm font-bold transition-colors ${filter === f.id ? 'bg-[var(--paper)] text-[var(--ink)] elev-sm' : 'text-[var(--muted)]'}`}
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
          <p className="text-sm text-[var(--muted)]">Натисніть + , щоб додати перший.</p>
        </div>
      )}
      {loaded && items.length > 0 && shown.length === 0 && (
        <p className="py-6 text-center text-[var(--muted)]">У цьому фільтрі порожньо</p>
      )}

      <ul className="flex flex-col gap-2">
        {shown.map((t) => {
          const open = selectedId === t.id;
          return (
            <li key={t.id} className="dl-card overflow-hidden">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setSelectedId(open ? null : t.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--page)] text-2xl">{pinOrDefault(t.pin_emoji)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-bold">{t.title}</span>
                  <span className="block truncate text-[13px] font-semibold text-[var(--muted)]">
                    {t.is_found ? `Знайдено: ${names[t.found_by ?? ''] ?? 'гравець'}${t.found_manual ? ' · вручну' : ''}` : 'На карті'}
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${t.is_found ? 'bg-[var(--line)] text-[var(--muted)]' : 'bg-[var(--green-soft)] text-[var(--green-deep)]'}`}>
                  {t.is_found ? 'знайдено' : 'активний'}
                </span>
              </button>
              {open && (
                <div className="border-t border-[var(--line)] px-4 pb-4">
                  <TreasureEditor
                    key={t.id}
                    treasure={t}
                    names={names}
                    onChanged={() => void reload()}
                    onDeleted={() => { setSelectedId(null); void reload(); }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => setCreating(true)}
        aria-label="Новий скарб"
        className="fixed right-5 z-30 grid h-16 w-16 place-items-center rounded-full bg-[var(--green)] text-white elev-green transition-transform active:scale-95"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <Icon name="add" size={30} />
      </button>

      {creating && (
        <div role="dialog" aria-modal="true" aria-label="Новий скарб" className="fixed inset-0 z-50 flex flex-col bg-[var(--page)]">
          <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--paper)] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
            <h2 className="dl-title text-xl">Новий скарб</h2>
            <button type="button" onClick={() => setCreating(false)} aria-label="Закрити" className="grid h-11 w-11 place-items-center rounded-full text-[var(--muted)]">
              <Icon name="close" size={24} />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <TreasureForm
              onCreated={() => {
                setCreating(false);
                void reload();
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
