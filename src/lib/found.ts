import { supabase } from '@/lib/supabase';

export type FoundStatus = 'won' | 'taken' | 'not_player' | 'not_found';
export type UnfoundStatus = 'unfound' | 'not_yours' | 'not_found' | 'not_found_state';

// Atomic first-come claim via the mark_found RPC (spec §6.4, migration 0004 records history).
export async function markFound(treasureId: string, manualNote?: string): Promise<FoundStatus> {
  const { data, error } = await supabase.rpc('mark_found', {
    p_treasure_id: treasureId,
    p_manual_note: manualNote ?? null,
  });
  if (error || !data) throw new Error('Не вдалося підтвердити знахідку');
  return (data as { status: FoundStatus }).status;
}

// Undo a mistaken find: the finder (or an admin) sends the treasure back to the map.
export async function unmarkFound(treasureId: string): Promise<UnfoundStatus> {
  const { data, error } = await supabase.rpc('unmark_found', { p_treasure_id: treasureId });
  if (error || !data) throw new Error('Не вдалося повернути скарб');
  return (data as { status: UnfoundStatus }).status;
}
