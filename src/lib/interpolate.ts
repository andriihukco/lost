import type { LatLng } from '@/lib/geo';

export const INTERP_MS = 2500; // marker glide between two position updates (2–3 s apart)
export const STALE_AFTER_MS = 30_000;
export const STALE_OPACITY = 0.4;

// Markers older than 30 s fade to 40% (spec §7).
export function opacityForAge(ageMs: number): number {
  return ageMs >= STALE_AFTER_MS ? STALE_OPACITY : 1;
}

export function lerpLatLng(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}
