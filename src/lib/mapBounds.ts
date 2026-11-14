import type { LatLng } from '@/lib/geo';

// The player's map view is limited to the area around me and the open treasures: this many metres on each side.
export const MAP_PAD_M = 2500;

export type ViewBounds = { west: number; south: number; east: number; north: number };

const M_PER_DEG_LAT = 111_320;

// The box around the given points, padded by padM metres on every side. Null when there are no points.
export function viewBounds(points: LatLng[], padM: number): ViewBounds | null {
  if (points.length === 0) return null;
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const p of points) {
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
  }
  const dLat = padM / M_PER_DEG_LAT;
  const midLat = (south + north) / 2;
  const dLng = padM / (M_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180));
  return { west: west - dLng, east: east + dLng, south: south - dLat, north: north + dLat };
}
