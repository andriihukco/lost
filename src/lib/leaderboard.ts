import { supabase } from '@/lib/supabase';
import type { BoardRow } from '@/lib/leaderboardRank';

export type { BoardCategory, BoardRow, Ranked } from '@/lib/leaderboardRank';

export async function fetchLeaderboard(): Promise<BoardRow[]> {
  const { data, error } = await supabase.rpc('leaderboard');
  if (error) throw new Error('Не вдалося завантажити рейтинг');
  return (data ?? []) as BoardRow[];
}
