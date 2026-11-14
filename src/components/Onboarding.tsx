'use client';

import { useEffect, useState } from 'react';
import NicknamePicker from '@/components/NicknamePicker';
import { isTaken, nicknameFor, type AvatarKey } from '@/lib/avatars';
import { getAllPlayers, type Player, savePlayer } from '@/lib/player';

// Shown over the map to anyone who has no player row yet. The player picks an animal; its nickname comes with it.
export default function Onboarding({ userId, onSaved }: { userId: string; onSaved: (p: Player) => void }) {
  const [avatar, setAvatar] = useState<AvatarKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  useEffect(() => {
    getAllPlayers().then((list) => setTaken(list.map((p) => p.avatar))).catch(() => {});
  }, []);
  const canSave = !busy && avatar !== null && !isTaken(avatar, taken, null);

  async function save() {
    const nickname = avatar ? nicknameFor(avatar) : null;
    if (!avatar || !nickname) return;
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
    <div className="absolute inset-x-0 bottom-0 z-10 max-h-[92%] overflow-y-auto rounded-t-[28px] border-t-2 border-[var(--line)] bg-[var(--paper)] px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] elev-sheet">
      <div className="mx-auto max-w-md">
        <h2 className="dl-title text-3xl">Обери свій нік</h2>
        <p className="mt-2 text-[15px] leading-snug text-[var(--muted)]">Кожна тварина має свій нік. Оберіть тварину, і її нік стане вашим.</p>
        <form className="mt-5 flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <NicknamePicker value={avatar} taken={taken} onPick={setAvatar} />
          {error && <p role="alert" className="text-sm font-bold text-[var(--danger)]">{error}</p>}
          <button type="submit" disabled={!canSave} className="dl-btn">
            {busy ? 'Зберігаємо…' : 'Зберегти і відкрити карту'}
          </button>
        </form>
      </div>
    </div>
  );
}
