'use client';

import { useEffect, useState } from 'react';
import { AVATARS, availableAvatars, isTaken, type AvatarKey } from '@/lib/avatars';
import { getAllPlayers, type Player, savePlayer } from '@/lib/player';

// Shown over the map to anyone who has no player row yet: a nickname and an animal avatar.
export default function Onboarding({ userId, onSaved }: { userId: string; onSaved: (p: Player) => void }) {
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<AvatarKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  useEffect(() => {
    // Animals already chosen by other players are shown greyed out and cannot be picked.
    getAllPlayers().then((list) => setTaken(list.map((p) => p.avatar))).catch(() => {});
  }, []);
  const canSave = !busy && nickname.trim().length > 0 && avatar !== null && !isTaken(avatar, taken, null);

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
    <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-[28px] border-t-2 border-[var(--line)] bg-[var(--paper)] px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-[0_-4px_0_var(--line)]">
      <div className="mx-auto max-w-md">
      <h2 className="dl-title text-3xl">Обери свій нік</h2>
      <form className="mt-4 flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={24} placeholder="Нік" autoComplete="nickname" className="dl-field" />
        <fieldset>
          <legend className="dl-label mb-3">Обери тварину</legend>
          <div className="grid grid-cols-6 gap-2">
            {AVATARS.map((a) => {
              const gone = isTaken(a.key, taken, null);
              return (
              <button
                key={a.key}
                type="button"
                aria-label={gone ? `${a.label} — уже обрано` : a.label}
                aria-pressed={avatar === a.key}
                disabled={gone}
                onClick={() => setAvatar(a.key)}
                className={`grid aspect-square place-items-center rounded-full border-2 text-2xl transition-transform active:scale-90 disabled:cursor-not-allowed disabled:grayscale disabled:opacity-30 ${
                  avatar === a.key
                    ? 'border-[var(--green)] bg-[var(--green-soft)] shadow-[0_3px_0_var(--green-deep)]'
                    : 'border-[var(--line)] bg-[var(--paper)] shadow-[0_3px_0_var(--line)]'
                }`}
              >
                {a.emoji}
              </button>
              );
            })}
          </div>
        </fieldset>
        {error && <p role="alert" className="text-sm font-bold text-[var(--danger)]">{error}</p>}
        <button type="submit" disabled={!canSave} className="dl-btn">
          {busy ? 'Зберігаємо…' : 'Зберегти і відкрити карту'}
        </button>
      </form>
      </div>
    </div>
  );
}
