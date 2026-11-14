import { expect, test } from 'vitest';
import { haversineM, isFoundable } from '@/lib/geo';

test('0.001 degrees of latitude is about 111.2 m', () => {
  const d = haversineM({ lat: 49.8419, lng: 24.0315 }, { lat: 49.8429, lng: 24.0315 });
  expect(d).toBeCloseTo(111.2, 0);
});
test('same point is 0 m', () => {
  expect(haversineM({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
});
test('40 m with 30 m accuracy is foundable', () => {
  expect(isFoundable(40, 30)).toBe(true);
});
test('40 m with 5 m accuracy is not foundable', () => {
  expect(isFoundable(40, 5)).toBe(false);
});
test('exactly 15 m with 0 accuracy is foundable', () => {
  expect(isFoundable(15, 0)).toBe(true);
});
test('missing, NaN or negative accuracy gives no compensation', () => {
  expect(isFoundable(16, undefined)).toBe(false);
  expect(isFoundable(16, null)).toBe(false);
  expect(isFoundable(16, Number.NaN)).toBe(false);
  expect(isFoundable(16, -3)).toBe(false);
  expect(isFoundable(15, undefined)).toBe(true);
});
