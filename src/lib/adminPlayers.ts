import { supabase } from '@/lib/supabase';

// Admin view of the players (migration 0006): names, animals, and each player's last logged position.
export type AdminPlayer = {
  user_id: string;
  nickname: string;
  avatar: string;
  created_at: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  seen_at: string | null;
};

export async function listPlayers(): Promise<AdminPlayer[]> {
  const { data, error } = await supabase.rpc('admin_players');
  if (error) throw new Error('Не вдалося завантажити гравців');
  return (data ?? []) as AdminPlayer[];
}

// Removes the player. Their next visit signs them out and asks for an animal again.
export async function removePlayer(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_remove_player', { p_user_id: userId });
  if (error) throw new Error('Не вдалося видалити гравця');
  return data === true;
}
