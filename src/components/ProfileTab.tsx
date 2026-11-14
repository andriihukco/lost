'use client';

import { useState } from 'react';
import { AVATARS, avatarEmoji, type AvatarKey } from '@/lib/avatars';
import { savePlayer, type Player } from '@/lib/player';

// "Профіль" tab: change the nickname and the animal. Grouped list, large title.
export default function ProfileTab({ player, onSaved }: { player: Player; onSaved: (p: Player) => void }) {
  const [nickname, setNickname] = useState(player.nickname);
  const [avatar, setAvatar] = useState<AvatarKey>(player.avatar);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dirty = nickname.trim() !== player.nickname || avatar !== player.avatar;

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
          <span className="w-24 shrink-0 text-[17px]">Імʼя</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={24}
            autoComplete="nickname"
            className="min-w-0 flex-1 bg-transparent text-right text-[17px] outline-none"
          />
        </label>
      </div>

      <p className="ios-section mt-6">Тварина</p>
      <div className="ios-group grid grid-cols-6 gap-1 p-3">
        {AVATARS.map((a) => (
          <button
            key={a.key}
            type="button"
            aria-label={a.label}
            aria-pressed={avatar === a.key}
            onClick={() => setAvatar(a.key)}
            className={`grid aspect-square min-h-[44px] place-items-center rounded-full text-2xl transition-transform active:scale-90 ${
              avatar === a.key ? 'bg-[var(--green-soft)] ring-2 ring-[var(--green)]' : ''
            }`}
          >
            {a.emoji}
          </button>
        ))}
      </div>

      <button type="button" disabled={!dirty || busy || !nickname.trim()} onClick={() => void save()} className="dl-btn mt-6">
        {busy ? 'Зберігаємо…' : 'Зберегти зміни'}
      </button>
      {message && <p role="status" className="mt-3 text-center text-[15px] font-semibold text-[var(--green-deep)]">{message}</p>}
    </div>
  );
}
