import { haversineM, type LatLng } from '@/lib/geo';

// A location is logged when the player moved at least 10 m since the last logged point,
// or when 30 s passed (so a standing player still leaves a trail point). Kept pure for tests.
export const LOG_MIN_MOVE_M = 10;
export const LOG_MAX_GAP_MS = 30_000;

export function shouldLogLocation(last: LatLng | null, next: LatLng, lastAt: number, now: number): boolean {
  if (!last) return true;
  if (now - lastAt >= LOG_MAX_GAP_MS) return true;
  return haversineM(last, next) >= LOG_MIN_MOVE_M;
}
