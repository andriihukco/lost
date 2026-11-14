import { expect, test } from 'vitest';
import { nearestSnap } from '@/lib/sheetSnap';

test('stays at peek when released at peek', () => {
  expect(nearestSnap(0.18, 0, 800)).toBe('peek');
});
test('a fast upward flick projects to full', () => {
  expect(nearestSnap(0.5, -2000, 800)).toBe('full');
});
