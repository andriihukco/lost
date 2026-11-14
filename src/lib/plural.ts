// Ukrainian plural for a count: 1 точка, 2 точки, 5 точок, 11 точок, 21 точка.
// forms: [for 1, for 2–4, for 5+], e.g. ['точка', 'точки', 'точок'].
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(Math.trunc(n));
  const last = abs % 10;
  const lastTwo = abs % 100;
  if (last === 1 && lastTwo !== 11) return forms[0];
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return forms[1];
  return forms[2];
}
