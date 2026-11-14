import { expect, test } from 'vitest';
import { clusterPins, type PinPoint } from '@/lib/clusterPins';

const p = (id: string, x: number, y: number, lat = 49.8, lng = 24.0): PinPoint => ({ id, x, y, lat, lng });

test('pins far apart on the screen stay separate groups', () => {
  const groups = clusterPins([p('a', 0, 0), p('b', 200, 0), p('c', 0, 200)], 72);
  expect(groups.map((g) => g.ids)).toEqual([['a'], ['b'], ['c']]);
});

test('pins closer than the radius on the screen form one group, centred between them', () => {
  const groups = clusterPins([p('a', 0, 0, 49.80, 24.00), p('b', 30, 0, 49.82, 24.02)], 72);
  expect(groups).toHaveLength(1);
  expect(groups[0].ids).toEqual(['a', 'b']);
  expect(groups[0].lat).toBeCloseTo(49.81, 6);
  expect(groups[0].lng).toBeCloseTo(24.01, 6);
});

test('every point is in exactly one group', () => {
  const pts = [p('a', 0, 0), p('b', 10, 10), p('c', 300, 300), p('d', 305, 300), p('e', 600, 0)];
  const groups = clusterPins(pts, 72);
  const all = groups.flatMap((g) => g.ids).sort();
  expect(all).toEqual(['a', 'b', 'c', 'd', 'e']);
});

test('no points means no groups', () => {
  expect(clusterPins([], 72)).toEqual([]);
});
