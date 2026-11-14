import type { LatLng } from '@/lib/geo';

// Map tiles for offline use: which tiles cover an area, at which zooms. Pure, so it can be tested.
export type Tile = { z: number; x: number; y: number };

// Zoom levels saved for offline: from the whole district down to the streets.
export const OFFLINE_ZOOMS = [13, 14, 15, 16, 17];

const METRES_PER_DEG_LAT = 111_320;

export function lngToTileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}

export function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

// Every tile that covers the square of +-radiusM metres around the point, at each zoom.
export function tilesAround(center: LatLng, radiusM: number, zooms: number[]): Tile[] {
  const dLat = radiusM / METRES_PER_DEG_LAT;
  const dLng = radiusM / (METRES_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180));
  const out: Tile[] = [];
  for (const z of zooms) {
    const x0 = lngToTileX(center.lng - dLng, z);
    const x1 = lngToTileX(center.lng + dLng, z);
    // Tile rows grow southwards, so the northern edge gives the smaller y.
    const y0 = latToTileY(center.lat + dLat, z);
    const y1 = latToTileY(center.lat - dLat, z);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) out.push({ z, x, y });
    }
  }
  return out;
}

// The tiles around several points, each tile once.
export function tilesForPoints(points: LatLng[], radiusM: number, zooms: number[]): Tile[] {
  const seen = new Map<string, Tile>();
  for (const p of points) {
    for (const t of tilesAround(p, radiusM, zooms)) seen.set(`${t.z}/${t.x}/${t.y}`, t);
  }
  return [...seen.values()];
}

export function expandTemplate(template: string, t: Tile): string {
  return template.replace('{z}', String(t.z)).replace('{x}', String(t.x)).replace('{y}', String(t.y));
}
