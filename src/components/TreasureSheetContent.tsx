'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import CameraOverlay from '@/components/CameraOverlay';
import Icon from '@/components/Icon';
import { isFoundable, type LatLng } from '@/lib/geo';
import { bearingDeg, cardinal, formatDistance } from '@/lib/geoFormat';
import { relativeBearing } from '@/lib/heading';
import { hasArrived, markArrived } from '@/lib/arrival';
import { markFound, markPlace, unmarkFound, type FoundStatus } from '@/lib/found';
import { PHOTO_BUCKET } from '@/lib/treasures';
import { supabase } from '@/lib/supabase';
import { useIsPhone } from '@/lib/useIsPhone';
import type { Treasure } from '@/lib/useTreasures';

type Props = {
  treasure: Treasure;
  pos: LatLng | null;
  accuracy: number | null;
  distanceM: number | null;
  heading: number | null;
  onResult: (status: FoundStatus) => void;
  onRoute?: () => void; // build a walking route to this treasure (not offered for a found treasure)
  finderName?: string | null; // who found it, shown for a found treasure
  canUnmark?: boolean; // the finder or an admin may bring a found treasure back to the map
  onUnmarked?: () => void;
};

const ERROR_TEXT: Record<Exclude<FoundStatus, 'won'>, string> = {
  taken: 'Цей скарб уже знайшов інший гравець.',
  not_player: 'Спочатку оберіть імʼя й тотем.',
  not_found: 'Скарб не знайдено.',
};

// The treasure view, top to bottom: photo, distance, hint, secondary actions, then the one primary action,
// which stays pinned at the bottom. Two steps: "Я знайшов місце" (at the spot), then "Я знайшов скарб".
export default function TreasureSheetContent({ treasure, pos, accuracy, distanceM, heading, onResult, onRoute, finderName, canUnmark = false, onUnmarked }: Props) {
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false); // the photo stays blurred until tapped
  const [arrived, setArrived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const phone = useIsPhone(); // the camera overlay is for standing at the spot with a phone
  // Step two ("Я знайшов скарб") opens a moment after step one, so the tap that confirmed the place
  // cannot also confirm the treasure (on a phone the second button would sit under the same finger).
  const [step2Ready, setStep2Ready] = useState(false);
  useEffect(() => {
    if (!arrived) {
      setStep2Ready(false);
      return;
    }
    const t = setTimeout(() => setStep2Ready(true), 900);
    return () => clearTimeout(t);
  }, [arrived]);

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
    if (!arrived) return; // the treasure is confirmed only after the place
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

  // Bring a found treasure back to the map: the finder or an admin (the database checks which).
  async function unmark() {
    setBusy(true);
    setError(null);
    try {
      const s = await unmarkFound(treasure.id);
      if (s === 'unfound') onUnmarked?.();
      else setError(s === 'not_yours' ? 'Повернути може лише той, хто знайшов, або адміністратор.' : 'Скарб уже на карті.');
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
  const showCamera = phone && photoUrls.length > 0;
  const secondaryCount = (onRoute ? 1 : 0) + (showCamera ? 1 : 0);

  return (
    <div className="flex min-h-full w-full flex-col">
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 pt-1">
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
          {showCamera && (
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

      <p className="selectable pb-2 text-center text-xs font-semibold tabular-nums text-[var(--muted)]">
        {treasure.lat.toFixed(5)}, {treasure.lng.toFixed(5)}
      </p>

    </section>

    {/* The primary action: a full-width bar at the bottom, its contents in the same column as the page. */}
    <div className="sticky bottom-0 mt-auto w-full border-t border-[var(--line)] bg-[var(--paper)]/95 backdrop-blur-md">
      <div className="mx-auto w-full max-w-md px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
        {treasure.is_found ? (
          // A found treasure stays on the map, greyed: no finding, no route. Only a return to the map is offered.
          <>
            <p className="mb-2.5 text-center text-[14px] font-medium text-[var(--muted)]">Знайдено: {finderName ?? 'гравець'}</p>
            {canUnmark && (
              <button type="button" disabled={busy} onClick={() => void unmark()} className="dl-btn-secondary">
                Повернути на карту
              </button>
            )}
          </>
        ) : (
          <>
            <p className="mb-2.5 text-center text-[14px] font-medium text-[var(--muted)]">{status}</p>
            {/* Two separate buttons (different keys), so a tap on step one never becomes a tap on step two. */}
            {!arrived ? (
              <button key="place" type="button" disabled={!canArrive || busy} onClick={arrive} className="dl-btn">
                Я знайшов місце
              </button>
            ) : (
              <button key="treasure" type="button" disabled={busy || !step2Ready} onClick={() => void confirm()} className="dl-btn">
                Я знайшов скарб
              </button>
            )}
          </>
        )}
      </div>
    </div>
    </div>
  );
}
