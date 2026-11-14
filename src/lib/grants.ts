import type { CompassPerm, LocationPerm } from '@/lib/entryGate';

// Permissions the player has granted in this browser. Stored in local storage, so clearing the site's data
// clears them too and the player is asked again. A browser that reports "prompt" for a remembered grant is
// trusted: the permission was given before. A denial is always believed.
export type Grant = 'location' | 'compass';
const KEY = 'lost.grants';

export function readGrants(storage: Storage): Partial<Record<Grant, boolean>> {
  try {
    const v = JSON.parse(storage.getItem(KEY) ?? '{}') as unknown;
    return v && typeof v === 'object' ? (v as Partial<Record<Grant, boolean>>) : {};
  } catch {
    return {};
  }
}

export function rememberGrant(storage: Storage, grant: Grant): void {
  try {
    storage.setItem(KEY, JSON.stringify({ ...readGrants(storage), [grant]: true }));
  } catch {
    // storage blocked: the player is asked again next visit
  }
}

export function effectiveLocation(reported: LocationPerm, remembered: boolean): LocationPerm {
  if (reported === 'denied') return 'denied';
  if (remembered && (reported === 'prompt' || reported === 'unknown')) return 'granted';
  return reported;
}

export function effectiveCompass(reported: CompassPerm, remembered: boolean): CompassPerm {
  if (remembered && reported === 'prompt') return 'granted';
  return reported;
}
