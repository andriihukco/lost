// Map marks: admin-placed warnings and notes (not treasures). Pure helpers, so they can be tested.
export const MARK_DEFAULT_EMOJI = '⚠️';

export function markEmoji(e: string | null | undefined): string {
  const t = (e ?? '').trim();
  return t.length > 0 ? t : MARK_DEFAULT_EMOJI;
}
