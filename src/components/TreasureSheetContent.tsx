'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import CameraOverlay from '@/components/CameraOverlay';
import Icon from '@/components/Icon';
import { isFoundable, type LatLng } from '@/lib/geo';
import { bearingDeg, cardinal, formatDistance } from '@/lib/geoFormat';
import { relativeBearing } from '@/lib/heading';
import { hasArrived, markArrived } from '@/lib/arrival';
import { markFound, markPlace, type FoundStatus } from '@/lib/found';
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
  not_player: 'Спочатку оберіть імʼя й тотем.',
  not_found: 'Скарб не знайдено.',
};

// The treasure view, top to bottom: photo, distance, hint, secondary actions, then the one primary action,
// which stays pinned at the bottom. Two steps: "Я знайшов місце" (at the spot), then "Я знайшов скарб".
export default function TreasureSheetContent({ treasure, pos, accuracy, distanceM, heading, onResult, onRoute }: Props) {
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false); // the photo stays blurred until tapped
  const [arrived, setArrived] = useState(false);
  const [manual, setManual] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);

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
    // The first-to-the-place point for the leaderboard; a failure here never blocks the player.
    void markPlace(treasure.id).catch(() => {});
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

  const status = arrived
    ? 'Ви на місці. Знайдіть скарб і підтвердіть.'
    : canArrive
      ? 'Ви біля місця. Натисніть, коли побачите його.'
      : 'Підійдіть ближче, щоб відмітити місце (до 15 м).';
  const secondaryCount = (onRoute ? 1 : 0) + (photoUrls.length > 0 ? 1 : 0);

  return (
    <section className="mx-auto flex min-h-full w-full max-w-md flex-col gap-4 px-5 pt-1">
      {photoUrls.length > 0 && (
        <div className="relative overflow-hidden rounded-[24px] bg-[var(--line)] elev-sm">
          <div className="flex snap-x snap-mandatory overflow-x-auto" style={{ touchAction: 'pan-x' }}>
            {photoUrls.map((url, i) => {
              const image = (
                <img
                  src={url}
                  alt={`Підказка ${i + 1}`}
                  style={{ filter: revealed ? 'none' : 'blur(24px)' }}
                  className="h-56 w-full object-cover transition-[filter] duration-300"
                />
              );
              return (
                <div key={url} className="h-56 w-full shrink-0 snap-center">
                  {revealed ? (
                    // Revealed photos open at full size in a new tab.
                    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Відкрити фото ${i + 1} повністю у новій вкладці`} className="block h-full w-full">
                      {image}
                    </a>
                  ) : (
                    image
                  )}
                </div>
              );
            })}
          </div>
          {!revealed && (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="absolute inset-0 grid place-items-center bg-[var(--ink)]/25"
            >
              <span className="rounded-full bg-[var(--paper)] px-5 py-2.5 text-[15px] font-bold text-[var(--ink)] elev-md">Показати фото</span>
            </button>
          )}
          {revealed && photoUrls.length > 1 && (
            <span className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-bold text-white">
              {photoUrls.length} фото · гортайте
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 rounded-[24px] bg-[var(--paper)] p-4 elev-sm">
        <span aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--green-soft)] text-[var(--green-deep)]">
          <span style={arrowDeg !== null ? { transform: `rotate(${arrowDeg}deg)`, display: 'grid' } : undefined}>
            <Icon name={arrowDeg !== null ? 'navigation' : 'location_searching'} filled size={28} />
          </span>
        </span>
        <div className="min-w-0">
          <p className="dl-label">До місця</p>
          <p className="mt-0.5 text-[40px] font-black leading-none tabular-nums tracking-tight">
            {distanceM !== null ? formatDistance(distanceM) : '—'}
          </p>
          <p className="mt-1 text-[15px] font-semibold text-[var(--muted)]">
            {!pos ? 'Чекаємо на GPS' : direction ? `на ${direction}` : ''}
          </p>
        </div>
      </div>

      {treasure.hint && (
        <div className="rounded-[24px] bg-[var(--paper)] p-4 elev-sm">
          <p className="dl-label">Підказка</p>
          <p className="selectable mt-1.5 text-[17px] leading-snug">{treasure.hint}</p>
        </div>
      )}

      {secondaryCount > 0 && (
        <div className={`grid gap-3 ${secondaryCount === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {onRoute && (
            <button type="button" disabled={!pos} onClick={onRoute} className="dl-btn-secondary">
              <span className="inline-flex items-center justify-center gap-2">
                <Icon name="route" size={22} />
                Маршрут
              </span>
            </button>
          )}
          {photoUrls.length > 0 && (
            <button type="button" onClick={() => setCamera(true)} className="dl-btn-secondary">
              <span className="inline-flex items-center justify-center gap-2">
                <Icon name="photo_camera" size={22} />
                Камера
              </span>
            </button>
          )}
        </div>
      )}
      {/* Portal: the modal's transform would otherwise trap the full-screen camera inside it. */}
      {camera && createPortal(<CameraOverlay photoUrls={photoUrls} onClose={() => setCamera(false)} />, document.body)}

      {error && (
        <p role="alert" className="rounded-2xl bg-[var(--paper)] p-4 text-[15px] font-semibold text-[var(--danger)] elev-sm">{error}</p>
      )}

      {!manual ? (
        <button type="button" onClick={() => setManual(true)} className="min-h-[44px] self-center text-[15px] font-bold text-[var(--green-deep)]">
          GPS не працює? Підтвердити вручну
        </button>
      ) : (
        <form
          className="flex flex-col gap-2 rounded-[24px] bg-[var(--paper)] p-4 elev-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim()) void confirm(note.trim());
          }}
        >
          <label className="dl-label" htmlFor="manual-note">Що ви бачите біля скарбу?</label>
          <input id="manual-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="dl-field" />
          <button type="submit" disabled={!note.trim() || busy} className="dl-btn-secondary">
            Підтвердити вручну
          </button>
        </form>
      )}

      <p className="selectable pb-2 text-center text-xs font-semibold tabular-nums text-[var(--muted)]">
        {treasure.lat.toFixed(5)}, {treasure.lng.toFixed(5)}
      </p>

      {/* The primary action stays at the bottom of the screen, above the scrolled content. */}
      <div className="sticky bottom-0 -mx-5 mt-auto border-t border-[var(--line)] bg-[var(--paper)]/95 px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-md">
        <p className="mb-2.5 text-center text-[14px] font-medium text-[var(--muted)]">{status}</p>
        {!arrived ? (
          <button type="button" disabled={!canArrive || busy} onClick={arrive} className="dl-btn">
            Я знайшов місце
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => void confirm()} className="dl-btn">
            Я знайшов скарб
          </button>
        )}
      </div>
    </section>
  );
}
