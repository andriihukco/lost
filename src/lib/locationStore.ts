import type { LatLng } from '@/lib/geo';
import { supabase } from '@/lib/supabase';

// Trail point for later path / search history. RLS: a player writes only their own rows.
export async function saveLocation(userId: string, p: LatLng, accuracy: number | null): Promise<void> {
  const { error } = await supabase.from('location_log').insert({
    user_id: userId,
    lat: p.lat,
    lng: p.lng,
    accuracy,
  });
  if (error) throw new Error('location log failed');
}
