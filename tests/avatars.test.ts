import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { AVATARS, nicknameFor } from '@/lib/avatars';

// The avatar keys must match the check constraint in migration 0003 exactly.
test('avatar keys match the database check constraint', () => {
  const sql = readFileSync('supabase/migrations/0003_admin_global.sql', 'utf8');
  const match = sql.match(/avatar in \(([\s\S]*?)\)\)/);
  expect(match).not.toBeNull();
  const dbKeys = [...match![1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  expect(AVATARS.map((a) => a.key)).toEqual(dbKeys);
});

test('every avatar has a unique key and an emoji', () => {
  const keys = new Set(AVATARS.map((a) => a.key));
  expect(keys.size).toBe(AVATARS.length);
  for (const a of AVATARS) expect(a.emoji.length).toBeGreaterThan(0);
});

test('every animal has a predefined two-word nickname, and no two animals share one', () => {
  const names = AVATARS.map((a) => a.nickname);
  expect(new Set(names).size).toBe(AVATARS.length);
  for (const n of names) {
    expect(n.split(' ')).toHaveLength(2);
    expect(n.length).toBeLessThanOrEqual(24); // the players.nickname column limit
  }
});

test('the nickname follows the animal', () => {
  expect(nicknameFor('monkey')).toBe('Щаслива Мавпа');
  expect(nicknameFor('cat')).toBe('Дикий Кіт');
});

test('an unknown animal has no nickname', () => {
  expect(nicknameFor('dragon')).toBeNull();
});
