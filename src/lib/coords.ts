import type { LatLng } from '@/lib/geo';

const NUM = '-?\\d+(?:\\.\\d+)?';
// Map URLs carry dot-decimal coordinates (@lat,lng, q=…, ll=…).
const URL_PATTERNS = [
  new RegExp(`@(${NUM}),(${NUM})`),
  new RegExp(`[?&](?:q|ll)=(${NUM}),(${NUM})`),
];
// Plain text: two numbers, each with a decimal part, dot or comma as decimal mark.
const PAIR = /(-?\d{1,3}[.,]\d+)\s*[,;]?\s*(-?\d{1,3}[.,]\d+)/;

function toLatLng(latRaw: string, lngRaw: string): LatLng | null {
  const lat = Number(latRaw.replace(',', '.'));
  const lng = Number(lngRaw.replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

// Returns null for anything unparseable, including short links (maps.app.goo.gl), by design.
export function parseCoordinates(input: string): LatLng | null {
  let text = input.trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    // keep the raw text if it is not valid percent-encoding
  }
  if (!text) return null;

  for (const pattern of URL_PATTERNS) {
    const m = pattern.exec(text);
    if (m) return toLatLng(m[1], m[2]);
  }
  const pair = PAIR.exec(text);
  return pair ? toLatLng(pair[1], pair[2]) : null;
}
