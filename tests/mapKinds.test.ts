import { expect, test } from 'vitest';
import { loadMapKind, saveMapKind } from '@/lib/mapKind';
import { styleFor } from '@/lib/mapStyle';

function memory(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as unknown as Storage;
}

test('with a MapTiler key the three kinds are the three MapTiler styles', () => {
  expect(styleFor('outdoor', 'KEY')).toBe('https://api.maptiler.com/maps/outdoor-v2/style.json?key=KEY');
  expect(styleFor('satellite', 'KEY')).toBe('https://api.maptiler.com/maps/satellite/style.json?key=KEY');
  expect(styleFor('hybrid', 'KEY')).toBe('https://api.maptiler.com/maps/hybrid/style.json?key=KEY');
});

test('without a key, outdoor is the trails reserve', () => {
  const s = styleFor('outdoor', undefined);
  expect(typeof s).toBe('object');
  expect(Object.keys((s as { sources: object }).sources)).toEqual(['routes']);
});

test('without a key, satellite is free imagery with no trail overlay', () => {
  const s = styleFor('satellite', undefined) as { sources: Record<string, unknown> };
  expect(Object.keys(s.sources)).toEqual(['imagery']);
});

test('without a key, hybrid is imagery with the trail overlay on top', () => {
  const s = styleFor('hybrid', undefined) as { sources: Record<string, unknown> };
  expect(Object.keys(s.sources).sort()).toEqual(['imagery', 'routes']);
});

test('the map kind is remembered per browser; a blocked storage falls back to outdoor', () => {
  const s = memory();
  expect(loadMapKind(s)).toBe('outdoor');
  saveMapKind(s, 'satellite');
  expect(loadMapKind(s)).toBe('satellite');
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } as unknown as Storage;
  expect(loadMapKind(broken)).toBe('outdoor');
  expect(() => saveMapKind(broken, 'hybrid')).not.toThrow();
  expect(loadMapKind(s)).toBe('satellite');
  saveMapKind(s, 'bogus' as never);
  expect(loadMapKind(s)).toBe('satellite');
});
