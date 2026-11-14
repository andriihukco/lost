import { supabase } from '@/lib/supabase';

export type FoundStatus = 'won' | 'taken' | 'not_player' | 'not_found';

// Atomic first-come claim via the mark_found RPC (migration 0001, spec §6.4).
export async function markFound(treasureId: string, manualNote?: string): Promise<FoundStatus> {
  const { data, error } = await supabase.rpc('mark_found', {
    p_treasure_id: treasureId,
    p_manual_note: manualNote ?? null,
  });
  if (error || !data) throw new Error('Не вдалося підтвердити знахідку');
  return (data as { status: FoundStatus }).status;
}
