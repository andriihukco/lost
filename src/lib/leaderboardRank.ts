// Pure ranking of leaderboard rows (no client imports, so it can be tested without a backend).
// One row per player, from the leaderboard() RPC (migration 0006): counts only, plus the public name and animal.
export type BoardRow = {
  user_id: string;
  nickname: string;
  avatar: string;
  first_places: number; // first to the place (the arrival step), per treasure
  first_finds: number; // first to the treasure, per treasure
  finds: number; // treasures currently found by the player
};

export type BoardCategory = 'places' | 'firsts' | 'finds';

const FIELD: Record<BoardCategory, keyof BoardRow> = {
  places: 'first_places',
  firsts: 'first_finds',
  finds: 'finds',
};

export type Ranked = BoardRow & { value: number; place: number | null };

// Sorts by the chosen count, highest first; players with the same count share a place (1, 1, 3, ...).
// A zero count has no place and is listed after the ranked players, by nickname. The input is not changed.
export function rankRows(rows: BoardRow[], category: BoardCategory): Ranked[] {
  const field = FIELD[category];
  const sorted = rows
    .map((r) => ({ ...r, value: Number(r[field]) }))
    .sort((a, b) => b.value - a.value || a.nickname.localeCompare(b.nickname, 'uk'));
  return sorted.map((r) => ({
    ...r,
    place: r.value > 0 ? 1 + sorted.filter((o) => o.value > r.value).length : null,
  }));
}
