import { expect, test } from 'vitest';
import { parseOrs, parseOsrm, osrmPath } from '@/lib/routeParse';

test('OpenRouteService response: line, distance and duration', () => {
  const r = parseOrs({
    features: [{ geometry: { coordinates: [[24.03, 49.84], [24.04, 49.85]] }, properties: { summary: { distance: 1200, duration: 900 } } }],
  });
  expect(r).toEqual({ coordinates: [[24.03, 49.84], [24.04, 49.85]], distanceM: 1200, durationS: 900 });
});
test('OpenRouteService response without a route gives null', () => {
  expect(parseOrs({})).toBeNull();
  expect(parseOrs({ features: [] })).toBeNull();
});
test('OSRM response: first route, same shape', () => {
  const r = parseOsrm({ code: 'Ok', routes: [{ distance: 2553, duration: 331, geometry: { coordinates: [[24.03, 49.84], [24.05, 49.83]] } }] });
  expect(r).toEqual({ coordinates: [[24.03, 49.84], [24.05, 49.83]], distanceM: 2553, durationS: 331 });
});
test('OSRM error code gives null', () => {
  expect(parseOsrm({ code: 'NoRoute', routes: [] })).toBeNull();
});
test('OSRM path string is lng,lat pairs joined by semicolons', () => {
  expect(osrmPath([[24.03, 49.84], [24.04, 49.85]])).toBe('24.03,49.84;24.04,49.85');
});
