import { expect, test } from 'vitest';
import { opacityForAge, lerpLatLng } from '@/lib/interpolate';
import { shouldSend } from '@/lib/sendPolicy';

test('opacity drops to 0.4 after 30 s', () => {
  expect(opacityForAge(29_999)).toBe(1);
  expect(opacityForAge(30_000)).toBe(0.4);
});
test('lerp midpoint', () => {
  expect(lerpLatLng({ lat: 0, lng: 0 }, { lat: 2, lng: 4 }, 0.5)).toEqual({ lat: 1, lng: 2 });
});
test('does not send before 2 s', () => {
  expect(shouldSend({ lat: 0, lng: 0 }, { lat: 0.001, lng: 0 }, 0, 1999)).toBe(false);
});
test('does not send when moved less than 2 m', () => {
  expect(shouldSend({ lat: 0, lng: 0 }, { lat: 0.00001, lng: 0 }, 0, 5000)).toBe(false);
});
test('sends when moved more than 2 m after 2 s', () => {
  expect(shouldSend({ lat: 0, lng: 0 }, { lat: 0.001, lng: 0 }, 0, 2000)).toBe(true);
});
