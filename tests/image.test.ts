import { expect, test } from 'vitest';
import { fitWithin } from '@/lib/image';

test('landscape scales to max width', () => {
  expect(fitWithin(4000, 3000, 1200)).toEqual({ w: 1200, h: 900 });
});
test('portrait scales to max height', () => {
  expect(fitWithin(3000, 4000, 1200)).toEqual({ w: 900, h: 1200 });
});
test('small image is not upscaled', () => {
  expect(fitWithin(800, 600, 1200)).toEqual({ w: 800, h: 600 });
});
