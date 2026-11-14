import { expect, test } from 'vitest';
import { isWelcomed, markWelcomed, WELCOME_KEY, WELCOME_STEPS } from '@/lib/welcome';

function memory(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() { return m.size; },
  } as Storage;
}

test('first visit is not welcomed yet', () => {
  expect(isWelcomed(memory())).toBe(false);
});
test('after the welcome is finished it is remembered', () => {
  const s = memory();
  markWelcomed(s);
  expect(isWelcomed(s)).toBe(true);
  expect(s.getItem(WELCOME_KEY)).toBe('1');
});
test('a blocked storage shows the welcome again rather than breaking', () => {
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } as unknown as Storage;
  expect(isWelcomed(broken)).toBe(false);
  expect(() => markWelcomed(broken)).not.toThrow();
});
test('welcome steps: intro, location, compass', () => {
  expect(WELCOME_STEPS).toEqual(['intro', 'location', 'compass']);
});
