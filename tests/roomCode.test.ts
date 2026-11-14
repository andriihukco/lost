import { expect, test } from 'vitest';
import { generateRoomCode, ROOM_CODE_ALPHABET } from '@/lib/roomCode';

test('code is 6 chars from the alphabet', () => {
  const code = generateRoomCode();
  expect(code).toHaveLength(6);
  for (const ch of code) expect(ROOM_CODE_ALPHABET).toContain(ch);
});
test('alphabet has no ambiguous characters', () => {
  for (const ch of '01ilo') expect(ROOM_CODE_ALPHABET).not.toContain(ch);
});
test('injected random gives a deterministic code', () => {
  expect(generateRoomCode(() => 0)).toBe('aaaaaa');
});
