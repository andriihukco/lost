import { expect, test } from 'vitest';
import { rankRows, type BoardRow } from '@/lib/leaderboardRank';

const rows: BoardRow[] = [
  { user_id: 'a', nickname: 'Хитра Лисиця', avatar: 'fox', first_places: 1, first_finds: 0, finds: 0 },
  { user_id: 'b', nickname: 'Сильний Ведмідь', avatar: 'bear', first_places: 0, first_finds: 2, finds: 2 },
  { user_id: 'c', nickname: 'Весела Жаба', avatar: 'frog', first_places: 0, first_finds: 2, finds: 3 },
  { user_id: 'd', nickname: 'Мудра Сова', avatar: 'owl', first_places: 0, first_finds: 0, finds: 0 },
];

test('ranks by the chosen count, highest first', () => {
  const out = rankRows(rows, 'finds');
  expect(out.map((r) => r.user_id)).toEqual(['c', 'b', 'd', 'a']); // zeros last, by nickname
});

test('players with the same count share a place', () => {
  const out = rankRows(rows, 'firsts');
  expect(out.slice(0, 2).map((r) => [r.user_id, r.place])).toEqual([['c', 1], ['b', 1]]); // tie: by nickname
  expect(out.slice(2).every((r) => r.place === null)).toBe(true);
});

test('a zero count is not ranked: it has no place', () => {
  const out = rankRows(rows, 'places');
  expect(out[0]).toMatchObject({ user_id: 'a', place: 1, value: 1 });
  expect(out.slice(1).every((r) => r.place === null && r.value === 0)).toBe(true);
});

test('ties with zero are listed by nickname, and the input is not changed', () => {
  const before = rows.map((r) => r.user_id).join();
  const out = rankRows(rows, 'places');
  expect(out.slice(1).map((r) => r.nickname)).toEqual(['Мудра Сова', 'Сильний Ведмідь', 'Весела Жаба'].sort((x, y) => x.localeCompare(y, 'uk')));
  expect(rows.map((r) => r.user_id).join()).toBe(before);
});
