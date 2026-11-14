'use client';

import { useState } from 'react';
import { WELCOME_STEPS, type WelcomeStep } from '@/lib/welcome';
import type { HeadingStatus } from '@/lib/useHeading';

type Props = {
  compassStatus: HeadingStatus;
  onCompass: () => Promise<HeadingStatus>;
  onDone: () => void;
};

// First-run screen: what the app is for, then the two permissions it needs.
// Location is asked for here so the browser prompt is explained first.
export default function Welcome({ compassStatus, onCompass, onDone }: Props) {
  const [step, setStep] = useState<WelcomeStep>('intro');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const index = WELCOME_STEPS.indexOf(step);
  const next = () => {
    setNote(null);
    setStep(WELCOME_STEPS[index + 1] ?? 'compass');
  };

  function askLocation() {
    setBusy(true);
    setNote(null);
    if (!('geolocation' in navigator)) {
      setNote('Цей браузер не має геолокації. Карта працюватиме без неї.');
      setBusy(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => { setBusy(false); next(); },
      () => { setBusy(false); setNote('Геолокацію не дозволено. Ви зможете увімкнути її пізніше в налаштуваннях браузера.'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  async function askCompass() {
    setBusy(true);
    setNote(null);
    const result = await onCompass();
    setBusy(false);
    if (result === 'denied') setNote('Компас не дозволено. Напрямок показуватиметься за рухом GPS.');
    else onDone();
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[var(--page)] px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      <div className="flex justify-center gap-2 pt-2" aria-label={`Крок ${index + 1} з ${WELCOME_STEPS.length}`}>
        {WELCOME_STEPS.map((s, i) => (
          <span key={s} className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-[var(--green)]' : 'w-2 bg-[var(--line)]'}`} />
        ))}
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
        {step === 'intro' && (
          <Panel emoji="🍄" title="Ласкаво просимо до Lost" text="Шукайте схований скарби разом з друзями. Ходіть лісовими стежками, знаходьте гриби на мапі й відмічайте місця." />
        )}
        {step === 'location' && (
          <Panel emoji="📍" title="Геолокація" text="Щоб бачити відстань до скарбів і показувати на мапі, де ви. Інші гравці бачать ваше місце, поки ви в грі." />
        )}
        {step === 'compass' && (
          <Panel emoji="🧭" title="Компас" text="Щоб мапа показувала, куди ви дивитеся, і вказувала напрямок до скарбу. На iPhone браузер спитає дозвіл." />
        )}
        {note && <p role="status" className="mt-4 text-[15px] font-semibold text-[var(--danger)]">{note}</p>}
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col gap-3">
        {step === 'intro' && <button type="button" onClick={next} className="dl-btn">Далі</button>}
        {step === 'location' && (
          <>
            <button type="button" disabled={busy} onClick={askLocation} className="dl-btn">Дозволити геолокацію</button>
            <button type="button" onClick={next} className="min-h-[44px] text-[16px] font-bold text-[var(--muted)]">Пізніше</button>
          </>
        )}
        {step === 'compass' && (
          compassStatus === 'needs-permission' ? (
            <>
              <button type="button" disabled={busy} onClick={() => void askCompass()} className="dl-btn">Дозволити компас</button>
              <button type="button" onClick={onDone} className="min-h-[44px] text-[16px] font-bold text-[var(--muted)]">Пропустити</button>
            </>
          ) : (
            <button type="button" onClick={onDone} className="dl-btn">Почати гру</button>
          )
        )}
      </div>
    </div>
  );
}

function Panel({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <>
      <span className="grid h-32 w-32 place-items-center rounded-full border-[3px] border-[var(--green)] bg-[var(--paper)] text-6xl shadow-[0_6px_0_var(--green-deep)]">{emoji}</span>
      <h1 className="dl-title mt-8 text-[34px]">{title}</h1>
      <p className="mt-4 text-[17px] leading-relaxed text-[var(--muted)]">{text}</p>
    </>
  );
}
