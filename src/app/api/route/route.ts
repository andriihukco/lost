import { NextResponse } from 'next/server';

// Walking route along paths and forest roads (OpenRouteService, foot-hiking profile).
// The key lives on the server only (ORS_API_KEY). Node runtime is the default. Body: { coordinates: [[lng, lat], ...] }, 2 to 50 points.
const ORS_URL = 'https://api.openrouteservice.org/v2/directions/foot-hiking/geojson';

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

export async function POST(req: Request) {
  const key = process.env.ORS_API_KEY;
  if (!key) return NextResponse.json({ error: 'no-key' }, { status: 503 });

  const body = await req.json().catch(() => null) as { coordinates?: unknown } | null;
  if (!body || !validCoords(body.coordinates)) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(ORS_URL, {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json', Accept: 'application/geo+json' },
      body: JSON.stringify({ coordinates: body.coordinates }),
    });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
  if (!res.ok) return NextResponse.json({ error: 'upstream' }, { status: 502 });

  const data = (await res.json()) as {
    features?: { geometry?: { coordinates?: [number, number][] }; properties?: { summary?: { distance?: number; duration?: number } } }[];
  };
  const feature = data.features?.[0];
  const line = feature?.geometry?.coordinates;
  const summary = feature?.properties?.summary;
  if (!line || !summary) return NextResponse.json({ error: 'upstream' }, { status: 502 });

  return NextResponse.json({
    coordinates: line, // [lng, lat] pairs along the path
    distanceM: summary.distance ?? 0,
    durationS: summary.duration ?? 0,
  });
}
