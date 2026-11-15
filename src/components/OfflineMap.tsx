'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import type { LatLng } from '@/lib/geo';
import { OFFLINE_RADIUS_M, planOfflineUrls, saveOffline } from '@/lib/offlineMap';

// Saves the map around the treasures, marks and the player, so it works without a connection.
// variant "prompt": the onboarding step. One primary action at a time, and a plain "Не зараз" to skip.
// variant "card": a section in the profile.
export default function OfflineMap({
  points,
  variant,
  onDone,
  onLater,
  onSaved,
}: {
  points: LatLng[];
  variant: 'prompt' | 'card';
  onDone?: () => void;
  onLater?: () => void;
  onSaved?: () => void;
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
      .catch(() => { if (alive) setPlanError('Щоб підготувати карту, потрібен інтернет.'); });
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
    if (res.failed === 0) onSaved?.();
  }

  const card = variant === 'card';
  const saved = result !== null && result.failed === 0;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${saved ? 'bg-[var(--green)] text-white' : 'bg-[var(--green-soft)] text-[var(--green-deep)]'}`}
        >
          <Icon name={saved ? 'check' : 'travel_explore'} size={26} />
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="text-[17px] font-bold">{saved ? 'Карту збережено' : 'Карта без інтернету'}</p>
          <p className="mt-0.5 text-[14px] leading-snug text-[var(--muted)]">
            {saved
              ? 'Карта і скарби працюють без зв’язку.'
              : `Збережемо карту на ${OFFLINE_RADIUS_M / 1000} км навколо скарбів, міток і вас.`}
          </p>
        </div>
      </div>

      {/* Why it helps, before the player decides. */}
      {!card && !saved && !busy && (
        <ul className="flex flex-col gap-2.5 text-[15px] text-[var(--ink)]">
          <li className="flex items-center gap-3"><Icon name="map" size={20} className="text-[var(--green-deep)]" />Карта працює в лісі, навіть без інтернету</li>
          <li className="flex items-center gap-3"><Icon name="route" size={20} className="text-[var(--green-deep)]" />Шлях до скарбів видно без зв’язку</li>
        </ul>
      )}

      {planError && <p role="alert" className="text-[14px] font-semibold text-[var(--danger)]">{planError}</p>}
      {!planError && urls === null && <p className="text-[14px] font-semibold text-[var(--muted)]">Готуємо список…</p>}
      {urls !== null && !busy && !result && (
        <p className="text-[14px] font-semibold text-[var(--muted)]">≈ {urls.length} файлів · краще зберегти з Wi-Fi</p>
      )}

      {busy && progress && (
        <div className="flex flex-col gap-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--line)]" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
            <span className="block h-full rounded-full bg-[var(--green)] transition-[width] duration-200" style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} />
          </div>
          <p className="text-[13px] font-semibold tabular-nums text-[var(--muted)]">{progress.done} з {progress.total}</p>
        </div>
      )}

      {result && result.failed > 0 && (
        <p role="alert" className="text-[14px] font-semibold text-[var(--danger)]">
          Збережено {result.ok}, не вдалося {result.failed}. Перевірте зв’язок і спробуйте ще раз.
        </p>
      )}

      {/* One primary action per state. After a successful save there is only "Готово". */}
      <div className="flex flex-col gap-2">
        {saved ? (
          !card && onDone && <button type="button" onClick={onDone} className="dl-btn">Готово</button>
        ) : (
          <>
            <button type="button" disabled={!urls || busy} onClick={() => void save()} className="dl-btn">
              {busy ? 'Зберігаємо…' : result ? 'Спробувати ще раз' : 'Зберегти карту'}
            </button>
            {variant === 'prompt' && !busy && onLater && (
              <button type="button" onClick={onLater} className="dl-btn-secondary">Не зараз</button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
