'use client';

import { useState } from 'react';
import { AVATARS, type AvatarKey } from '@/lib/avatars';
import { type Player, savePlayer } from '@/lib/player';

// Shown over the map to anyone who has no player row yet: a nickname and an animal avatar.
export default function Onboarding({ userId, onSaved }: { userId: string; onSaved: (p: Player) => void }) {
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<AvatarKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSave = !busy && nickname.trim().length > 0 && avatar !== null;

  async function save() {
    if (!avatar || !nickname.trim()) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await savePlayer(userId, nickname, avatar));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-3xl bg-white/95 p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl backdrop-blur">
      <h2 className="text-2xl font-bold tracking-tight">Як тебе звати?</h2>
      <form className="mt-4 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={24}
          placeholder="Імʼя"
          autoComplete="nickname"
          className="rounded-xl bg-neutral-100 px-4 py-3 text-[16px] outline-none ring-1 ring-black/10"
        />
        <fieldset>
          <legend className="mb-2 text-sm text-neutral-500">Обери тварину</legend>
          <div className="grid grid-cols-6 gap-2">
            {AVATARS.map((a) => (
              <button
                key={a.key}
                type="button"
                aria-label={a.label}
                aria-pressed={avatar === a.key}
                onClick={() => setAvatar(a.key)}
                className={`grid h-11 w-11 place-items-center rounded-xl text-2xl ${
                  avatar === a.key ? 'bg-blue-100 ring-2 ring-blue-600' : 'bg-neutral-100'
                }`}
              >
                {a.emoji}
              </button>
            ))}
          </div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={!canSave}
          className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-40"
        >
          {busy ? 'Зберігаємо…' : 'Зберегти і відкрити карту'}
        </button>
      </form>
    </div>
  );
}
