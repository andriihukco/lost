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

export type MapKind = 'outdoor' | 'satellite' | 'hybrid';

// Free aerial imagery for the keyless build (Esri World Imagery; attribution required).
export const IMAGERY_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const IMAGERY_ATTRIBUTION = 'Зображення © Esri, Maxar, Earthstar Geographics';

// Satellite imagery with an optional hiking-route overlay (no businesses in either case).
export function imageryStyle(withRoutes: boolean): StyleSpecification {
  const sources: StyleSpecification['sources'] = {
    imagery: { type: 'raster', tiles: [IMAGERY_URL], tileSize: 256, attribution: IMAGERY_ATTRIBUTION, maxzoom: 19 },
  };
  const layers: StyleSpecification['layers'] = [
    { id: 'background', type: 'background', paint: { 'background-color': '#dfe6dc' } },
    { id: 'imagery', type: 'raster', source: 'imagery' },
  ];
  if (withRoutes) {
    sources.routes = {
      type: 'raster',
      tiles: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: RESERVE_ATTRIBUTION,
      maxzoom: 18,
    };
    layers.push({ id: 'routes', type: 'raster', source: 'routes' });
  }
  return { version: 8, sources, layers };
}

// The style for a map kind. With a MapTiler key every kind is a MapTiler style. Without one: outdoor is the trails
// reserve, satellite is imagery, hybrid is imagery with the trails on top.
export function styleFor(kind: MapKind, maptilerKey: string | undefined): string | StyleSpecification {
  if (maptilerKey) {
    const name = kind === 'outdoor' ? 'outdoor-v2' : kind;
    return `https://api.maptiler.com/maps/${name}/style.json?key=${maptilerKey}`;
  }
  if (kind === 'outdoor') return reserveStyle();
  return imageryStyle(kind === 'hybrid');
}
