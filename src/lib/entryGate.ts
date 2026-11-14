import type { HeadingStatus } from '@/lib/useHeading';
import type { WelcomeStep } from '@/lib/welcome';

export type LocationPerm = 'granted' | 'prompt' | 'denied' | 'unknown';
export type CompassPerm = 'granted' | 'prompt' | 'denied' | 'unavailable';

// The compass reports its state as a HeadingStatus; the gate reads it as a permission.
export function compassPermOf(status: HeadingStatus): CompassPerm {
  if (status === 'listening') return 'granted';
  if (status === 'needs-permission') return 'prompt';
  if (status === 'denied') return 'denied';
  return 'unavailable';
}

// The step the player must finish before the map opens, or null when they may enter.
// A first-time player starts at the intro. A returning player is sent back only for a missing permission:
// location not granted, or a compass that still needs a tap (iPhone) or was denied. A device with no compass
// (desktop) and a browser that cannot report its permission do not block entry.
export function firstGateStep(welcomed: boolean, location: LocationPerm, compass: CompassPerm): WelcomeStep | null {
  if (!welcomed) return 'intro';
  if (location === 'prompt' || location === 'denied') return 'location';
  if (compass === 'prompt' || compass === 'denied') return 'compass';
  return null;
}
