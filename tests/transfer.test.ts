import { expect, test } from 'vitest';
import { isTransferCode } from '@/lib/transferCode';

test('a transfer code is exactly six digits', () => {
  expect(isTransferCode('048213')).toBe(true);
  expect(isTransferCode(' 048213 ')).toBe(true);
  expect(isTransferCode('04821')).toBe(false);
  expect(isTransferCode('0482134')).toBe(false);
  expect(isTransferCode('04a213')).toBe(false);
  expect(isTransferCode('')).toBe(false);
});
