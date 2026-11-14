import { expect, test } from 'vitest';
import { walkSeconds } from '@/lib/routing';

test('walking time at 4.5 km/h', () => {
  expect(walkSeconds(4500)).toBeCloseTo(3600, 0); // 4.5 km takes one hour
  expect(walkSeconds(0)).toBe(0);
});
