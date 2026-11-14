'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { listPlayers, removePlayer, type AdminPlayer } from '@/lib/adminPlayers';
import { avatarEmoji } from '@/lib/avatars';
import { timeAgo } from '@/lib/timeAgo';

const REFRESH_MS = 15000;
const ONLINE_MS = 2 * 60_000; // a position in the last two minutes counts as "on the map now"

// Every player who has entered the game: name, animal, last known position. An admin can remove a player;
// that player is signed out on their next visit and picks an animal again.
export default function PlayersPanel() {
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const reload = useCallback(async () => {
    try {
      setPlayers(await listPlayers());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
      setNow(Date.now());
    }
  }, []);

  useEffect(() => {
    void reload();
    const id = setInterval(() => void reload(), REFRESH_MS);
    return () => clearInterval(id);
  }, [reload]);

  async function remove(p: AdminPlayer) {
    if (!window.confirm(`Видалити гравця «${p.nickname}»? Він зможе обрати тварину знову.`)) return;
    setBusyId(p.user_id);
    try {
      await removePlayer(p.user_id);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const onlineCount = players.filter((p) => p.seen_at && now - Date.parse(p.seen_at) < ONLINE_MS).length;

  return (
    <section className="flex flex-col gap-3 px-4 pb-32">
      <div className="flex items-end justify-between pt-1">
        <div>
          <h1 className="dl-title text-[30px]">Гравці</h1>
          <p className="text-sm font-semibold text-[var(--muted)]">всього {players.length} · на мапі зараз {onlineCount}</p>
        </div>
        <button type="button" onClick={() => void reload()} className="min-h-[44px] px-2 text-sm font-bold text-[var(--green-deep)]">Оновити</button>
      </div>

      {error && <p role="alert" className="dl-card p-4 text-sm font-semibold text-[var(--danger)]">{error}</p>}

      {loaded && players.length === 0 && !error && (
        <div className="dl-card flex flex-col items-center gap-2 p-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--green-soft)] text-[var(--green-deep)]"><Icon name="person" size={28} /></span>
          <p className="text-[17px] font-bold">Ще немає гравців</p>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {players.map((p) => {
          const live = p.seen_at !== null && now - Date.parse(p.seen_at) < ONLINE_MS;
          return (
            <li key={p.user_id} className="dl-card flex items-center gap-3 px-4 py-3">
              <span aria-hidden className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--page)] text-2xl">
                {avatarEmoji(p.avatar)}
                {live && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[var(--paper)] bg-[var(--green)]" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-bold">{p.nickname}</p>
                <p className="truncate text-[13px] font-semibold text-[var(--muted)]">
                  {p.lat !== null && p.lng !== null
                    ? <span className="selectable tabular-nums">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</span>
                    : 'Позиції ще немає'}
                  {' · '}{timeAgo(p.seen_at, now)}
                </p>
              </div>
              <button
                type="button"
                disabled={busyId === p.user_id}
                onClick={() => void remove(p)}
                className="min-h-[44px] shrink-0 rounded-xl px-3 text-sm font-bold text-[var(--danger)] disabled:opacity-40"
              >
                Видалити
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
