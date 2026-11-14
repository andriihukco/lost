// "5 хв тому" style labels for the admin list. Pure, so it can be tested.
export function timeAgo(iso: string | null, now: number): string {
  if (!iso) return 'ніколи';
  const diff = now - Date.parse(iso);
  if (!Number.isFinite(diff) || diff < 60_000) return 'щойно';
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min} хв тому`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} год тому`;
  return `${Math.floor(hours / 24)} дн тому`;
}
