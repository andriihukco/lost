import { ensureSession } from '@/lib/session';
import { generateRoomCode } from '@/lib/roomCode';
import { supabase } from '@/lib/supabase';

export type Room = {
  id: string;
  code: string;
  name: string | null;
  host_id: string;
  status: 'active' | 'finished';
};

// join_room returns zero rows for an unknown code (see migration 0001).
export async function joinRoom(code: string): Promise<Room | null> {
  const { data, error } = await supabase.rpc('join_room', { p_code: code });
  if (error) throw new Error('Не вдалося знайти кімнату');
  return (data as Room[])[0] ?? null;
}

// Retries on unique-code collision (Postgres 23505), up to three attempts.
export async function createRoom(name: string): Promise<Room> {
  const { userId } = await ensureSession();
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from('rooms')
      .insert({ code: generateRoomCode(), name: name.trim() || null, host_id: userId })
      .select()
      .single();
    if (!error) return data as Room;
    if (error.code !== '23505') throw new Error('Не вдалося створити кімнату');
  }
  throw new Error('Не вдалося створити кімнату. Спробуйте ще раз.');
}
