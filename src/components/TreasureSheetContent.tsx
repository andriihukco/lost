'use client';

import { useEffect, useState } from 'react';
import { isFoundable, type LatLng } from '@/lib/geo';
import { bearingDeg, formatDistance } from '@/lib/geoFormat';
import { markFound, type FoundStatus } from '@/lib/found';
import { PHOTO_BUCKET } from '@/lib/treasures';
import { supabase } from '@/lib/supabase';
import type { Treasure } from '@/lib/useTreasures';

type Props = {
  treasure: Treasure;
  pos: LatLng | null;
  accuracy: number | null;
  distanceM: number | null;
  onResult: (status: FoundStatus) => void;
};

const MESSAGES: Record<FoundStatus, string> = {
  won: 'Знахідку підтверджено! Скарб знято з карти.',
  taken: 'Скарб уже знайдено іншим гравцем',
  not_player: 'Спочатку оберіть імʼя й тварину',
  not_found: 'Скарб не знайдено',
};

export default function TreasureSheetContent({ treasure, pos, accuracy, distanceM, onResult }: Props) {
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false); // spoiler: photo stays blurred until tapped
  const [manual, setManual] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (treasure.photo_paths.length === 0) {
      setPhotoUrls([]);
      return;
    }
    Promise.all(
      treasure.photo_paths.map((path) =>
        supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600).then(({ data }) => data?.signedUrl ?? null),
      ),
    ).then((urls) => {
      if (!cancelled) setPhotoUrls(urls.filter((u): u is string => u !== null));
    });
    return () => { cancelled = true; };
  }, [treasure.photo_paths]);

  const bearing = pos ? bearingDeg(pos, { lat: treasure.lat, lng: treasure.lng }) : null;
  const canConfirm = distanceM !== null && isFoundable(distanceM, accuracy);

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

      {photoUrls.length > 0 && (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          aria-label={revealed ? 'Фото підказки' : 'Показати фото підказки'}
          className="relative flex gap-2 overflow-x-auto rounded-2xl"
        >
          {photoUrls.map((url, i) => (
            <img
              key={url}
              src={url}
              alt={`Підказка ${i + 1}`}
              style={{ filter: revealed ? 'none' : 'blur(22px)' }}
              className="h-48 w-auto max-w-[80%] shrink-0 rounded-2xl object-cover transition-[filter] duration-300"
            />
          ))}
          {!revealed && (
            <span className="absolute inset-0 grid place-items-center rounded-2xl bg-black/20 text-sm font-semibold text-white">
              Торкніться, щоб показати
            </span>
          )}
        </button>
      )}

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-neutral-500">Відстань</dt>
          <dd className="text-2xl font-bold tabular-nums">{distanceM !== null ? formatDistance(distanceM) : '—'}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Напрямок</dt>
          <dd className="flex items-center gap-2">
            <span aria-hidden className="inline-grid h-8 w-8 place-items-center rounded-full bg-neutral-200" style={{ transform: `rotate(${bearing ?? 0}deg)` }}>↑</span>
            <span className="text-neutral-500">{pos ? 'до скарбу' : 'чекаємо на GPS'}</span>
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-neutral-500">Місце</dt>
          <dd className="selectable tabular-nums">{treasure.lat.toFixed(5)}, {treasure.lng.toFixed(5)}</dd>
        </div>
      </dl>

      {message && <p role="status" className="text-sm font-medium">{message}</p>}

      {!manual ? (
        <>
          <button
            type="button"
            disabled={!canConfirm || busy}
            onClick={() => void confirm()}
            className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-40"
          >
            Підтвердити знахідку
          </button>
          {!canConfirm && <p className="text-xs text-neutral-500">Підійдіть ближче, щоб підтвердити (до 15 м з урахуванням GPS).</p>}
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
