'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import type { IconName } from '@/components/iconPaths';
import { compassPermOf, firstGateStep } from '@/lib/entryGate';
import { rememberGrant } from '@/lib/grants';
import { WELCOME_STEPS, type WelcomeStep } from '@/lib/welcome';
import type { HeadingStatus } from '@/lib/useHeading';

type Props = {
  start: WelcomeStep;
  compassStatus: HeadingStatus;
  onCompass: () => Promise<HeadingStatus>;
  onDone: () => void;
};

// Entry gate. The map opens only after location and compass are granted (or the device has no compass).
// There is no skip: a refused permission shows how to allow it and a retry button.
export default function Welcome({ start, compassStatus, onCompass, onDone }: Props) {
  const [step, setStep] = useState<WelcomeStep>(start);
  const [blocked, setBlocked] = useState<'location' | 'compass' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const index = WELCOME_STEPS.indexOf(step);

  function askLocation() {
    setBusy(true);
    setNote(null);
    if (!('geolocation' in navigator)) {
      setBusy(false);
      setBlocked('location');
      setNote('Цей браузер не підтримує геолокацію. Без неї гра неможлива.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        rememberGrant(window.localStorage, 'location');
        setBusy(false);
        setBlocked(null);
        // After location, the compass is next only if it still needs a tap; otherwise the player is in.
        if (firstGateStep(true, 'granted', compassPermOf(compassStatus)) === null) onDone();
        else setStep('compass');
      },
      () => {
        setBusy(false);
        setBlocked('location');
        setNote('Геолокацію заблоковано. Дозвольте доступ до місцезнаходження в налаштуваннях браузера, а потім натисніть «Спробувати ще раз».');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  async function askCompass() {
    setBusy(true);
    setNote(null);
    const result = await onCompass();
    setBusy(false);
    if (firstGateStep(true, 'granted', compassPermOf(result)) === null) {
      if (result === 'listening') rememberGrant(window.localStorage, 'compass');
      setBlocked(null);
      onDone();
    } else {
      setBlocked('compass');
      setNote('Доступ до руху й орієнтації заблоковано. На iPhone: Налаштування → Safari → Рух і орієнтація. Потім натисніть «Спробувати ще раз».');
    }
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
          <Panel icon="travel_explore" title="Ласкаво просимо до Lost" text="Шукайте сховані скарби разом із друзями. Ходіть лісовими стежками, знаходьте скарби на карті й відмічайте місця." />
        )}
        {step === 'location' && (
          <Panel icon="location_on" title="Геолокація" text="Щоб бачити відстань до скарбів і показувати на карті, де ви. Інші гравці бачать ваше місце, поки ви в грі." />
        )}
        {step === 'compass' && (
          <Panel icon="explore" title="Компас" text="Щоб карта показувала, куди ви дивитеся, і вказувала напрямок до скарбу. На iPhone браузер запитає дозвіл." />
        )}
        {note && <p role="alert" className="mt-4 text-[15px] font-semibold text-[var(--danger)]">{note}</p>}
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col gap-3">
        {step === 'intro' && <button type="button" onClick={() => setStep('location')} className="dl-btn">Далі</button>}
        {step === 'location' && (
          <button type="button" disabled={busy} onClick={askLocation} className="dl-btn">
            {blocked === 'location' ? 'Спробувати ще раз' : 'Дозволити геолокацію'}
          </button>
        )}
        {step === 'compass' && (
          <button type="button" disabled={busy} onClick={() => void askCompass()} className="dl-btn">
            {blocked === 'compass' ? 'Спробувати ще раз' : 'Дозволити компас'}
          </button>
        )}
      </div>
    </div>
  );
}

function Panel({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <>
      <span className="grid h-32 w-32 place-items-center rounded-full border-[3px] border-[var(--green)] bg-[var(--paper)] text-[var(--green-deep)] elev-md">
        <Icon name={icon} size={64} />
      </span>
      <h1 className="dl-title mt-8 text-[34px]">{title}</h1>
      <p className="mt-4 text-[17px] leading-relaxed text-[var(--muted)]">{text}</p>
    </>
  );
}
