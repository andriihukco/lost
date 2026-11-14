import { expect, test } from 'vitest';
import { imagesFromClipboard, takeUpTo } from '@/lib/clipboardImages';

const png = new File(['a'], 'shot.png', { type: 'image/png' });
const jpg = new File(['b'], 'photo.jpg', { type: 'image/jpeg' });
const txt = new File(['c'], 'notes.txt', { type: 'text/plain' });

test('pasted image files are picked up from the clipboard items', () => {
  const data = { items: [{ kind: 'file', type: 'image/png', getAsFile: () => png }, { kind: 'string', type: 'text/plain', getAsFile: () => null }], files: [] };
  expect(imagesFromClipboard(data)).toEqual([png]);
});

test('files list is used when items are missing (some browsers)', () => {
  const data = { items: [], files: [jpg, txt] };
  expect(imagesFromClipboard(data)).toEqual([jpg]);
});

test('plain text paste yields no images', () => {
  const data = { items: [{ kind: 'string', type: 'text/plain', getAsFile: () => null }], files: [] };
  expect(imagesFromClipboard(data)).toEqual([]);
});

test('null clipboard yields no images', () => {
  expect(imagesFromClipboard(null)).toEqual([]);
});

test('takeUpTo keeps only as many files as there is room for', () => {
  expect(takeUpTo([png, jpg, png], 2)).toEqual([png, jpg]);
  expect(takeUpTo([png], 0)).toEqual([]);
});
