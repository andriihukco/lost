import { expect, test } from 'vitest';
import { cardinal } from '@/lib/geoFormat';
import { hasArrived, markArrived } from '@/lib/arrival';

test.each([
  [0, 'північ'],
  [350, 'північ'],
  [45, 'північний схід'],
  [90, 'схід'],
  [180, 'південь'],
  [270, 'захід'],
  [225, 'південний захід'],
])('bearing %d is %s', (deg, label) => {
  expect(cardinal(deg)).toBe(label);
});

function memoryStorage(): Storage {
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

test('arrival is remembered per treasure', () => {
  const s = memoryStorage();
  expect(hasArrived(s, 't1')).toBe(false);
  markArrived(s, 't1');
  expect(hasArrived(s, 't1')).toBe(true);
  expect(hasArrived(s, 't2')).toBe(false);
});
test('a broken storage does not break the flow', () => {
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } as unknown as Storage;
  expect(hasArrived(broken, 't1')).toBe(false);
  expect(() => markArrived(broken, 't1')).not.toThrow();
});
