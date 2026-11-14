// Route providers answer in different shapes; both are read into the same route summary.
export type RouteLine = { coordinates: [number, number][]; distanceM: number; durationS: number };

// OpenRouteService (GeoJSON, foot-hiking profile, needs a key).
export function parseOrs(data: unknown): RouteLine | null {
  const d = data as { features?: { geometry?: { coordinates?: [number, number][] }; properties?: { summary?: { distance?: number; duration?: number } } }[] };
  const f = d.features?.[0];
  const line = f?.geometry?.coordinates;
  const s = f?.properties?.summary;
  if (!line || !s) return null;
  return { coordinates: line, distanceM: s.distance ?? 0, durationS: s.duration ?? 0 };
}

// OSRM (foot profile over paths, tracks and footways; no key on the public server).
export function parseOsrm(data: unknown): RouteLine | null {
  const d = data as { code?: string; routes?: { distance?: number; duration?: number; geometry?: { coordinates?: [number, number][] } }[] };
  if (d.code !== 'Ok') return null;
  const r = d.routes?.[0];
  const line = r?.geometry?.coordinates;
  if (!r || !line) return null;
  return { coordinates: line, distanceM: r.distance ?? 0, durationS: r.duration ?? 0 };
}

// OSRM takes "lng,lat;lng,lat;..." in the URL path.
export function osrmPath(coords: [number, number][]): string {
  return coords.map(([lng, lat]) => `${lng},${lat}`).join(';');
}
