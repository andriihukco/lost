'use client';

import { useEffect, useState } from 'react';
import NicknamePicker from '@/components/NicknamePicker';
import OfflineMap from '@/components/OfflineMap';
import StickyAction from '@/components/StickyAction';
import { isTaken, nicknameFor, type AvatarKey } from '@/lib/avatars';
import type { LatLng } from '@/lib/geo';
import { getAllPlayers, type Player, savePlayer } from '@/lib/player';

// Shown over the map to anyone who has no player row yet (a first visit, or after an admin removed the player).
// Two steps: 1) pick an animal, which gives the nickname; 2) suggest saving the map for offline use.
// The second step is skippable and can also be done later from the profile.
export default function Onboarding({
  userId,
  player,
  points,
  onSaved,
  onFinish,
}: {
  userId: string;
  player: Player | null; // null until the nickname is saved
  points: LatLng[]; // treasures, marks and the player: what the offline map covers
  onSaved: (p: Player) => void;
  onFinish: () => void;
}) {
  const [avatar, setAvatar] = useState<AvatarKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  useEffect(() => {
    if (player) return;
    getAllPlayers().then((list) => setTaken(list.map((p) => p.avatar))).catch(() => {});
  }, [player]);
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

  const sheet = 'fixed inset-0 z-40 flex flex-col justify-end bg-[var(--ink)]/15 backdrop-blur-md';
  const panel = 'max-h-[92%] overflow-y-auto rounded-t-[28px] border-t-2 border-[var(--line)] bg-[var(--paper)] px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] elev-sheet';

  if (player) {
    // Step 2: the map, for offline use. The map behind is blurred and cannot be moved until this is answered.
    return (
      <div className={sheet}>
        <div className={panel}>
          <div className="mx-auto max-w-md">
            <p className="text-[13px] font-bold uppercase tracking-wide text-[var(--muted)]">Крок 2 з 2</p>
            <h2 className="dl-title mt-1 text-3xl">Майже готово</h2>
            <p className="mt-2 text-[15px] leading-snug text-[var(--muted)]">
              Збережіть мапу, щоб бачити скарби й шлях без зв&apos;язку. Можна зробити це й пізніше, у профілі.
            </p>
            <div className="dl-card mt-5">
              <OfflineMap points={points} variant="prompt" onDone={onFinish} onLater={onFinish} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: the animal and its nickname.
  return (
    // The map behind is blurred and cannot be moved until a nickname is chosen.
    <div className={sheet}>
      <div className={panel}>
        <div className="mx-auto max-w-md">
          <p className="text-[13px] font-bold uppercase tracking-wide text-[var(--muted)]">Крок 1 з 2</p>
          <h2 className="dl-title mt-1 text-3xl">Обери свій нік</h2>
          <p className="mt-2 text-[15px] leading-snug text-[var(--muted)]">Кожна тварина має свій нік. Оберіть тварину, і її нік стане вашим.</p>
          <form className="mt-5 flex flex-col gap-5 pb-24" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <NicknamePicker value={avatar} taken={taken} onPick={setAvatar} />
            {error && <p role="alert" className="text-sm font-bold text-[var(--danger)]">{error}</p>}
            <StickyAction>
              <button type="submit" disabled={!canSave} className="dl-btn">
                {busy ? 'Зберігаємо…' : 'Далі'}
              </button>
            </StickyAction>
          </form>
        </div>
      </div>
    </div>
  );
}
