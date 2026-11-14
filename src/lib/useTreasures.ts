'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type Treasure = {
  id: string;
  room_id: string;
  title: string;
  hint: string | null;
  lat: number;
  lng: number;
  photo_paths: string[];
  is_found: boolean;
  found_by: string | null;
  found_at: string | null;
};

// RLS limits rows to room members (migration 0001). Realtime updates arrive in Task 10.
export function useTreasures(roomId: string | null) {
  const [treasures, setTreasures] = useState<Treasure[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!roomId) return;
    const { data, error: loadError } = await supabase
      .from('treasures')
      .select('id, room_id, title, hint, lat, lng, photo_paths, is_found, found_by, found_at')
      .eq('room_id', roomId);
    if (loadError) return setError('Не вдалося завантажити скарби');
    setError(null);
    setTreasures((data ?? []) as Treasure[]);
  }, [roomId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { treasures, error, reload };
}
