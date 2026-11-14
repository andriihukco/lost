import { expect, test } from 'vitest';
import { chooseStyle, OSM_ATTRIBUTION } from '@/lib/mapStyle';

test('uses MapTiler when a key is set', () => {
  const s = chooseStyle('abc');
  expect(s.provider).toBe('maptiler');
  expect(s.url).toContain('key=abc');
});
test('falls back to OpenStreetMap when no key is set', () => {
  const s = chooseStyle(undefined);
  expect(s.provider).toBe('osm');
  expect(s.style).toMatchObject({ version: 8 });
});
test('OpenStreetMap style carries the required attribution', () => {
  expect(OSM_ATTRIBUTION).toContain('OpenStreetMap');
});
