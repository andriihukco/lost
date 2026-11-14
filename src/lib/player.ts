import type { AvatarKey } from '@/lib/avatars';
import { supabase } from '@/lib/supabase';

export type Player = { user_id: string; nickname: string; avatar: AvatarKey };

export async function getPlayer(userId: string): Promise<Player | null> {
  const { data, error } = await supabase
    .from('players')
    .select('user_id, nickname, avatar')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error('Не вдалося завантажити гравця');
  return (data as Player | null) ?? null;
}

// Onboarding save: one row per identity. RLS only lets a user write their own row.
export async function savePlayer(userId: string, nickname: string, avatar: AvatarKey): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .upsert({ user_id: userId, nickname: nickname.trim(), avatar }, { onConflict: 'user_id' })
    .select('user_id, nickname, avatar')
    .single();
  if (error || !data) throw new Error('Не вдалося зберегти. Спробуйте ще раз.');
  return data as Player;
}

// Server-side check; the admins table is not readable from the client.
export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  return !error && data === true;
}
