import { expect, test } from 'vitest';
import { markEmoji, MARK_DEFAULT_EMOJI } from '@/lib/mapMarkRules';

test('an empty emoji falls back to the warning sign', () => {
  expect(markEmoji('')).toBe(MARK_DEFAULT_EMOJI);
  expect(markEmoji('   ')).toBe(MARK_DEFAULT_EMOJI);
});
test('a typed emoji is kept, trimmed', () => {
  expect(markEmoji(' 🐕 ')).toBe('🐕');
});
