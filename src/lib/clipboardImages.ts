// Image files from a paste. Items are read first (they carry the real file of a pasted screenshot); the files
// list is the fallback for browsers that fill only that. Non-image content gives no files.
export type ClipboardLike = {
  items?: ArrayLike<{ kind: string; type: string; getAsFile: () => File | null }>;
  files?: ArrayLike<File>;
} | null;

export function imagesFromClipboard(data: ClipboardLike): File[] {
  if (!data) return [];
  const out: File[] = [];
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) out.push(file);
  }
  if (out.length > 0) return out;
  return Array.from(data.files ?? []).filter((f) => f.type.startsWith('image/'));
}

// The first n files, for a photo count that has room for only n more.
export function takeUpTo<T>(files: T[], room: number): T[] {
  return files.slice(0, Math.max(0, room));
}
