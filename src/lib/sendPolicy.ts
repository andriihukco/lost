import { haversineM, type LatLng } from '@/lib/geo';

export const MIN_MOVE_M = 2;
export const MIN_INTERVAL_MS = 2000;

// Throttle for position broadcasts: at most one per 2 s, and only after moving more than 2 m (spec §3).
// Kept free of Supabase imports so it can be unit-tested without env vars.
export function shouldSend(last: LatLng | null, next: LatLng, lastSentAt: number, now: number): boolean {
  if (now - lastSentAt < MIN_INTERVAL_MS) return false;
  if (!last) return true;
  return haversineM(last, next) > MIN_MOVE_M;
}
