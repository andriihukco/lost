// The emoji shown on a treasure's map pin. Admins pick one of these or type their own.
export const DEFAULT_PIN = '🍄';
export const PIN_PRESETS = ['🍄', '🌳', '🏰', '💎', '🗝️', '🪙', '🎁', '🦉', '🌲', '🪨', '🐞', '🍀', '🧭', '⛲'] as const;

export function pinOrDefault(e: string | null | undefined): string {
  const t = (e ?? '').trim();
  return t.length > 0 ? t : DEFAULT_PIN;
}
