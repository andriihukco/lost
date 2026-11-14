'use client';

import type { GpsStatus } from '@/lib/useGeolocation';

type Props = {
  title: string;
  foundCount: number;
  total: number;
  gps: GpsStatus;
  accuracy: number | null;
  wakeActive: boolean;
  wakeSupported: boolean;
  online: boolean;
};

const GPS_GOOD_M = 25; // accuracy at or below this reads as "точно"

function gpsLabel(gps: GpsStatus, accuracy: number | null): { text: string; tone: 'ok' | 'warn' | 'bad' } {
  if (gps === 'denied') return { text: 'GPS вимкнено', tone: 'bad' };
  if (gps === 'off') return { text: 'GPS недоступний', tone: 'bad' };
  if (gps === 'searching') return { text: 'GPS: пошук', tone: 'warn' };
  if (accuracy !== null && accuracy > GPS_GOOD_M) return { text: 'GPS слабкий', tone: 'warn' };
  return { text: 'GPS точно', tone: 'ok' };
}

const TONE = { ok: 'text-[var(--green-deep)]', warn: 'text-[#b56b00]', bad: 'text-[var(--danger)]' };

// Top status card: title, found counter, and the GPS, screen and connection state.
export default function StatusBar({ title, foundCount, total, gps, accuracy, wakeActive, wakeSupported, online }: Props) {
  const g = gpsLabel(gps, accuracy);
  return (
    <div role="status" className="dl-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="dl-title truncate text-xl">{title}</span>
        <span className="dl-tag px-3 py-1 text-sm tabular-nums">Знайдено {foundCount}/{total}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold">
        <span className={TONE[g.tone]}>{g.text}</span>
        <span className="text-[var(--muted)]">{wakeSupported && wakeActive ? 'Екран не гасне' : 'Екран може згаснути'}</span>
        {!online && <span className="text-[var(--danger)]">Немає зв&apos;язку</span>}
      </div>
    </div>
  );
}
