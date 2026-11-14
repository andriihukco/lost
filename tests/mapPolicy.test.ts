import { expect, test } from 'vitest';
import { isBusinessLayer, chooseStyle } from '@/lib/mapStyle';

// The map shows terrain, forests, trails and routes only: no shops, cafés, offices, transit or other places.
test.each([
  ['poi_r1', 'poi'],
  ['poi_label_shop', 'poi'],
  ['shop', 'poi'],
  ['amenity-cafe', 'poi'],
  ['transit_stop', 'transportation_name'],
  ['office', 'place'],
  ['landuse-retail', 'landuse'],
])('hides business layer %s (%s)', (id, sourceLayer) => {
  expect(isBusinessLayer(id, sourceLayer)).toBe(true);
});

test.each([
  ['forest', 'landuse'],
  ['trail', 'transportation'],
  ['path-hiking', 'transportation'],
  ['water', 'water'],
  ['contour', 'contour'],
])('keeps nature layer %s (%s)', (id, sourceLayer) => {
  expect(isBusinessLayer(id, sourceLayer)).toBe(false);
});

test('primary style is the MapTiler outdoor style (trails and forests)', () => {
  const s = chooseStyle('k');
  expect(s.url).toContain('outdoor');
});

test('reserve style shows hiking routes only (no base map with shops)', () => {
  const s = chooseStyle(undefined);
  expect(s.provider).toBe('osm');
  const json = JSON.stringify(s.style);
  expect(json).toContain('waymarkedtrails');
  expect(json).not.toContain('openstreetmap.org/');
});
