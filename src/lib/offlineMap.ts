import type { LatLng } from '@/lib/geo';
import { IMAGERY_URL, ROUTES_URL, styleFor, type MapKind } from '@/lib/mapStyle';
import { expandTemplate, OFFLINE_ZOOMS, tilesForPoints, type Tile } from '@/lib/offlineTiles';

// The offline map: every tile, style, font and sprite around the treasures, marks and the player, fetched once.
// The service worker (public/sw.js) keeps what is fetched, so the map works without a connection afterwards.
export const OFFLINE_RADIUS_M = 2000;
const KINDS: MapKind[] = ['outdoor', 'hybrid'];
// Glyph ranges: Latin, Latin extended, Cyrillic, general punctuation. Enough for the labels in Ukrainian.
const GLYPH_RANGES = ['0-255', '256-511', '1024-1279', '8192-8447'];

type StyleJson = {
  sources?: Record<string, { type?: string; tiles?: string[]; minzoom?: number; maxzoom?: number }>;
  glyphs?: string;
  sprite?: string;
  layers?: { layout?: Record<string, unknown> }[];
};

// Font stacks used by the text layers of a style.
export function fontStacks(style: { layers?: { layout?: Record<string, unknown> }[] }): string[] {
  const fonts = new Set<string>();
  for (const layer of style.layers ?? []) {
    const font = layer.layout?.['text-font'];
    if (Array.isArray(font)) for (const f of font) if (typeof f === 'string') fonts.add(f);
  }
  return [...fonts].sort();
}

export function glyphUrls(template: string, fonts: string[]): string[] {
  const out: string[] = [];
  for (const font of fonts) {
    for (const range of GLYPH_RANGES) {
      out.push(template.replace('{fontstack}', encodeURIComponent(font)).replace('{range}', range));
    }
  }
  return out;
}

export function spriteUrls(sprite: string): string[] {
  return ['sprite.json', 'sprite.png', 'sprite@2x.json', 'sprite@2x.png'].map((f) => sprite.replace(/sprite$/, f));
}

// The tile URLs of every source of a style that fall inside the set of tiles (and inside its zoom range).
export function sourceTileUrls(sources: Record<string, { type?: string; tiles?: string[]; minzoom?: number; maxzoom?: number }>, tiles: Tile[]): string[] {
  const out: string[] = [];
  for (const src of Object.values(sources)) {
    const template = src.tiles?.[0];
    if (!template) continue;
    for (const t of tiles) {
      if (t.z < (src.minzoom ?? 0) || t.z > (src.maxzoom ?? 22)) continue;
      out.push(expandTemplate(template, t));
    }
  }
  return out;
}

// Everything the offline map needs, for all three map kinds. With a MapTiler key the style JSON is read, so the
// URLs match what the map asks for; without one, the free sources are listed directly.
export async function planOfflineUrls(points: LatLng[], maptilerKey: string | undefined): Promise<string[]> {
  const tiles = tilesForPoints(points, OFFLINE_RADIUS_M, OFFLINE_ZOOMS);
  const urls = new Set<string>();
  for (const kind of KINDS) {
    if (maptilerKey) {
      const styleUrl = styleFor(kind, maptilerKey) as string;
      const res = await fetch(styleUrl);
      if (!res.ok) throw new Error('style');
      const style = (await res.json()) as StyleJson;
      urls.add(styleUrl);
      for (const u of sourceTileUrls(style.sources ?? {}, tiles)) urls.add(u);
      if (style.glyphs) for (const u of glyphUrls(style.glyphs, fontStacks(style))) urls.add(u);
      if (style.sprite) for (const u of spriteUrls(style.sprite)) urls.add(u);
    } else {
      const templates: string[] = [];
      if (kind === 'outdoor' || kind === 'hybrid') templates.push(ROUTES_URL);
      if (kind === 'hybrid') templates.push(IMAGERY_URL);
      for (const template of templates) for (const t of tiles) urls.add(expandTemplate(template, t));
    }
  }
  return [...urls];
}

// Fetches every URL (six at a time). The service worker stores each response it sees.
export async function saveOffline(urls: string[], onProgress: (done: number, total: number) => void): Promise<{ ok: number; failed: number }> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // the browser may refuse; the map is still saved for now
  }
  const queue = [...urls];
  let ok = 0;
  let failed = 0;
  let done = 0;
  const worker = async () => {
    while (queue.length > 0) {
      const url = queue.shift() as string;
      try {
        const res = await fetch(url);
        if (res.ok || res.type === 'opaque') ok += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
      done += 1;
      onProgress(done, urls.length);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return { ok, failed };
}
