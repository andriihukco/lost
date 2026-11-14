import type { LatLng } from '@/lib/geo';

export type WalkRoute = {
  coords: LatLng[];
  distanceM: number;
  durationS: number;
  source: 'paths' | 'straight';
};

// Straight-line walking estimate: 4.5 km/h, used when no path route is available.
export const WALK_SPEED_MPS = 4.5 / 3.6;

// Walking time is computed from the distance at a walking pace, whatever the router's own estimate says.
export function walkSeconds(distanceM: number): number {
  return distanceM / WALK_SPEED_MPS;
}

export function straightRoute(points: LatLng[], distanceM: number): WalkRoute {
  return { coords: points, distanceM, durationS: walkSeconds(distanceM), source: 'straight' };
}

// Asks the server for a route along paths and forest roads; null when unavailable (no key, offline).
export async function fetchWalkingRoute(points: LatLng[]): Promise<WalkRoute | null> {
  try {
    const res = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: points.map((p) => [p.lng, p.lat]) }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { coordinates: [number, number][]; distanceM: number; durationS: number };
    return {
      coords: data.coordinates.map(([lng, lat]) => ({ lat, lng })),
      distanceM: data.distanceM,
      durationS: walkSeconds(data.distanceM),
      source: 'paths',
    };
  } catch {
    return null;
  }
}
