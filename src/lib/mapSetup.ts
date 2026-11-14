import { setWorkerUrl, type StyleSpecification } from 'maplibre-gl';

// Shared MapLibre setup for every map on screen.
// MapTiler streets style when the key is set; otherwise a blank style. Public OSM tiles are not used (spec C5).
const BLANK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e9e7e1' } }],
};

export function mapStyle(): string | StyleSpecification {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  return key ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}` : BLANK_STYLE;
}

// Turbopack cannot resolve MapLibre's worker chunk; serve it from /public (copied by postinstall).
// Absolute URL: a relative one is re-resolved against the chunk path and 404s.
export function configureMapLibre(): void {
  setWorkerUrl(new URL('/maplibre-gl-worker.mjs', window.location.origin).href);
}
