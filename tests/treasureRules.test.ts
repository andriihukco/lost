import { expect, test } from 'vitest';
import { MAX_PHOTOS, validateTreasure } from '@/lib/treasureRules';

const ok = { title: 'Гриб', hint: '', lat: 49.8, lng: 24.0, photoCount: 1 };

test('a valid treasure has no errors', () => {
  expect(validateTreasure(ok)).toEqual([]);
});
test('title is required and at most 80 characters', () => {
  expect(validateTreasure({ ...ok, title: '   ' })).toContain('Додайте назву скарбу');
  expect(validateTreasure({ ...ok, title: 'x'.repeat(81) })).toContain('Назва до 80 символів');
});
test('hint is at most 300 characters', () => {
  expect(validateTreasure({ ...ok, hint: 'x'.repeat(301) })).toContain('Підказка до 300 символів');
});
test('coordinates must be present and in range', () => {
  expect(validateTreasure({ ...ok, lat: null })).toContain('Вкажіть координати');
  expect(validateTreasure({ ...ok, lat: 91 })).toContain('Вкажіть координати');
  expect(validateTreasure({ ...ok, lng: 181 })).toContain('Вкажіть координати');
});
test('at least one photo, at most MAX_PHOTOS', () => {
  expect(MAX_PHOTOS).toBe(3);
  expect(validateTreasure({ ...ok, photoCount: 0 })).toContain('Потрібне принаймні одне фото');
  expect(validateTreasure({ ...ok, photoCount: 4 })).toContain('Не більше 3 фото');
});
