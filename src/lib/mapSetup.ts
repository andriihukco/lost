import { setWorkerUrl, type StyleSpecification } from 'maplibre-gl';
import { chooseStyle, reserveStyle } from '@/lib/mapStyle';

export { reserveStyle };

// Primary MapTiler when a key is set, otherwise the OpenStreetMap reserve (see mapStyle.ts).
// Public OSM tiles are used only as a reserve: their usage policy forbids heavy app traffic.
export function mapStyle(): string | StyleSpecification {
  return chooseStyle(process.env.NEXT_PUBLIC_MAPTILER_KEY).style;
}

// Shared MapLibre setup for every map on screen.
// Turbopack cannot resolve MapLibre's worker chunk; serve it from /public (copied by postinstall).
// Absolute URL: a relative one is re-resolved against the chunk path and 404s.
export function configureMapLibre(): void {
  setWorkerUrl(new URL('/maplibre-gl-worker.mjs', window.location.origin).href);
}
