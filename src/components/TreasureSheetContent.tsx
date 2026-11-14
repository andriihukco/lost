'use client';

import { useEffect, useState } from 'react';
import { isFoundable, haversineM, type LatLng } from '@/lib/geo';
import { bearingDeg, cardinal, formatDistance } from '@/lib/geoFormat';
import { hasArrived, markArrived } from '@/lib/arrival';
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

const ERROR_TEXT: Record<Exclude<FoundStatus, 'won'>, string> = {
  taken: 'Цей скарб уже знайшов інший гравець.',
  not_player: 'Спочатку оберіть імʼя й тварину.',
  not_found: 'Скарб не знайдено.',
};

// Two steps: "Я знайшов місце" (you are at the spot), then "Я знайшов скарб" (you have the treasure).
export default function TreasureSheetContent({ treasure, pos, accuracy, distanceM, onResult }: Props) {
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false); // spoiler: stays blurred until tapped
  const [arrived, setArrived] = useState(false);
  const [manual, setManual] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setArrived(hasArrived(window.localStorage, treasure.id));
    } catch {
      setArrived(false);
    }
  }, [treasure.id]);

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

  const canArrive = distanceM !== null && isFoundable(distanceM, accuracy);
  const direction = pos ? cardinal(bearingDeg(pos, { lat: treasure.lat, lng: treasure.lng })) : null;

  function arrive() {
    try {
      markArrived(window.localStorage, treasure.id);
    } catch {
      // storage blocked; the state below still moves the player on
    }
    setArrived(true);
    setError(null);
  }

  async function confirm(manualNote?: string) {
    setBusy(true);
    setError(null);
    try {
      const status = await markFound(treasure.id, manualNote);
      if (status === 'won') {
        navigator.vibrate?.(15);
        onResult(status);
      } else {
        setError(ERROR_TEXT[status]);
        onResult(status);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const bigButton =
    'w-full rounded-2xl px-4 py-4 text-lg font-semibold text-white shadow-sm disabled:opacity-40';

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
              className="h-44 w-auto max-w-[80%] shrink-0 rounded-2xl object-cover transition-[filter] duration-300"
            />
          ))}
          {!revealed && (
            <span className="absolute inset-0 grid place-items-center rounded-2xl bg-black/20 text-sm font-semibold text-white">
              Торкніться, щоб показати
            </span>
          )}
        </button>
      )}

      <div className="rounded-2xl bg-neutral-100 px-4 py-3">
        <p className="text-sm text-neutral-500">До місця</p>
        <p className="text-4xl font-bold tabular-nums tracking-[-0.02em]">
          {distanceM !== null ? formatDistance(distanceM) : '—'}
        </p>
        <p className="text-sm text-neutral-600">
          {!pos ? 'Чекаємо на GPS' : direction ? `на ${direction}` : ''}
        </p>
      </div>

      {!arrived ? (
        <>
          <p className="text-sm text-neutral-600">
            {canArrive ? 'Ви біля місця. Натисніть, коли побачите його.' : 'Підійдіть ближче, щоб відмітити місце (до 15 м).'}
          </p>
          <button type="button" disabled={!canArrive || busy} onClick={arrive} className={`${bigButton} bg-blue-600`}>
            Я знайшов місце
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-neutral-600">Ви на місці. Знайдіть скарб і підтвердіть.</p>
          <button type="button" disabled={busy} onClick={() => void confirm()} className={`${bigButton} bg-green-600`}>
            Я знайшов скарб
          </button>
        </>
      )}

      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}

      {!manual ? (
        <button type="button" onClick={() => setManual(true)} className="self-center text-sm text-neutral-500">
          GPS не працює? Підтвердити вручну
        </button>
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
            className="rounded-xl bg-white px-4 py-3 text-[16px] outline-none ring-1 ring-black/10"
          />
          <button type="submit" disabled={!note.trim() || busy} className="rounded-xl bg-neutral-800 px-4 py-3 font-semibold text-white disabled:opacity-40">
            Підтвердити вручну
          </button>
        </form>
      )}

      <p className="selectable text-center text-xs text-neutral-400 tabular-nums">
        {treasure.lat.toFixed(5)}, {treasure.lng.toFixed(5)}
      </p>
    </section>
  );
}
