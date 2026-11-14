'use client';

import { useEffect, useState } from 'react';
import { isFoundable, type LatLng } from '@/lib/geo';
import { bearingDeg, cardinal, formatDistance } from '@/lib/geoFormat';
import { relativeBearing } from '@/lib/heading';
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
  heading: number | null;
  onResult: (status: FoundStatus) => void;
  onRoute?: () => void; // build a walking route to this treasure
};

const ERROR_TEXT: Record<Exclude<FoundStatus, 'won'>, string> = {
  taken: 'Цей скарб уже знайшов інший гравець.',
  not_player: 'Спочатку оберіть імʼя й тварину.',
  not_found: 'Скарб не знайдено.',
};

// Two steps: "Я знайшов місце" (you are at the spot), then "Я знайшов скарб" (you have the treasure).
export default function TreasureSheetContent({ treasure, pos, accuracy, distanceM, heading, onResult, onRoute }: Props) {
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
  const bearing = pos ? bearingDeg(pos, { lat: treasure.lat, lng: treasure.lng }) : null;
  const direction = bearing !== null ? cardinal(bearing) : null;
  // The arrow points at the treasure from where the player faces (needs a compass or GPS course).
  const arrowDeg = bearing !== null ? relativeBearing(bearing, heading) : null;

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
      if (status === 'won') navigator.vibrate?.(15);
      else setError(ERROR_TEXT[status]);
      onResult(status);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 pb-6">
      <header>
        <h2 className="dl-title text-3xl">{treasure.title}</h2>
        {treasure.hint && <p className="selectable mt-2 text-base text-[var(--muted)]">{treasure.hint}</p>}
      </header>

      {photoUrls.length > 0 && (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          aria-label={revealed ? 'Фото підказки' : 'Показати фото підказки'}
          className="relative flex gap-2 overflow-x-auto rounded-[20px] border-2 border-[var(--line)]"
        >
          {photoUrls.map((url, i) => (
            <img
              key={url}
              src={url}
              alt={`Підказка ${i + 1}`}
              style={{ filter: revealed ? 'none' : 'blur(22px)' }}
              className="h-44 w-auto max-w-[80%] shrink-0 rounded-[18px] object-cover transition-[filter] duration-300"
            />
          ))}
          {!revealed && (
            <span className="absolute inset-0 grid place-items-center rounded-[18px] bg-[var(--ink)] text-sm font-bold text-white">
              Натисніть, щоб показати
            </span>
          )}
        </button>
      )}

      <div className="dl-card flex items-center gap-4 p-4">
        <span
          aria-hidden
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--green-soft)] text-2xl font-black text-[var(--green-deep)]"
          style={arrowDeg !== null ? { transform: `rotate(${arrowDeg}deg)` } : undefined}
        >
          {arrowDeg !== null ? '↑' : '•'}
        </span>
        <div className="min-w-0">
          <p className="dl-label">До місця</p>
          <p className="text-4xl font-black tabular-nums tracking-tight">{distanceM !== null ? formatDistance(distanceM) : '—'}</p>
          <p className="text-sm font-semibold text-[var(--muted)]">
            {!pos ? 'Чекаємо на GPS' : direction ? `на ${direction}${heading === null ? ' · компас вимкнено' : ''}` : ''}
          </p>
        </div>
      </div>

      {!arrived ? (
        <>
          <p className="text-sm font-semibold text-[var(--muted)]">
            {canArrive ? 'Ви біля місця. Натисніть, коли побачите його.' : 'Підійдіть ближче, щоб відмітити місце (до 15 м).'}
          </p>
          <button type="button" disabled={!canArrive || busy} onClick={arrive} className="dl-btn">
            Я знайшов місце
          </button>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-[var(--muted)]">Ви на місці. Знайдіть скарб і підтвердіть.</p>
          <button type="button" disabled={busy} onClick={() => void confirm()} className="dl-btn">
            Я знайшов скарб
          </button>
        </>
      )}

      {onRoute && (
        <button type="button" disabled={!pos} onClick={onRoute} className="dl-btn-secondary">
          {pos ? 'Маршрут сюди' : 'Потрібен GPS для маршруту'}
        </button>
      )}

      {error && <p role="alert" className="text-sm font-bold text-[var(--danger)]">{error}</p>}

      {!manual ? (
        <button type="button" onClick={() => setManual(true)} className="self-center text-sm font-bold text-[var(--muted)] underline">
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
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Що ви бачите біля скарбу?" maxLength={200} className="dl-field" />
          <button type="submit" disabled={!note.trim() || busy} className="dl-btn-secondary">
            Підтвердити вручну
          </button>
        </form>
      )}

      <p className="selectable text-center text-xs font-semibold tabular-nums text-[var(--muted)]">
        {treasure.lat.toFixed(5)}, {treasure.lng.toFixed(5)}
      </p>
    </section>
  );
}
