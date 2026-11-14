import { expect, test } from 'vitest';
import { timeAgo } from '@/lib/timeAgo';

const now = Date.parse('2026-11-14T12:00:00Z');
const ago = (ms: number) => new Date(now - ms).toISOString();

test('just now under a minute', () => {
  expect(timeAgo(ago(20_000), now)).toBe('щойно');
});
test('minutes, then hours, then days', () => {
  expect(timeAgo(ago(5 * 60_000), now)).toBe('5 хв тому');
  expect(timeAgo(ago(3 * 3_600_000), now)).toBe('3 год тому');
  expect(timeAgo(ago(2 * 86_400_000), now)).toBe('2 дн тому');
});
test('no time means never', () => {
  expect(timeAgo(null, now)).toBe('ніколи');
});
test('a time in the future counts as just now', () => {
  expect(timeAgo(new Date(now + 60_000).toISOString(), now)).toBe('щойно');
});
