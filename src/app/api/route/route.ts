import { NextResponse } from 'next/server';
import { osrmPath, parseOrs, parseOsrm, type RouteLine } from '@/lib/routeParse';

// Walking route along paths, tracks and forest roads.
// 1) OpenRouteService foot-hiking when ORS_API_KEY is set (server-only).
// 2) Otherwise OSRM's foot profile on the public router (no key).
// Body: { coordinates: [[lng, lat], ...] }, 2 to 50 points, in visiting order.

const ORS_URL = 'https://api.openrouteservice.org/v2/directions/foot-hiking/geojson';
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/foot';
const TIMEOUT_MS = 12_000;

function validCoords(v: unknown): v is [number, number][] {
  if (!Array.isArray(v) || v.length < 2 || v.length > 50) return false;
  return v.every(
    (c) =>
      Array.isArray(c) && c.length === 2 &&
      typeof c[0] === 'number' && typeof c[1] === 'number' &&
      Number.isFinite(c[0]) && Number.isFinite(c[1]) &&
      Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90,
  );
}

async function viaOrs(coords: [number, number][], key: string): Promise<RouteLine | null> {
  try {
    const res = await fetch(ORS_URL, {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json', Accept: 'application/geo+json' },
      body: JSON.stringify({ coordinates: coords }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok ? parseOrs(await res.json()) : null;
  } catch {
    return null;
  }
}

async function viaOsrm(coords: [number, number][]): Promise<RouteLine | null> {
  try {
    const url = `${OSRM_BASE}/${osrmPath(coords)}?overview=full&geometries=geojson`;
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? parseOsrm(await res.json()) : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { coordinates?: unknown } | null;
  if (!body || !validCoords(body.coordinates)) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }
  const coords = body.coordinates;

  const key = process.env.ORS_API_KEY;
  const route = (key ? await viaOrs(coords, key) : null) ?? (await viaOsrm(coords));
  if (!route) return NextResponse.json({ error: 'upstream' }, { status: 502 });

  return NextResponse.json(route);
}
