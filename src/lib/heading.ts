// Compass heading of the player, in degrees clockwise from north. Pure, so it can be tested.

export const TURN_BROADCAST_DEG = 30;
export const TURN_BROADCAST_MIN_MS = 2000;

const norm = (deg: number) => ((deg % 360) + 360) % 360;

// Direction of the target as seen from my heading: 0 = straight ahead, 90 = to my right.
export function relativeBearing(targetDeg: number, headingDeg: number | null): number | null {
  if (headingDeg === null) return null;
  return norm(targetDeg - headingDeg);
}

// Send the heading to other players when it turned enough, at most every 2 s.
export function shouldBroadcastHeading(
  last: number | null,
  next: number | null,
  lastSentAt: number,
  now: number,
): boolean {
  if (next === null) return false;
  if (now - lastSentAt < TURN_BROADCAST_MIN_MS) return false;
  if (last === null) return true;
  const d = Math.abs(norm(next) - norm(last));
  return Math.min(d, 360 - d) >= TURN_BROADCAST_DEG;
}

export type OrientationReading = {
  alpha?: number | null;
  absolute?: boolean;
  webkitCompassHeading?: number;
};

// iOS reports a compass heading directly. Android reports an absolute alpha (counter-clockwise from north).
// A relative alpha is not a compass heading, so it gives null.
export function headingFromOrientation(e: OrientationReading): number | null {
  if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading)) {
    return norm(e.webkitCompassHeading);
  }
  if (e.absolute && typeof e.alpha === 'number' && Number.isFinite(e.alpha)) {
    return norm(360 - e.alpha);
  }
  return null;
}
