import { expect, test } from 'vitest';
import { readOfflineStatus, writeOfflineStatus } from '@/lib/offlineMap';

function memory(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  } as unknown as Storage;
}

test('the saved status is remembered per browser: when and how many files', () => {
  const s = memory();
  expect(readOfflineStatus(s)).toBeNull();
  writeOfflineStatus(s, { savedAt: '2026-11-15T10:00:00.000Z', files: 54 });
  expect(readOfflineStatus(s)).toEqual({ savedAt: '2026-11-15T10:00:00.000Z', files: 54 });
});

test('a broken or foreign value counts as not saved', () => {
  const s = memory();
  s.setItem('lost.offlineMap', '{not json');
  expect(readOfflineStatus(s)).toBeNull();
  s.setItem('lost.offlineMap', JSON.stringify({ savedAt: 5, files: 'many' }));
  expect(readOfflineStatus(s)).toBeNull();
});
