import { expect, test } from 'vitest';
import { AVATARS, availableAvatars, isTaken } from '@/lib/avatars';
import { validateTreasure } from '@/lib/treasureRules';

test('an animal taken by another player is not available', () => {
  expect(isTaken('fox', ['fox', 'bear'], 'me')).toBe(true);
});
test('my own animal stays available to me', () => {
  expect(isTaken('fox', ['fox'], 'fox')).toBe(false);
});
test('available list excludes taken animals and keeps my own', () => {
  const avail = availableAvatars(['fox', 'bear'], 'bear').map((a) => a.key);
  expect(avail).not.toContain('fox');
  expect(avail).toContain('bear');
  expect(avail.length).toBe(AVATARS.length - 1); // only "fox" is taken by someone else
});
test('pin emoji is required and short', () => {
  const ok = { title: 'Гриб', hint: '', lat: 49.8, lng: 24.0, photoCount: 1, pinEmoji: '🍄' };
  expect(validateTreasure(ok)).toEqual([]);
  expect(validateTreasure({ ...ok, pinEmoji: '   ' })).toContain('Оберіть емодзі для мітки');
  expect(validateTreasure({ ...ok, pinEmoji: 'toolongtext' })).toContain('Оберіть емодзі для мітки');
});
