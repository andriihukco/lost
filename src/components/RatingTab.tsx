'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { avatarEmoji } from '@/lib/avatars';
import { fetchLeaderboard } from '@/lib/leaderboard';
import { type BoardCategory, rankRows, type BoardRow } from '@/lib/leaderboardRank';

const CATEGORIES: { id: BoardCategory; label: string; hint: string }[] = [
  { id: 'firsts', label: 'Перші скарби', hint: 'Хто першим знайшов скарб' },
  { id: 'places', label: 'Перші на місці', hint: 'Хто першим дійшов до місця' },
  { id: 'finds', label: 'Знахідки', hint: 'Скільки скарбів зараз у гравця' },
];
// Gold, silver, bronze for the top three places.
const MEDAL = ['#f5c542', '#c9d1d9', '#d99a5b'];

// The leaderboard of all players: three counts, ranked. My row is highlighted.
export default function RatingTab({ myId }: { myId: string }) {
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [category, setCategory] = useState<BoardCategory>('firsts');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchLeaderboard()
      .then((r) => { if (alive) { setRows(r); setError(null); } })
      .catch((e: Error) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const ranked = useMemo(() => rankRows(rows, category), [rows, category]);
  const current = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-safe-top">
      <h1 className="ios-large-title pt-4">Рейтинг</h1>

      <div role="tablist" aria-label="Категорія рейтингу" className="mt-5 grid grid-cols-3 gap-1 rounded-full bg-[var(--line)] p-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            onClick={() => setCategory(c.id)}
            className={`min-h-[44px] rounded-full px-1 text-[13px] font-bold leading-tight transition-colors ${category === c.id ? 'bg-[var(--paper)] text-[var(--ink)] elev-sm' : 'text-[var(--muted)]'}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm font-semibold text-[var(--muted)]">{current.hint}</p>

      {error && <p role="alert" className="dl-card mt-4 p-4 text-sm font-semibold text-[var(--danger)]">{error}</p>}
      {loaded && !error && rows.length === 0 && (
        <div className="dl-card mt-4 flex flex-col items-center gap-2 p-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--green-soft)] text-[var(--green-deep)]"><Icon name="trophy" size={28} /></span>
          <p className="text-[17px] font-bold">Рейтинг порожній</p>
          <p className="text-sm text-[var(--muted)]">Знайдіть перший скарб, і ви з&apos;явитесь тут.</p>
        </div>
      )}

      <ol className="mt-4 flex flex-col gap-2">
        {ranked.map((r) => {
          const mine = r.user_id === myId;
          return (
            <li
              key={r.user_id}
              aria-current={mine ? 'true' : undefined}
              className={`dl-card flex items-center gap-3 px-4 py-3 ${mine ? 'border-[var(--green)] bg-[var(--green-soft)]' : ''}`}
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[15px] font-extrabold tabular-nums"
                style={r.place !== null && r.place <= 3 ? { background: MEDAL[r.place - 1] } : undefined}
                aria-label={r.place !== null ? `Місце ${r.place}` : 'Без місця'}
              >
                {r.place ?? '–'}
              </span>
              <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--page)] text-2xl">{avatarEmoji(r.avatar)}</span>
              <span className="min-w-0 flex-1 truncate text-[16px] font-bold">
                {r.nickname}{mine && <span className="ml-1 text-[13px] font-semibold text-[var(--green-deep)]">· ви</span>}
              </span>
              <span className="shrink-0 text-[20px] font-black tabular-nums">{r.value}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
