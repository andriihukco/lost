import { expect, test } from 'vitest';
import { optimalOrder, pathLengthM, EXACT_LIMIT } from '@/lib/routePlan';

const start = { lat: 49.8400, lng: 24.0300 };
// three points on a line going east from the start: the best walk is west to east
const east = { lat: 49.8400, lng: 24.0400 };
const mid = { lat: 49.8400, lng: 24.0350 };
const far = { lat: 49.8400, lng: 24.0500 };

test('exact: visits points in the shortest order', () => {
  // given in the wrong order on purpose
  const pts = [far, east, mid];
  const order = optimalOrder(start, pts);
  expect(order.map((i) => pts[i])).toEqual([mid, east, far]); // west to east from the start
});
test('path length of an order is the sum of legs', () => {
  const d = pathLengthM(start, [mid, far]);
  expect(d).toBeGreaterThan(0);
  expect(d).toBeCloseTo(pathLengthM(start, [mid]) + pathLengthM(mid, [far]), 0);
});
test('no stops: empty order', () => {
  expect(optimalOrder(start, [])).toEqual([]);
});
test('more stops than the exact limit still returns a full permutation', () => {
  const many = Array.from({ length: EXACT_LIMIT + 4 }, (_, i) => ({ lat: 49.84 + i * 0.001, lng: 24.03 + ((i * 7) % 5) * 0.001 }));
  const order = optimalOrder(start, many);
  expect([...order].sort((a, b) => a - b)).toEqual(many.map((_, i) => i));
});
test('exact order is never longer than a heuristic order for small sets', () => {
  const pts = [far, mid, east];
  const best = pathLengthM(start, optimalOrder(start, pts).map((i) => pts[i]));
  expect(best).toBeLessThanOrEqual(pathLengthM(start, pts));
});
