import { expect, test } from 'vitest';
import { checkPin, clearPasscode, isPin, LOCK_OPTIONS, passcodeSummary, readPasscode, setLockAfter, setPasscode } from '@/lib/passcode';

function memory(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  } as unknown as Storage;
}

test('a passcode is exactly four digits', () => {
  expect(isPin('0482')).toBe(true);
  expect(isPin('482')).toBe(false);
  expect(isPin('48213')).toBe(false);
  expect(isPin('4a82')).toBe(false);
});

test('the code is checked against a salted hash; the code itself is not stored', async () => {
  const s = memory();
  await setPasscode(s, '4821', 5 * 60_000);
  expect(await checkPin(s, '4821')).toBe(true);
  expect(await checkPin(s, '4822')).toBe(false);
  expect(readPasscode(s)?.hash).not.toContain('4821');
  expect(JSON.stringify(readPasscode(s))).not.toContain('4821');
});

test('the lock time can change, and clearing removes the code', async () => {
  const s = memory();
  await setPasscode(s, '1234');
  setLockAfter(s, LOCK_OPTIONS[2].ms);
  expect(readPasscode(s)?.lockAfterMs).toBe(LOCK_OPTIONS[2].ms);
  expect(passcodeSummary(readPasscode(s))).toBe('Увімкнено · через 15 хвилин');
  clearPasscode(s);
  expect(readPasscode(s)).toBeNull();
  expect(passcodeSummary(null)).toBe('Вимкнено');
});
