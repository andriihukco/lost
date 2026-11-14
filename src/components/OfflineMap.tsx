'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import type { LatLng } from '@/lib/geo';
import { OFFLINE_RADIUS_M, planOfflineUrls, saveOffline } from '@/lib/offlineMap';

// Saves the map around the treasures, marks and the player, so it works without a connection.
// variant "prompt": the first-login question (with "later"). variant "card": a section in the profile.
export default function OfflineMap({
  points,
  variant,
  onDone,
  onLater,
}: {
  points: LatLng[];
  variant: 'prompt' | 'card';
  onDone?: () => void;
  onLater?: () => void;
}) {
  const [urls, setUrls] = useState<string[] | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ ok: number; failed: number } | null>(null);

  // Planning needs the style files, so it needs a connection; it is done when the panel opens.
  useEffect(() => {
    let alive = true;
    planOfflineUrls(points, process.env.NEXT_PUBLIC_MAPTILER_KEY)
      .then((u) => { if (alive) setUrls(u); })
      .catch(() => { if (alive) setPlanError('Щоб підготувати мапу, потрібен інтернет.'); });
    return () => { alive = false; };
    // The plan is made once per opening; new treasures are picked up the next time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!urls) return;
    setBusy(true);
    setResult(null);
    const res = await saveOffline(urls, (done, total) => setProgress({ done, total }));
    setBusy(false);
    setResult(res);
  }

  const card = variant === 'card';
  return (
    <section className={`flex flex-col gap-3 ${card ? '' : 'p-5'}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--green-soft)] text-[var(--green-deep)]">
          <Icon name="travel_explore" size={24} />
        </span>
        <div className="min-w-0">
          <p className="text-[17px] font-bold">Мапа без інтернету</p>
          <p className="mt-0.5 text-[14px] leading-snug text-[var(--muted)]">
            Збережемо мапу на {OFFLINE_RADIUS_M / 1000} км навколо скарбів, міток і вас. Тоді карта працюватиме без зв&apos;язку.
          </p>
        </div>
      </div>

      {planError && <p role="alert" className="text-[14px] font-semibold text-[var(--danger)]">{planError}</p>}
      {!planError && urls === null && <p className="text-[14px] font-semibold text-[var(--muted)]">Готуємо список…</p>}
      {urls !== null && !busy && !result && (
        <p className="text-[14px] font-semibold text-[var(--muted)]">Буде збережено ≈ {urls.length} файлів мапи.</p>
      )}

      {busy && progress && (
        <div className="flex flex-col gap-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--line)]" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
            <span className="block h-full rounded-full bg-[var(--green)] transition-[width] duration-200" style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} />
          </div>
          <p className="text-[13px] font-semibold tabular-nums text-[var(--muted)]">{progress.done} з {progress.total}</p>
        </div>
      )}

      {result && (
        <p role="status" className="text-[15px] font-bold text-[var(--green-deep)]">
          {result.failed === 0 ? 'Мапу збережено. Працює без інтернету.' : `Збережено ${result.ok}, не вдалося ${result.failed}. Спробуйте ще раз з’єднання.`}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {!result || result.failed > 0 ? (
          <button type="button" disabled={!urls || busy} onClick={() => void save()} className="dl-btn">
            {busy ? 'Зберігаємо…' : 'Зберегти мапу'}
          </button>
        ) : (
          <button type="button" onClick={onDone} className="dl-btn-secondary">Готово</button>
        )}
        {variant === 'prompt' && !busy && (
          <button type="button" onClick={onLater} className="min-h-[44px] text-[15px] font-bold text-[var(--muted)]">Пізніше</button>
        )}
      </div>
    </section>
  );
}
