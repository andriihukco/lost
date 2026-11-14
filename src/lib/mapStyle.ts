import type { StyleSpecification } from 'maplibre-gl';

// Primary: MapTiler (needs a key). Reserve: OpenStreetMap raster tiles, used when no key is set.
// OSM's public tile servers have a usage policy: keep the reserve for light traffic only.
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

export type ChosenStyle = {
  provider: 'maptiler' | 'osm';
  style: string | StyleSpecification;
  url?: string;
};

export function osmStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: OSM_ATTRIBUTION,
        maxzoom: 19,
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  };
}

export function chooseStyle(maptilerKey: string | undefined): ChosenStyle {
  if (maptilerKey) {
    const url = `https://api.maptiler.com/maps/streets-v2/style.json?key=${maptilerKey}`;
    return { provider: 'maptiler', style: url, url };
  }
  return { provider: 'osm', style: osmStyle() };
}
