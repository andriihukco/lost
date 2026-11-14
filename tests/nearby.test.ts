import { expect, test } from 'vitest';
import { nearestWithin, NEARBY_M } from '@/lib/nearby';

const pos = { lat: 49.8419, lng: 24.0315 };
const t = (id: string, dLat: number, is_found = false) => ({ id, lat: pos.lat + dLat, lng: pos.lng, is_found });

test('nearby radius is 10 m', () => {
  expect(NEARBY_M).toBe(10);
});
test('returns the closest unfound treasure within 10 m', () => {
  const r = nearestWithin([t('far', 0.0002), t('near', 0.00005)], pos);
  expect(r?.treasure.id).toBe('near');
  expect(r?.distanceM).toBeLessThan(10);
});
test('ignores found treasures', () => {
  expect(nearestWithin([t('done', 0.00003, true)], pos)).toBeNull();
});
test('ignores treasures farther than 10 m', () => {
  expect(nearestWithin([t('far', 0.0002)], pos)).toBeNull();
});
test('no position means no nearby treasure', () => {
  expect(nearestWithin([t('near', 0.00001)], null)).toBeNull();
});
