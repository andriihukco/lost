// The hint photo over the live camera: a single opacity value the player can slide.
export const OVERLAY_DEFAULT = 0.5;

export function clampOpacity(v: number): number {
  if (!Number.isFinite(v)) return OVERLAY_DEFAULT;
  return Math.min(1, Math.max(0, v));
}
