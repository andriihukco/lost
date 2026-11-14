// The emoji shown on a treasure's map pin. Admins type any emoji they like; the default applies when it is empty.
export const DEFAULT_PIN = '🍄';

export function pinOrDefault(e: string | null | undefined): string {
  const t = (e ?? '').trim();
  return t.length > 0 ? t : DEFAULT_PIN;
}
