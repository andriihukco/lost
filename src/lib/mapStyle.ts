import type { StyleSpecification } from 'maplibre-gl';

// The map shows terrain, forests, trails and routes. Businesses and places are hidden.
// Primary: MapTiler "outdoor" (trails and forests). Reserve (no key): a blank background with the Waymarked
// Trails hiking-route overlay, which contains routes only. OpenStreetMap's standard and topo tiles show shops and
// clinics, so they are not used here.
export const RESERVE_ATTRIBUTION = 'Маршрути: Waymarked Trails · © OpenStreetMap contributors';

const BUSINESS = /poi|shop|amenity|office|retail|commercial|transit|station|stop|cafe|restaurant|bank|hospital|school|parking|fuel|pharmacy|hotel|place/i;

// True for layers that show businesses or places (shops, cafés, offices, transit, city and town labels).
export function isBusinessLayer(id: string, sourceLayer?: string): boolean {
  if (sourceLayer === 'poi' || sourceLayer === 'place') return true;
  return BUSINESS.test(id) || (sourceLayer !== undefined && BUSINESS.test(sourceLayer));
}

export type ChosenStyle = {
  provider: 'maptiler' | 'osm';
  style: string | StyleSpecification;
  url?: string;
};

export function reserveStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      routes: {
        type: 'raster',
        tiles: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: RESERVE_ATTRIBUTION,
        maxzoom: 18,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#f4f7f1' } },
      { id: 'routes', type: 'raster', source: 'routes' },
    ],
  };
}

export function chooseStyle(maptilerKey: string | undefined): ChosenStyle {
  if (maptilerKey) {
    const url = `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${maptilerKey}`;
    return { provider: 'maptiler', style: url, url };
  }
  return { provider: 'osm', style: reserveStyle() };
}
