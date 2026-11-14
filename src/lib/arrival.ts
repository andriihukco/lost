// "I found the place" is remembered per browser, so a reload keeps the second step.
// Takes a Storage-like object so it can be tested and so a blocked storage cannot break the flow.
const KEY = 'lost.arrived';

function read(storage: Storage): string[] {
  try {
    const raw = storage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function hasArrived(storage: Storage, treasureId: string): boolean {
  return read(storage).includes(treasureId);
}

export function markArrived(storage: Storage, treasureId: string): void {
  try {
    const ids = read(storage);
    if (!ids.includes(treasureId)) storage.setItem(KEY, JSON.stringify([...ids, treasureId]));
  } catch {
    // storage blocked: the player simply taps "Я знайшов місце" again
  }
}
