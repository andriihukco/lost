'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type Treasure = {
  id: string;
  title: string;
  hint: string | null;
  lat: number;
  lng: number;
  photo_paths: string[];
  pin_emoji: string;
  is_found: boolean;
  found_by: string | null;
  found_at: string | null;
};

// RLS: every signed-in user reads all treasures (migration 0003). Realtime updates come from the game channel.
// Load only once the caller is signed in (enabled): before that, the query runs as anonymous and gets no rows.
export function useTreasures(enabled: boolean) {
  const [treasures, setTreasures] = useState<Treasure[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('treasures')
      .select('id, title, hint, lat, lng, photo_paths, pin_emoji, is_found, found_by, found_at')
      .order('created_at', { ascending: true });
    if (loadError) return setError('Не вдалося завантажити скарби');
    setError(null);
    setTreasures((data ?? []) as Treasure[]);
  }, []);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  return { treasures, error, reload };
}
