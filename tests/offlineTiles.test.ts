import { expect, test } from 'vitest';
import { expandTemplate, OFFLINE_ZOOMS, tilesAround, tilesForPoints } from '@/lib/offlineTiles';

const kyiv = { lat: 49.8419, lng: 24.0315 };

test('the tile that holds the centre is always in the set', () => {
  const tiles = tilesAround(kyiv, 2000, [14]);
  const x = Math.floor(((kyiv.lng + 180) / 360) * 2 ** 14);
  expect(tiles.some((t) => t.z === 14 && t.x === x)).toBe(true);
});

test('zooming in one level roughly quadruples the tile count', () => {
  const a = tilesAround(kyiv, 2000, [14]).length;
  const b = tilesAround(kyiv, 2000, [15]).length;
  expect(b / a).toBeGreaterThan(2.5);
  expect(b / a).toBeLessThan(6);
});

test('a 2 km radius at zoom 14 covers a small block of tiles, not the whole city', () => {
  const n = tilesAround(kyiv, 2000, [14]).length;
  expect(n).toBeGreaterThanOrEqual(4);
  expect(n).toBeLessThanOrEqual(16);
});

test('several points that share an area give each tile once', () => {
  const once = tilesForPoints([kyiv], 2000, [14, 15]);
  const twice = tilesForPoints([kyiv, { lat: kyiv.lat + 0.00001, lng: kyiv.lng }], 2000, [14, 15]);
  expect(twice.length).toBe(once.length);
  const keys = new Set(twice.map((t) => `${t.z}/${t.x}/${t.y}`));
  expect(keys.size).toBe(twice.length);
});

test('the default zoom range is 13 to 17', () => {
  expect(OFFLINE_ZOOMS).toEqual([13, 14, 15, 16, 17]);
});

test('a tile template gets z, x and y filled in', () => {
  expect(expandTemplate('https://h/{z}/{x}/{y}.png?key=K', { z: 14, x: 9803, y: 5573 })).toBe('https://h/14/9803/5573.png?key=K');
});
