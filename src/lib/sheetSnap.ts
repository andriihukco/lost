// Fractions of viewport height that the sheet shows (spec §5.3).
export const SNAPS = { peek: 0.18, half: 0.5, full: 0.92 } as const;
export type SnapName = keyof typeof SNAPS;

// UIScrollView-style deceleration: projected travel = v * r / (1 − r) / 1000 with r = 0.998, about 0.499 × v (px).
const PROJECTION_PER_PX_PER_S = (0.998 / (1 - 0.998)) / 1000;

// velocity is px/s, positive = moving down. The end point is projected from velocity, not from current position.
export function nearestSnap(current: number, velocity: number, viewportH: number): SnapName {
  const projected = current - (velocity * PROJECTION_PER_PX_PER_S) / viewportH;
  let best: SnapName = 'peek';
  let bestDistance = Infinity;
  for (const name of Object.keys(SNAPS) as SnapName[]) {
    const d = Math.abs(SNAPS[name] - projected);
    if (d < bestDistance) {
      best = name;
      bestDistance = d;
    }
  }
  return best;
}
