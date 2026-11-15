'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import BackButton from '@/components/BackButton';
import NicknamePicker from '@/components/NicknamePicker';
import OfflineMap from '@/components/OfflineMap';
import { LockPicker, PasscodeSetup } from '@/components/Passcode';
import { TransferCodeEntry } from '@/components/ProfileTransfer';
import StickyAction from '@/components/StickyAction';
import { isTaken, nicknameFor, type AvatarKey } from '@/lib/avatars';
import type { LatLng } from '@/lib/geo';
import { getAllPlayers, type Player, savePlayer } from '@/lib/player';
import { DEFAULT_LOCK_MS, readPasscode, setPasscode } from '@/lib/passcode';

const TOTAL_STEPS = 3;

// Shown over the map to anyone who has no player row yet (a first visit, or after an admin removed the player).
// Three steps: 1) pick an animal, which gives the nickname; 2) a 4-digit passcode and when it locks (skippable);
// 3) suggest saving the map for offline use (skippable, and it can be done later from the profile).
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
  // A passcode already kept in this browser is used as it is; the step is not asked again.
  const [passcodeDone, setPasscodeDone] = useState(() => typeof window !== 'undefined' && readPasscode(window.localStorage) !== null);
  const [passcodeStage, setPasscodeStage] = useState<'offer' | 'code' | 'time'>('offer');
  const [draftPin, setDraftPin] = useState<string | null>(null);
  const [lockMs, setLockMs] = useState(DEFAULT_LOCK_MS);

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

  async function finishPasscode() {
    if (draftPin) await setPasscode(window.localStorage, draftPin, lockMs);
    setPasscodeDone(true);
  }

  const step: 'nickname' | 'passcode' | 'map' = !player ? 'nickname' : passcodeDone ? 'map' : 'passcode';
  const stepNumber = step === 'nickname' ? 1 : step === 'passcode' ? 2 : 3;

  return (
    // Onboarding is a sequence of full-page screens: no blurred map, no sheet.
    <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-[var(--page)]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step === 'passcode' ? `passcode-${passcodeStage}` : step}
          initial={{ x: 90, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -90, opacity: 0 }}
          transition={{ type: 'spring', visualDuration: 0.4, bounce: 0.1 }}
          className="min-h-dvh px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
        >
          <div className="mx-auto max-w-md">
            <StepDots current={stepNumber} total={TOTAL_STEPS} />

            {step === 'map' && (
              <>
                <p className="mt-5 text-[34px] leading-none" aria-hidden>🎉</p>
                <h2 className="dl-title mt-3 text-3xl">Майже готово</h2>
                <div className="mt-6">
                  <OfflineMap points={points} variant="prompt" onDone={onFinish} onLater={onFinish} />
                </div>
              </>
            )}

            {step === 'passcode' && passcodeStage === 'offer' && (
              <>
                <p className="mt-5 text-[34px] leading-none" aria-hidden>🔐</p>
                <h2 className="dl-title mt-3 text-3xl">Код-пароль</h2>
                <p className="mt-2 text-[15px] leading-snug text-[var(--muted)]">Захистіть застосунок 4 цифрами. Код знає лише ваш телефон.</p>
                <div role="radiogroup" aria-label="Код-пароль" className="mt-6 flex flex-col gap-3">
                  <button type="button" role="radio" aria-checked="true" onClick={() => setPasscodeStage('code')} className="flex min-h-[64px] items-center justify-between rounded-2xl border-2 border-[var(--green)] bg-[var(--paper)] px-4 text-left">
                    <span>
                      <span className="block text-[16px] font-bold">Увімкнути код</span>
                      <span className="block text-[13px] text-[var(--muted)]">Рекомендуємо</span>
                    </span>
                    <span aria-hidden className="text-[20px] font-extrabold text-[var(--green-deep)]">✓</span>
                  </button>
                  <button type="button" role="radio" aria-checked="false" onClick={() => setPasscodeDone(true)} className="flex min-h-[64px] items-center rounded-2xl border-2 border-[var(--line)] bg-[var(--paper)] px-4 text-left">
                    <span className="block text-[16px] font-bold">Не зараз</span>
                  </button>
                </div>
              </>
            )}
            {step === 'passcode' && passcodeStage === 'code' && (
              <>
                <BackButton label="Назад" onClick={() => setPasscodeStage('offer')} className="mb-4" />
                <p className="mt-5 text-[34px] leading-none" aria-hidden>🔐</p>
                <h2 className="dl-title mt-3 text-3xl">Код-пароль</h2>
                <p className="mt-2 text-[15px] leading-snug text-[var(--muted)]">
                  Захистіть застосунок 4 цифрами. Код знає лише ваш телефон.
                </p>
                <div className="mt-6">
                  <PasscodeSetup
                    onSet={(pin) => {
                      setDraftPin(pin);
                      setPasscodeStage('time');
                    }}
                  />
                </div>
              </>
            )}

            {step === 'passcode' && passcodeStage === 'time' && (
              <>
                <BackButton label="Назад до коду" onClick={() => setPasscodeStage('code')} className="mt-4" />
                <p className="mt-4 text-[34px] leading-none" aria-hidden>⏱️</p>
                <h2 className="dl-title mt-3 text-3xl">Коли просити код?</h2>
                <p className="mt-2 text-[15px] leading-snug text-[var(--muted)]">
                  Коли застосунок має знову просити код?
                </p>
                <div className="mt-6">
                  <LockPicker value={lockMs} onChange={setLockMs} />
                </div>
                <button type="button" onClick={() => void finishPasscode()} className="dl-btn mt-6">
                  Готово
                </button>
              </>
            )}

            {step === 'nickname' && (
              <>
                <p className="mt-5 text-[34px] leading-none" aria-hidden>🐾</p>
                <h2 className="dl-title mt-3 text-3xl">Оберіть свій нік</h2>
                <p className="mt-2 text-[15px] leading-snug text-[var(--muted)]">Оберіть тварину. Її ім’я стане вашим ніком.</p>
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
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// The steps, shown as bars; the steps reached so far are filled.
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div role="img" aria-label={`Крок ${current} з ${total}`} className="flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1.5 flex-1 rounded-full ${i < current ? 'bg-[var(--green)]' : 'bg-[var(--line)]'}`} />
      ))}
    </div>
  );
}
