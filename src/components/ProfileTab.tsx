'use client';

import { useEffect, useState } from 'react';
import { AVATARS, avatarEmoji, isTaken, type AvatarKey } from '@/lib/avatars';
import { getAllPlayers, savePlayer, type Player } from '@/lib/player';

// "Профіль" tab: change the nickname and the animal. Grouped list, large title.
export default function ProfileTab({ player, onSaved }: { player: Player; onSaved: (p: Player) => void }) {
  const [nickname, setNickname] = useState(player.nickname);
  const [avatar, setAvatar] = useState<AvatarKey>(player.avatar);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dirty = nickname.trim() !== player.nickname || avatar !== player.avatar;
  const [taken, setTaken] = useState<string[]>([]);
  useEffect(() => {
    // Animals chosen by other players are greyed out; my own stays available.
    getAllPlayers().then((list) => setTaken(list.filter((p) => p.user_id !== player.user_id).map((p) => p.avatar))).catch(() => {});
  }, [player.user_id]);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const next = await savePlayer(player.user_id, nickname, avatar);
      onSaved(next);
      setMessage('Збережено');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-safe-top">
      <h1 className="ios-large-title pt-4">Профіль</h1>

      <div className="mt-6 flex flex-col items-center gap-3">
        <span className="grid h-24 w-24 place-items-center rounded-full border-[3px] border-[var(--green)] bg-[var(--paper)] text-5xl shadow-[0_4px_0_var(--green-deep)]">
          {avatarEmoji(avatar)}
        </span>
        <span className="text-[20px] font-bold">{nickname.trim() || 'Гравець'}</span>
      </div>

      <div className="ios-group mt-8">
        <label className="ios-row">
          <span className="w-24 shrink-0 text-[17px]">Нік</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={24}
            autoComplete="nickname"
            className="min-w-0 flex-1 bg-transparent text-right text-[17px] outline-none"
          />
        </label>
      </div>

      <p className="ios-section mt-6">Тотем</p>
      <div className="ios-group grid grid-cols-6 gap-1 p-3">
        {AVATARS.map((a) => {
          const gone = isTaken(a.key, taken, null); // the list already excludes my own row
          return (
            <button
              key={a.key}
              type="button"
              aria-label={gone ? `${a.label} — уже обрано` : a.label}
              aria-pressed={avatar === a.key}
              disabled={gone}
              onClick={() => setAvatar(a.key)}
              className={`grid aspect-square min-h-[44px] place-items-center rounded-full text-2xl transition-transform active:scale-90 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-30 ${
                avatar === a.key ? 'bg-[var(--green-soft)] ring-2 ring-[var(--green)]' : ''
              }`}
            >
              {a.emoji}
            </button>
          );
        })}
      </div>

      <button type="button" disabled={!dirty || busy || !nickname.trim()} onClick={() => void save()} className="dl-btn mt-6">
        {busy ? 'Зберігаємо…' : 'Зберегти зміни'}
      </button>
      {message && <p role="status" className="mt-3 text-center text-[15px] font-semibold text-[var(--green-deep)]">{message}</p>}
    </div>
  );
}
