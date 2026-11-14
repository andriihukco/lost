import { expect, test } from 'vitest';
import { edgePoint, isInside } from '@/lib/offscreen';

const bounds = { minX: 0, minY: 0, maxX: 800, maxY: 600 };
const origin = { x: 400, y: 300 };

test('a point inside the visible area is not an edge case', () => {
  expect(isInside({ x: 500, y: 350 }, bounds)).toBe(true);
  expect(edgePoint({ x: 500, y: 350 }, origin, bounds)).toBeNull();
});
test('to the right: the marker sits on the right edge, angle 0', () => {
  const e = edgePoint({ x: 900, y: 300 }, origin, bounds);
  expect(e?.x).toBeCloseTo(800);
  expect(e?.y).toBeCloseTo(300);
  expect(e?.angle).toBeCloseTo(0);
});
test('above: the marker sits on the top edge, angle -90', () => {
  const e = edgePoint({ x: 400, y: -500 }, origin, bounds);
  expect(e?.x).toBeCloseTo(400);
  expect(e?.y).toBeCloseTo(0);
  expect(e?.angle).toBeCloseTo(-90);
});
test('diagonal: the marker sits on the corner-side edge, angle 45', () => {
  const e = edgePoint({ x: 1000, y: 900 }, origin, bounds);
  expect(e?.x).toBeCloseTo(700);
  expect(e?.y).toBeCloseTo(600);
  expect(e?.angle).toBeCloseTo(45);
});
