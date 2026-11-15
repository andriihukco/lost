'use client';

import { useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { compassPermOf, firstGateStep } from '@/lib/entryGate';
import { rememberGrant } from '@/lib/grants';
import { WELCOME_STEPS, type WelcomeStep } from '@/lib/welcome';
import type { HeadingStatus } from '@/lib/useHeading';

type Slide = { id: string; emoji: string; title: string; text: string; permission?: 'location' | 'compass' };

// The slides, in order. The two permission slides ask for location and compass; the others only explain.
const SLIDES: Slide[] = [
  {
    id: 'hello',
    emoji: '🌲',
    title: 'Ласкаво просимо до Lost',
    text: 'Шукайте сховані скарби разом із друзями. Ходіть лісовими стежками й знаходьте їх.',
  },
  {
    id: 'map',
    emoji: '🗺️',
    title: 'Карта — ваш путівник',
    text: 'На карті видно скарби, мітки небезпек і інших гравців. Коли дійдете до місця, відмітьте його.',
  },
  {
    id: 'location',
    emoji: '📍',
    title: 'Геолокація',
    text: 'Щоб бачити відстань до скарбів і показувати ваше місце на карті. Інші гравці бачать його, поки ви в грі.',
    permission: 'location',
  },
  {
    id: 'compass',
    emoji: '🧭',
    title: 'Компас',
    text: 'Щоб карта показувала, куди ви дивитеся, і вказувала напрямок до скарбу. На iPhone браузер запитає дозвіл.',
    permission: 'compass',
  },
];

// Where a player starts: a first visit at the beginning, a returning player at the permission they still owe.
const START: Record<WelcomeStep, number> = { intro: 0, location: 2, compass: 3 };

type Props = {
  start: WelcomeStep;
  compassStatus: HeadingStatus;
  onCompass: () => Promise<HeadingStatus>;
  onDone: () => void;
};

// Entry gate. The map opens only after location and compass are granted (or the device has no compass).
// There is no skip: a refused permission shows how to allow it and a retry button. The player can go back and
// forth between the slides; the dots jump to any slide already reached.
export default function Welcome({ start, compassStatus, onCompass, onDone }: Props) {
  const [index, setIndex] = useState(START[start]);
  const [reached, setReached] = useState(START[start]); // the furthest slide shown so far
  const [dir, setDir] = useState(1); // +1 moving forward, -1 moving back: the slide comes in from that side
  const [blocked, setBlocked] = useState<'location' | 'compass' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const slide = SLIDES[index];

  function goTo(i: number) {
    if (busy || i < 0 || i >= SLIDES.length || i > reached) return;
    setDir(i > index ? 1 : -1);
    setIndex(i);
    setNote(null);
    setBlocked(null);
    setReached((r) => Math.max(r, i));
  }

  // A swipe moves between slides; the permission slides are left by their button only.
  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -60 && !slide.permission) goTo(index + 1);
    else if (info.offset.x > 60) goTo(index - 1);
  }

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
        // After location, the compass slide comes next only if the compass still needs a tap; otherwise the player is in.
        if (firstGateStep(true, 'granted', compassPermOf(compassStatus)) === null) onDone();
        else goTo(3);
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

  const canBack = index > 0 && !busy;
  const primary = slide.permission === 'location'
    ? { label: blocked === 'location' ? 'Спробувати ще раз' : 'Дозволити геолокацію', run: askLocation }
    : slide.permission === 'compass'
      ? { label: blocked === 'compass' ? 'Спробувати ще раз' : 'Дозволити компас', run: () => void askCompass() }
      : { label: 'Далі', run: () => goTo(index + 1) };

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-[var(--page)] px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)]">
      <p className="text-center text-[13px] font-bold uppercase tracking-wider text-[var(--muted)]" aria-live="polite">
        Крок {index + 1} з {SLIDES.length}
      </p>

      <div className="relative mx-auto flex w-full max-w-md flex-1 items-center justify-center">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={slide.id}
            custom={dir}
            variants={{
              enter: (d: number) => ({ x: d > 0 ? 90 : -90, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d > 0 ? -90 : 90, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', visualDuration: 0.4, bounce: 0.12 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragEnd={onDragEnd}
            className="flex w-full flex-col items-center text-center"
          >
            <motion.span
              aria-hidden
              initial={{ scale: 0.6, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', visualDuration: 0.5, bounce: 0.35 }}
              className="grid h-36 w-36 place-items-center rounded-full border-[3px] border-[var(--green)] bg-[var(--paper)] text-[76px] leading-none elev-md"
            >
              {slide.emoji}
            </motion.span>
            <h1 className="dl-title mt-8 text-[32px]">{slide.title}</h1>
            <p className="mt-4 text-[17px] leading-relaxed text-[var(--muted)]">{slide.text}</p>
            {note && <p role="alert" className="mt-4 text-[15px] font-semibold text-[var(--danger)]">{note}</p>}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={!canBack}
            className={`min-h-[44px] w-20 text-left text-[16px] font-bold text-[var(--muted)] ${index === 0 ? 'invisible' : ''}`}
          >
            Назад
          </button>
          <div role="tablist" aria-label="Слайди" className="flex items-center gap-2">
            {SLIDES.map((s, i) => {
              const open = i <= reached;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Слайд ${i + 1}: ${s.title}`}
                  disabled={!open || i === index || busy}
                  onClick={() => goTo(i)}
                  className="grid h-6 place-items-center disabled:cursor-default"
                >
                  <motion.span
                    animate={{ width: i === index ? 24 : 8, opacity: open ? 1 : 0.5 }}
                    transition={{ type: 'spring', visualDuration: 0.3, bounce: 0 }}
                    className={`block h-2 rounded-full ${i === index ? 'bg-[var(--green)]' : open ? 'bg-[var(--green-soft)]' : 'bg-[var(--line)]'}`}
                  />
                </button>
              );
            })}
          </div>
          <span aria-hidden className="w-20" />
        </div>

        <button type="button" disabled={busy} onClick={primary.run} className="dl-btn">
          {primary.label}
        </button>
      </div>
    </div>
  );
}
