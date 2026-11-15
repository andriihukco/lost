// The 4-digit passcode that locks the app on this device. It is kept as a salted hash in this browser only.
// It stops someone who picks up the phone from opening the app; it is not a login, and it is not sent anywhere.
// Clearing the site's data removes it, and so does the "Скинути код" action on the lock screen.

export const PASSCODE_KEY = 'lost.passcode';
export const PIN_LENGTH = 4;
const MINUTE = 60_000;
export const DEFAULT_LOCK_MS = 5 * MINUTE;
// How long the app may go untouched before it locks. 0 means never (the code is asked only when the app opens).
export const LOCK_OPTIONS: { ms: number; label: string }[] = [
  { ms: MINUTE, label: 'Через 1 хвилину' },
  { ms: 5 * MINUTE, label: 'Через 5 хвилин' },
  { ms: 15 * MINUTE, label: 'Через 15 хвилин' },
  { ms: 0, label: 'Ніколи' },
];

export type Passcode = { salt: string; hash: string; lockAfterMs: number };

export function isPin(text: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(text);
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`));
  return hex(new Uint8Array(digest));
}

export function readPasscode(storage: Storage): Passcode | null {
  try {
    const raw = storage.getItem(PASSCODE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Passcode>;
    return typeof v.salt === 'string' && typeof v.hash === 'string' && typeof v.lockAfterMs === 'number'
      ? { salt: v.salt, hash: v.hash, lockAfterMs: v.lockAfterMs }
      : null;
  } catch {
    return null;
  }
}

function write(storage: Storage, p: Passcode): void {
  try {
    storage.setItem(PASSCODE_KEY, JSON.stringify(p));
  } catch {
    // storage blocked: no passcode is kept, so the app opens without asking
  }
}

export async function setPasscode(storage: Storage, pin: string, lockAfterMs = DEFAULT_LOCK_MS): Promise<void> {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  write(storage, { salt, hash: await hashPin(pin, salt), lockAfterMs });
}

export function setLockAfter(storage: Storage, lockAfterMs: number): void {
  const p = readPasscode(storage);
  if (p) write(storage, { ...p, lockAfterMs });
}

export async function checkPin(storage: Storage, pin: string): Promise<boolean> {
  const p = readPasscode(storage);
  if (!p) return false;
  return (await hashPin(pin, p.salt)) === p.hash;
}

export function clearPasscode(storage: Storage): void {
  try {
    storage.removeItem(PASSCODE_KEY);
  } catch {
    // nothing to remove
  }
}

// What the settings row says: "Вимкнено", or the code and when it locks.
export function passcodeSummary(p: Passcode | null): string {
  if (!p) return 'Вимкнено';
  const option = LOCK_OPTIONS.find((o) => o.ms === p.lockAfterMs);
  return option ? `Увімкнено · ${option.label.toLowerCase()}` : 'Увімкнено';
}
