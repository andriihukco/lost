import { expect, test } from 'vitest';
import { shouldDropSession } from '@/lib/sessionRules';

test('a server rejection drops the stored identity', () => {
  expect(shouldDropSession({ status: 401 })).toBe(true);
  expect(shouldDropSession({ status: 403 })).toBe(true);
});
test('a network failure keeps it: going offline must not create a new player', () => {
  expect(shouldDropSession({})).toBe(false);
  expect(shouldDropSession({ status: 500 })).toBe(false);
  expect(shouldDropSession(null)).toBe(false);
});
