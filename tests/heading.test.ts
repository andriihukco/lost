import { expect, test } from 'vitest';
import { relativeBearing, shouldBroadcastHeading, headingFromOrientation } from '@/lib/heading';

test('relative bearing is the target direction from my heading', () => {
  expect(relativeBearing(90, 0)).toBe(90);   // target east, I face north: arrow points right
  expect(relativeBearing(90, 90)).toBe(0);   // I face the target: arrow points up
  expect(relativeBearing(10, 350)).toBe(20); // wrap around north
});
test('no heading means no relative bearing', () => {
  expect(relativeBearing(90, null)).toBeNull();
});
test('broadcast when the heading turned at least 30 degrees and 2 s passed', () => {
  expect(shouldBroadcastHeading(0, 45, 0, 2000)).toBe(true);
  expect(shouldBroadcastHeading(0, 20, 0, 5000)).toBe(false);
  expect(shouldBroadcastHeading(0, 90, 0, 1000)).toBe(false);
  expect(shouldBroadcastHeading(null, 90, 0, 5000)).toBe(true);
});
test('wrap-around turn counts by the short way', () => {
  expect(shouldBroadcastHeading(350, 40, 0, 2000)).toBe(true); // 50 degrees the short way
  expect(shouldBroadcastHeading(355, 10, 0, 2000)).toBe(false); // 15 degrees: below 30
});
test('orientation: iOS compass heading wins when present', () => {
  expect(headingFromOrientation({ webkitCompassHeading: 123, alpha: 0, absolute: false })).toBe(123);
});
test('orientation: absolute alpha converts to a compass heading', () => {
  expect(headingFromOrientation({ alpha: 90, absolute: true })).toBe(270);
  expect(headingFromOrientation({ alpha: 0, absolute: true })).toBe(0);
});
test('orientation: relative alpha is not a compass heading', () => {
  expect(headingFromOrientation({ alpha: 90, absolute: false })).toBeNull();
  expect(headingFromOrientation({ alpha: null, absolute: true })).toBeNull();
});
