'use client';

import { useCallback, useEffect, useState } from 'react';
import TreasureEditor from '@/components/TreasureEditor';
import { listTreasures, type AdminTreasure } from '@/lib/adminTreasures';
import { getAllPlayers } from '@/lib/player';

// Every treasure, found or not, with its status. Tap one to edit, add or remove photos, see history, or delete.
export default function TreasureManager() {
  const [items, setItems] = useState<AdminTreasure[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [list, players] = await Promise.all([listTreasures(), getAllPlayers()]);
      setItems(list);
      setNames(Object.fromEntries(players.map((p) => [p.user_id, p.nickname])));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selected = items.find((t) => t.id === selectedId) ?? null;

  return (
    <section className="flex flex-col gap-3 px-5 pb-10">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">Скарби ({items.length})</h2>
        <button type="button" onClick={() => void reload()} className="text-sm text-[var(--green-deep)] font-bold">Оновити</button>
      </div>
      {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
      {items.length === 0 && !error && <p className="text-[var(--muted)]">Ще немає скарбів</p>}
      <ul className="flex flex-col gap-2">
        {items.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => setSelectedId(selectedId === t.id ? null : t.id)}
              className="flex w-full items-center justify-between gap-3 rounded-xl dl-card px-4 py-3 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">{t.title}</span>
                <span className="block text-xs text-[var(--muted)]">
                  {t.is_found
                    ? `Знайдено: ${names[t.found_by ?? ''] ?? 'гравець'}${t.found_manual ? ' (вручну)' : ''}`
                    : 'На карті'}
                </span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${t.is_found ? 'bg-[var(--line)] text-[var(--muted)]' : 'bg-orange-100 text-orange-700'}`}>
                {t.is_found ? 'знайдено' : 'активний'}
              </span>
            </button>
            {selected?.id === t.id && (
              <TreasureEditor
                key={t.id}
                treasure={t}
                names={names}
                onChanged={() => void reload()}
                onDeleted={() => { setSelectedId(null); void reload(); }}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
