export type LatLng = { lat: number; lng: number };

export const FOUND_RADIUS_M = 15;

const EARTH_RADIUS_M = 6371008.8;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Missing, NaN or negative accuracy gives no compensation (review focus 3).
export function isFoundable(distanceM: number, accuracyM: number | null | undefined): boolean {
  const acc = typeof accuracyM === 'number' && Number.isFinite(accuracyM) && accuracyM >= 0 ? accuracyM : 0;
  return Math.max(0, distanceM - acc) <= FOUND_RADIUS_M;
}
