'use client';

import type { GpsStatus } from '@/lib/useGeolocation';

type Props = {
  roomName: string;
  foundCount: number;
  total: number;
  gps: GpsStatus;
  accuracy: number | null;
  wakeActive: boolean;
  wakeSupported: boolean;
  online: boolean;
};

// Passive top status (spec §5.1): room name, found counter, GPS and wake-lock state.
const GPS_GOOD_M = 25; // accuracy at or below this reads as "точно"

function gpsLabel(gps: GpsStatus, accuracy: number | null): string {
  if (gps === 'denied') return 'GPS: немає';
  if (gps === 'off') return 'GPS: недоступний';
  if (gps === 'searching') return 'GPS: пошук';
  if (accuracy !== null && accuracy > GPS_GOOD_M) return 'GPS: слабко';
  return 'GPS: точно';
}

export default function StatusBar({
  roomName, foundCount, total, gps, accuracy, wakeActive, wakeSupported, online,
}: Props) {
  const wakeText = wakeActive ? 'Екран активний' : 'Екран не блокується';
  return (
    <div
      role="status"
      className="rounded-2xl bg-white/80 px-4 py-2 text-sm font-medium shadow backdrop-blur"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="truncate">{roomName}</span>
        <span className="tabular-nums">Знайдено {foundCount}/{total}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-neutral-500">
        <span>{gpsLabel(gps, accuracy)}</span>
        <span>{wakeSupported ? wakeText : 'Екран не блокується'}</span>
        {!online && <span className="text-red-600">Немає зв&apos;язку</span>}
      </div>
    </div>
  );
}
