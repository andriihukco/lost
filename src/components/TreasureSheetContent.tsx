'use client';

import { useEffect, useState } from 'react';
import { haversineM, isFoundable, type LatLng } from '@/lib/geo';
import { bearingDeg, formatDistance } from '@/lib/geoFormat';
import { markFound, type FoundStatus } from '@/lib/found';
import { PHOTO_BUCKET } from '@/lib/treasures';
import { supabase } from '@/lib/supabase';
import type { Treasure } from '@/lib/useTreasures';

type Props = {
  treasure: Treasure;
  pos: LatLng | null;
  accuracy: number | null;
  onResult: (status: FoundStatus) => void;
};

const MESSAGES: Record<FoundStatus, string> = {
  won: 'Знахідку підтверджено!',
  taken: 'Скарб уже знайдено',
  not_member: 'Немає доступу до скарбу',
};

export default function TreasureSheetContent({ treasure, pos, accuracy, onResult }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const first = treasure.photo_paths[0];
    if (!first) {
      setPhotoUrl(null);
      return;
    }
    supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(first, 3600)
      .then(({ data }) => {
        if (!cancelled) setPhotoUrl(data?.signedUrl ?? null);
      });
    return () => { cancelled = true; };
  }, [treasure.photo_paths]);

  const here = pos ? { lat: treasure.lat, lng: treasure.lng } : null;
  const distance = pos && here ? haversineM(pos, here) : null;
  const bearing = pos && here ? bearingDeg(pos, here) : null;
  const canConfirm = !treasure.is_found && distance !== null && isFoundable(distance, accuracy);

  async function confirm(manualNote?: string) {
    setBusy(true);
    setMessage(null);
    try {
      const status = await markFound(treasure.id, manualNote);
      if (status === 'won') navigator.vibrate?.(15);
      onResult(status);
      setMessage(MESSAGES[status]);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 p-5">
      <header>
        <h2 className="text-2xl font-bold leading-[1.1] tracking-[-0.02em]">{treasure.title}</h2>
        {treasure.hint && <p className="selectable mt-1 text-neutral-600">{treasure.hint}</p>}
      </header>

      {photoUrl && (
        <img src={photoUrl} alt="Підказка" className="max-h-64 w-full rounded-2xl object-cover" />
      )}

      <div className="flex items-center gap-4">
        <div
          aria-hidden
          className="grid h-12 w-12 place-items-center rounded-full bg-neutral-200"
          style={{ transform: `rotate(${bearing ?? 0}deg)` }}
        >
          ↑
        </div>
        <div>
          <p className="text-3xl font-bold tracking-[-0.02em] tabular-nums">
            {distance !== null ? formatDistance(distance) : '—'}
          </p>
          <p className="text-sm text-neutral-500">{pos ? 'до скарбу' : 'Чекаємо на GPS'}</p>
        </div>
      </div>

      {treasure.is_found && !message && <p className="text-sm font-medium text-neutral-500">Скарб уже знайдено</p>}
      {message && <p role="status" className="text-sm font-medium">{message}</p>}

      {treasure.is_found ? null : !manual ? (
        <>
          <button
            type="button"
            disabled={!canConfirm || busy}
            onClick={() => void confirm()}
            className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-40"
          >
            Підтвердити знахідку
          </button>
          <button type="button" onClick={() => setManual(true)} className="text-sm text-blue-600">
            Підтвердити вручну
          </button>
        </>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim()) void confirm(note.trim());
          }}
        >
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Що ви бачите біля скарбу?"
            maxLength={200}
            className="rounded-xl bg-white/80 px-4 py-3 text-[16px] outline-none ring-1 ring-black/10"
          />
          <button type="submit" disabled={!note.trim() || busy}
            className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-40">
            Підтвердити вручну
          </button>
        </form>
      )}
    </section>
  );
}
