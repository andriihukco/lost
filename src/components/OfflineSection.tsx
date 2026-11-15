'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import OfflineMap from '@/components/OfflineMap';
import type { LatLng } from '@/lib/geo';
import { clearOffline, offlineUsage, readOfflineStatus, type OfflineStatus } from '@/lib/offlineMap';

// Profile: the offline map. If it is saved, show what is kept and let the player update or clear it.
// If it is not saved, show the save action (the same one as in onboarding).
export default function OfflineSection({ points }: { points: LatLng[] }) {
  const [status, setStatus] = useState<OfflineStatus | null>(null);
  const [checked, setChecked] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [usage, setUsage] = useState<{ files: number; bytes: number | null } | null>(null);
  const [busy, setBusy] = useState(false);

  // Read the saved state from this browser after mount (it is not available on the server).
  useEffect(() => {
    setStatus(readOfflineStatus(window.localStorage));
    setChecked(true);
  }, []);

  useEffect(() => {
    if (!status) return;
    void offlineUsage().then(setUsage);
  }, [status]);

  async function clear() {
    if (!window.confirm('Видалити збережену карту з цього пристрою? Без інтернету карта не працюватиме, доки ви її знову не збережете.')) return;
    setBusy(true);
    try {
      await clearOffline(window.localStorage);
      setStatus(null);
      setUsage(null);
    } finally {
      setBusy(false);
    }
  }

  if (!checked) return null;

  // Not saved yet, or the player chose to update: the save action (it plans and saves the map again).
  if (!status || updating) {
    return (
      <OfflineMap
        points={points}
        variant="card"
        onSaved={() => {
          setStatus(readOfflineStatus(window.localStorage));
          setUpdating(false);
        }}
      />
    );
  }

  const when = new Date(status.savedAt).toLocaleString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const mb = usage?.bytes != null ? `${(usage.bytes / 1_000_000).toFixed(1)} МБ` : null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--green)] text-white">
          <span className="text-[24px] leading-none">✅</span>
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="text-[17px] font-bold">Карту збережено</p>
          <p className="mt-0.5 text-[14px] leading-snug text-[var(--muted)]">Працює без інтернету. Збережено {when}.</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl bg-[var(--page)] p-4 text-[14px]">
        <dt className="text-[var(--muted)]">Файлів карти</dt>
        <dd className="text-right font-bold tabular-nums">{usage ? usage.files : '…'}</dd>
        <dt className="text-[var(--muted)]">Місце на пристрої</dt>
        <dd className="text-right font-bold tabular-nums">{mb ?? 'невідомо'}</dd>
      </dl>

      <div className="flex flex-col gap-2">
        <button type="button" disabled={busy} onClick={() => setUpdating(true)} className="dl-btn-secondary">
          Оновити карту
        </button>
        <button type="button" disabled={busy} onClick={() => void clear()} className="dl-btn-danger">
          Очистити карту з пам’яті
        </button>
      </div>
    </section>
  );
}
