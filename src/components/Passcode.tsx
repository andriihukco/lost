'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import BackButton from '@/components/BackButton';
import { checkPin, DEFAULT_LOCK_MS, LOCK_OPTIONS, PIN_LENGTH, setPasscode } from '@/lib/passcode';

// The number pad, as on the iPhone's lock screen.
export function Keypad({ onDigit, onDelete, disabled = false }: { onDigit: (d: string) => void; onDelete: () => void; disabled?: boolean }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return (
    <div className="grid grid-cols-3 gap-4" role="group" aria-label="Цифри коду">
      {keys.map((k) => (
        <PadKey key={k} label={k} disabled={disabled} onPress={() => onDigit(k)} />
      ))}
      <span aria-hidden />
      <PadKey label="0" disabled={disabled} onPress={() => onDigit('0')} />
      <PadKey label="⌫" ariaLabel="Стерти" disabled={disabled} onPress={onDelete} small />
    </div>
  );
}

function PadKey({ label, ariaLabel, onPress, disabled, small = false }: { label: string; ariaLabel?: string; onPress: () => void; disabled: boolean; small?: boolean }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      onClick={onPress}
      className={`mx-auto grid h-[72px] w-[72px] place-items-center rounded-full bg-[var(--paper)] font-semibold text-[var(--ink)] elev-sm transition-transform active:scale-95 disabled:opacity-40 ${small ? 'text-[24px] text-[var(--muted)]' : 'text-[30px]'}`}
    >
      {label}
    </button>
  );
}

// The four dots that show how many digits are in.
export function PinDots({ filled }: { filled: number }) {
  return (
    <div className="flex gap-4" aria-label={`Введено ${filled} з ${PIN_LENGTH}`}>
      {Array.from({ length: PIN_LENGTH }, (_, i) => (
        <span key={i} className={`h-4 w-4 rounded-full border-2 transition-colors ${i < filled ? 'border-[var(--green)] bg-[var(--green)]' : 'border-[var(--muted)]'}`} />
      ))}
    </div>
  );
}

// The lock time, as a cell with one row per choice and a check on the chosen one.
export function LockPicker({ value, onChange }: { value: number; onChange: (ms: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Блокувати після" className="ios-group">
      {LOCK_OPTIONS.map((o, i) => {
        const on = o.ms === value;
        return (
          <button
            key={o.ms}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.ms)}
            className={`flex min-h-[52px] w-full items-center justify-between bg-[var(--paper)] px-4 text-left text-[16px] font-semibold ${i > 0 ? 'border-t border-[var(--line)]' : ''}`}
          >
            {o.label}
            {on && <span aria-hidden className="text-[18px] font-extrabold text-[var(--green-deep)]">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

// Choosing a new code: type it, then type it again. Used in onboarding and in the passcode settings.
export function PasscodeSetup({ onSet }: { onSet: (pin: string) => void }) {
  const [first, setFirst] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  function press(d: string) {
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setPin(next);
    setError(null);
    if (next.length < PIN_LENGTH) return;
    if (first === null) {
      setFirst(next);
      setPin('');
    } else if (next === first) {
      onSet(next);
    } else {
      setError('Коди не збігаються. Спробуйте ще раз.');
      setFirst(null);
      setPin('');
    }
  }

  return (
    <div className="flex flex-col items-center gap-7">
      <p className="text-center text-[17px] font-semibold">{first === null ? 'Придумайте код із 4 цифр' : 'Повторіть код'}</p>
      <PinDots filled={pin.length} />
      {error && <p role="alert" className="text-center text-[14px] font-semibold text-[var(--danger)]">{error}</p>}
      <Keypad onDigit={press} onDelete={() => setPin((p) => p.slice(0, -1))} />
    </div>
  );
}

// The lock screen: shown when the app opens with a code set, or after the app was left untouched for the chosen time.
// Five wrong codes in a row make it wait 30 seconds.
export function PasscodeLock({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [shake, setShake] = useState(0);
  const waiting = waitUntil > now;

  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [waiting]);

  async function press(d: string) {
    if (waiting || pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setPin(next);
    setError(null);
    if (next.length < PIN_LENGTH) return;
    if (await checkPin(window.localStorage, next)) {
      onUnlock();
      return;
    }
    const f = failures + 1;
    setFailures(f);
    setPin('');
    setShake((s) => s + 1);
    if (f % 5 === 0) {
      setWaitUntil(Date.now() + 30_000);
      setNow(Date.now());
      setError('Забагато спроб. Спробуйте за 30 секунд.');
    } else {
      setError('Невірний код');
    }
  }


  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-between bg-[var(--page)] px-6 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-[calc(env(safe-area-inset-top)+3rem)]">
      <div className="flex flex-col items-center gap-5 text-center">
        <span aria-hidden className="text-[56px] leading-none">🔐</span>
        <h1 className="dl-title text-[26px]">Введіть код</h1>
        <motion.div
          key={shake}
          animate={shake ? { x: [0, -12, 12, -8, 8, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <PinDots filled={pin.length} />
        </motion.div>
        <p role="alert" aria-live="assertive" className="min-h-[20px] text-[14px] font-semibold text-[var(--danger)]">{error}</p>
      </div>

      <Keypad onDigit={(d) => void press(d)} onDelete={() => setPin((p) => p.slice(0, -1))} disabled={waiting} />

    </div>
  );
}

// Required before the app opens: a player who has no code yet sets one here. There is no skip.
export function PasscodeRequired({ onDone }: { onDone: () => void }) {
  const [pin, setPin] = useState<string | null>(null);
  const [lockMs, setLockMs] = useState(DEFAULT_LOCK_MS);
  const [busy, setBusy] = useState(false);

  if (pin === null) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-[var(--page)] px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 pt-10">
          <span aria-hidden className="text-[56px] leading-none">🔐</span>
          <h1 className="dl-title text-center text-[28px]">Створіть код</h1>
          <p className="text-center text-[15px] text-[var(--muted)]">Чотири цифри. Без коду застосунок не відкриється.</p>
          <PasscodeSetup onSet={setPin} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-[var(--page)] px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <BackButton label="Назад" onClick={() => setPin(null)} />
        <h1 className="dl-title text-[28px]">Коли просити код?</h1>
        <LockPicker value={lockMs} onChange={setLockMs} />
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await setPasscode(window.localStorage, pin, lockMs);
            onDone();
          }}
          className="dl-btn"
        >
          Готово
        </button>
      </div>
    </div>
  );
}
