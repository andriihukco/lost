import { expect, test } from 'vitest';
import { effectiveCompass, effectiveLocation, readGrants, rememberGrant } from '@/lib/grants';

function memory(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as unknown as Storage;
}

test('a granted location is remembered for this browser', () => {
  const s = memory();
  expect(readGrants(s)).toEqual({});
  rememberGrant(s, 'location');
  expect(readGrants(s)).toEqual({ location: true });
  rememberGrant(s, 'compass');
  expect(readGrants(s)).toEqual({ location: true, compass: true });
});

test('a blocked storage remembers nothing and does not break', () => {
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } as unknown as Storage;
  expect(readGrants(broken)).toEqual({});
  expect(() => rememberGrant(broken, 'location')).not.toThrow();
});

test('a remembered location is not asked for again while the browser does not report a denial', () => {
  expect(effectiveLocation('prompt', true)).toBe('granted');
  expect(effectiveLocation('unknown', true)).toBe('granted');
  expect(effectiveLocation('denied', true)).toBe('denied');
  expect(effectiveLocation('prompt', false)).toBe('prompt');
  expect(effectiveLocation('granted', false)).toBe('granted');
});

test('a remembered compass is not asked for again; a refusal still counts', () => {
  expect(effectiveCompass('prompt', true)).toBe('granted');
  expect(effectiveCompass('denied', true)).toBe('denied');
  expect(effectiveCompass('prompt', false)).toBe('prompt');
  expect(effectiveCompass('unavailable', true)).toBe('unavailable');
});
