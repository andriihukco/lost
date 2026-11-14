import type { MapKind } from '@/lib/mapStyle';

// The map kind the player chose (outdoor or hybrid), remembered per browser. An old saved value falls back to outdoor.
const KEY = 'lost.mapKind';
const KINDS: MapKind[] = ['outdoor', 'hybrid'];

export function loadMapKind(storage: Storage): MapKind {
  try {
    const v = storage.getItem(KEY);
    return KINDS.includes(v as MapKind) ? (v as MapKind) : 'outdoor';
  } catch {
    return 'outdoor';
  }
}

export function saveMapKind(storage: Storage, kind: MapKind): void {
  if (!KINDS.includes(kind)) return;
  try {
    storage.setItem(KEY, kind);
  } catch {
    // storage blocked: the choice simply lasts for this visit
  }
}
