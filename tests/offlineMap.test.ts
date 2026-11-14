import { expect, test } from 'vitest';
import { fontStacks, glyphUrls, sourceTileUrls, spriteUrls } from '@/lib/offlineMap';
import type { Tile } from '@/lib/offlineTiles';

test('fonts are read from the text layers of a style', () => {
  const style = { layers: [{ layout: { 'text-font': ['Noto Sans Regular', 'Noto Sans Bold'] } }, { layout: { 'text-font': ['Noto Sans Regular'] } }, { layout: {} }] };
  expect(fontStacks(style)).toEqual(['Noto Sans Bold', 'Noto Sans Regular']);
});

test('glyph URLs fill in the font and the range', () => {
  expect(glyphUrls('https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=K', ['Noto Sans Regular']))
    .toContain('https://api.maptiler.com/fonts/Noto%20Sans%20Regular/0-255.pbf?key=K');
});

test('the sprite comes in four files: normal and retina, json and png', () => {
  expect(spriteUrls('https://api.maptiler.com/maps/x/sprite')).toEqual([
    'https://api.maptiler.com/maps/x/sprite.json',
    'https://api.maptiler.com/maps/x/sprite.png',
    'https://api.maptiler.com/maps/x/sprite@2x.json',
    'https://api.maptiler.com/maps/x/sprite@2x.png',
  ]);
});

test('source tiles are listed for the tiles in the set, within each source zoom range', () => {
  const tiles: Tile[] = [{ z: 13, x: 1, y: 2 }, { z: 17, x: 3, y: 4 }];
  const urls = sourceTileUrls({
    vector: { type: 'vector', tiles: ['https://h/{z}/{x}/{y}.pbf'], maxzoom: 14 },
    sat: { type: 'raster', tiles: ['https://s/{z}/{x}/{y}.jpg'] },
  }, tiles);
  expect(urls).toEqual(['https://h/13/1/2.pbf', 'https://s/13/1/2.jpg', 'https://s/17/3/4.jpg']);
});
