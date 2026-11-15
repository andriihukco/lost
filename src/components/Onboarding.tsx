'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import NicknamePicker from '@/components/NicknamePicker';
import OfflineMap from '@/components/OfflineMap';
import { TransferCodeEntry } from '@/components/ProfileTransfer';
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

  const step = player ? 'map' : 'nickname';

  return (
    // The map behind is blurred and cannot be moved until onboarding is done.
    <div className="fixed inset-0 z-40 flex flex-col justify-end overflow-hidden bg-[var(--ink)]/15 backdrop-blur-md">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ x: 90, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -90, opacity: 0 }}
          transition={{ type: 'spring', visualDuration: 0.4, bounce: 0.1 }}
          className="max-h-[92%] overflow-y-auto rounded-t-[28px] border-t-2 border-[var(--line)] bg-[var(--paper)] px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] elev-sheet"
        >
          {step === 'map' ? (
            // Step 2: the map, for offline use.
            <div className="mx-auto max-w-md">
              <StepDots current={2} />
              <p className="mt-5 text-[34px] leading-none" aria-hidden>🎉</p>
              <h2 className="dl-title mt-3 text-3xl">Майже готово</h2>
              <div className="mt-6">
                <OfflineMap points={points} variant="prompt" onDone={onFinish} onLater={onFinish} />
              </div>
            </div>
          ) : (
            // Step 1: the animal and its nickname.
            <div className="mx-auto max-w-md">
              <StepDots current={1} />
              <p className="mt-5 text-[34px] leading-none" aria-hidden>🐾</p>
              <h2 className="dl-title mt-3 text-3xl">Оберіть свій нік</h2>
              <p className="mt-2 text-[15px] leading-snug text-[var(--muted)]">Кожна тварина має свій нік. Оберіть тварину: її нік стане вашим.</p>
              <form className="mt-5 flex flex-col gap-5 pb-24" onSubmit={(e) => { e.preventDefault(); void save(); }}>
                <NicknamePicker value={avatar} taken={taken} onPick={setAvatar} />
                {error && <p role="alert" className="text-sm font-bold text-[var(--danger)]">{error}</p>}
                <TransferCodeEntry userId={userId} onMoved={onSaved} />
                <StickyAction>
                  <button type="submit" disabled={!canSave} className="dl-btn">
                    {busy ? 'Зберігаємо…' : 'Далі'}
                  </button>
                </StickyAction>
              </form>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Two steps, shown as two bars; the current one is filled.
function StepDots({ current }: { current: 1 | 2 }) {
  return (
    <div role="img" aria-label={`Крок ${current} з 2`} className="flex gap-1.5">
      <span className="h-1.5 flex-1 rounded-full bg-[var(--green)]" />
      <span className={`h-1.5 flex-1 rounded-full ${current === 2 ? 'bg-[var(--green)]' : 'bg-[var(--line)]'}`} />
    </div>
  );
}
