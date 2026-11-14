import { compressPhoto } from '@/lib/image';
import { supabase } from '@/lib/supabase';
import { PHOTO_BUCKET } from '@/lib/treasures';

export type AdminTreasure = {
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
  found_manual: boolean;
  found_note: string | null;
  created_at: string;
};

export type HistoryEvent = {
  id: number;
  user_id: string;
  action: 'place' | 'found' | 'unfound';
  manual: boolean;
  note: string | null;
  created_at: string;
};

const COLUMNS =
  'id, title, hint, lat, lng, photo_paths, pin_emoji, is_found, found_by, found_at, found_manual, found_note, created_at';

// Writes must touch a row. RLS can block an update and still answer 200 with no rows (seen during testing).
function requireRow<T>(rows: T[] | null, error: unknown, message: string): T {
  if (error || !rows || rows.length === 0) throw new Error(message);
  return rows[0];
}

export async function listTreasures(): Promise<AdminTreasure[]> {
  const { data, error } = await supabase.from('treasures').select(COLUMNS).order('created_at', { ascending: true });
  if (error) throw new Error('Не вдалося завантажити скарби');
  return (data ?? []) as AdminTreasure[];
}

export async function updateTreasure(
  id: string,
  patch: { title: string; hint: string | null; lat: number; lng: number; pin_emoji: string },
): Promise<AdminTreasure> {
  const { data, error } = await supabase.from('treasures').update(patch).eq('id', id).select(COLUMNS);
  return requireRow(data as AdminTreasure[] | null, error, 'Немає доступу або скарб не знайдено') as AdminTreasure;
}

// Adds one photo; returns the new list of paths.
export async function addPhoto(treasure: AdminTreasure, file: File): Promise<string[]> {
  const blob = await compressPhoto(file);
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${treasure.id}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (uploadError) throw new Error('Не вдалося завантажити фото');
  const next = [...treasure.photo_paths, path];
  const { data, error } = await supabase.from('treasures').update({ photo_paths: next }).eq('id', treasure.id).select('id');
  if (error || !data?.length) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    throw new Error('Немає доступу до скарбу');
  }
  return next;
}

export async function removePhoto(treasure: AdminTreasure, path: string): Promise<string[]> {
  const next = treasure.photo_paths.filter((p) => p !== path);
  const { data, error } = await supabase.from('treasures').update({ photo_paths: next }).eq('id', treasure.id).select('id');
  requireRow(data, error, 'Немає доступу до скарбу');
  await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  return next;
}

// Removes the treasure, its history (cascade) and its photo files.
export async function deleteTreasure(treasure: AdminTreasure): Promise<void> {
  const { data, error } = await supabase.from('treasures').delete().eq('id', treasure.id).select('id');
  requireRow(data, error, 'Немає доступу або скарб вже видалено');
  if (treasure.photo_paths.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(treasure.photo_paths);
}

export async function foundHistory(treasureId: string): Promise<HistoryEvent[]> {
  const { data, error } = await supabase
    .from('found_events')
    .select('id, user_id, action, manual, note, created_at')
    .eq('treasure_id', treasureId)
    .order('created_at', { ascending: false });
  if (error) throw new Error('Не вдалося завантажити історію');
  return (data ?? []) as HistoryEvent[];
}

export async function signedPhotoUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
