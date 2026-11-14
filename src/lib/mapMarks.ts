import { supabase } from '@/lib/supabase';

// A map mark: a warning or a note placed by an admin. It is shown on the map only.
export type MapMark = {
  id: string;
  title: string;
  note: string | null;
  emoji: string;
  lat: number;
  lng: number;
};

export async function listMapMarks(): Promise<MapMark[]> {
  const { data, error } = await supabase
    .from('map_marks')
    .select('id, title, note, emoji, lat, lng')
    .order('created_at', { ascending: true });
  if (error) throw new Error('Не вдалося завантажити мітки');
  return (data ?? []) as MapMark[];
}

export type MarkInput = Omit<MapMark, 'id'>;

// Admin only (RLS, migration 0007). Returns the saved row.
export async function createMapMark(m: MarkInput): Promise<MapMark> {
  const { data, error } = await supabase
    .from('map_marks')
    .insert({ title: m.title, note: m.note, emoji: m.emoji, lat: m.lat, lng: m.lng })
    .select('id, title, note, emoji, lat, lng')
    .single();
  if (error || !data) throw new Error('Не вдалося додати мітку');
  return data as MapMark;
}

export async function deleteMapMark(id: string): Promise<void> {
  const { data, error } = await supabase.from('map_marks').delete().eq('id', id).select('id');
  if (error) throw new Error('Не вдалося видалити мітку');
  if (!data || data.length === 0) throw new Error('Мітку не видалено: перевірте доступ');
}

// Admin only: changes the title, note, emoji and place of a mark. A player's attempt changes nothing (RLS).
export async function updateMapMark(id: string, m: MarkInput): Promise<MapMark> {
  const { data, error } = await supabase
    .from('map_marks')
    .update({ title: m.title, note: m.note, emoji: m.emoji, lat: m.lat, lng: m.lng })
    .eq('id', id)
    .select('id, title, note, emoji, lat, lng');
  if (error) throw new Error('Не вдалося змінити мітку');
  if (!data || data.length === 0) throw new Error('Мітку не змінено: перевірте доступ');
  return data[0] as MapMark;
}
