import { haversineM, type LatLng } from '@/lib/geo';

// Players within 10 m of an unfound treasure get an in-app "you are near" notice (spec change 2026-11-14).
export const NEARBY_M = 10;

export type Locatable = { id: string; lat: number; lng: number; is_found: boolean };

export function nearestWithin<T extends Locatable>(
  treasures: T[],
  pos: LatLng | null,
): { treasure: T; distanceM: number } | null {
  if (!pos) return null;
  let best: { treasure: T; distanceM: number } | null = null;
  for (const t of treasures) {
    if (t.is_found) continue;
    const d = haversineM(pos, t);
    if (d <= NEARBY_M && (!best || d < best.distanceM)) best = { treasure: t, distanceM: d };
  }
  return best;
}
