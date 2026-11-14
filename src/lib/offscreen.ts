// Off-screen treasure indicators: where a treasure outside the visible map should be drawn, on the edge.
// Pure geometry in screen pixels (y grows downward; angle 0 = right, 90 = down, -90 = up).

export type Pt = { x: number; y: number };
export type Box = { minX: number; minY: number; maxX: number; maxY: number };
export type Edge = Pt & { angle: number };

export function isInside(p: Pt, b: Box): boolean {
  return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;
}

// Where the ray from the origin to the target leaves the visible box, and the direction of that ray.
// Returns null when the target is already visible.
export function edgePoint(target: Pt, origin: Pt, b: Box): Edge | null {
  if (isInside(target, b)) return null;
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const tx = dx > 0 ? (b.maxX - origin.x) / dx : dx < 0 ? (b.minX - origin.x) / dx : Infinity;
  const ty = dy > 0 ? (b.maxY - origin.y) / dy : dy < 0 ? (b.minY - origin.y) / dy : Infinity;
  const t = Math.min(tx, ty);
  if (!Number.isFinite(t)) return null;
  return {
    x: origin.x + t * dx,
    y: origin.y + t * dy,
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}
