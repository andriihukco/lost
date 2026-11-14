import { expect, test } from 'vitest';
import { clampOpacity, OVERLAY_DEFAULT } from '@/lib/cameraOverlay';

test('opacity stays between 0 and 1', () => {
  expect(clampOpacity(-0.2)).toBe(0);
  expect(clampOpacity(1.4)).toBe(1);
  expect(clampOpacity(0.35)).toBe(0.35);
});
test('a non-number falls back to the default', () => {
  expect(clampOpacity(Number.NaN)).toBe(OVERLAY_DEFAULT);
  expect(OVERLAY_DEFAULT).toBe(0.5);
});
