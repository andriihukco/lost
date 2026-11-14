import { expect, test } from 'vitest';
import { plural } from '@/lib/plural';

const POINT: [string, string, string] = ['точка', 'точки', 'точок'];

test('Ukrainian plurals: 1 точка, 2–4 точки, 5+ точок', () => {
  expect(plural(1, POINT)).toBe('точка');
  expect(plural(2, POINT)).toBe('точки');
  expect(plural(4, POINT)).toBe('точки');
  expect(plural(5, POINT)).toBe('точок');
  expect(plural(0, POINT)).toBe('точок');
});

test('the teens are the many form, and 21 is the one form again', () => {
  expect(plural(11, POINT)).toBe('точок');
  expect(plural(12, POINT)).toBe('точок');
  expect(plural(14, POINT)).toBe('точок');
  expect(plural(21, POINT)).toBe('точка');
  expect(plural(22, POINT)).toBe('точки');
  expect(plural(112, POINT)).toBe('точок');
});
