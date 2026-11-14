import { compressPhoto } from '@/lib/image';
import type { LatLng } from '@/lib/geo';
import { supabase } from '@/lib/supabase';
import type { Treasure } from '@/lib/useTreasures';

export const MAX_PHOTOS = 3;
export const PHOTO_BUCKET = 'treasure-photos';

export type NewTreasure = {
  roomId: string;
  title: string;
  hint: string | null;
  point: LatLng;
  photos: File[];
};

// Insert the row first (its id names the photo folder), then upload photos, then store their paths.
// If any photo fails, the row is deleted so no half-saved treasure remains.
export async function createTreasure(input: NewTreasure): Promise<Treasure> {
  if (input.photos.length > MAX_PHOTOS) throw new Error(`Не більше ${MAX_PHOTOS} фото`);

  const { data: row, error } = await supabase
    .from('treasures')
    .insert({
      room_id: input.roomId,
      title: input.title.trim(),
      hint: input.hint?.trim() || null,
      lat: input.point.lat,
      lng: input.point.lng,
    })
    .select()
    .single();
  if (error || !row) throw new Error('Не вдалося зберегти скарб');

  const paths: string[] = [];
  try {
    for (let i = 0; i < input.photos.length; i++) {
      const blob = await compressPhoto(input.photos[i]);
      const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${row.room_id}/${row.id}/${i + 1}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, blob, { contentType: blob.type, upsert: false });
      if (uploadError) throw uploadError;
      paths.push(path);
    }
    const { data: updated, error: updateError } = await supabase
      .from('treasures')
      .update({ photo_paths: paths })
      .eq('id', row.id)
      .select()
      .single();
    if (updateError || !updated) throw updateError ?? new Error('update failed');
    return updated as Treasure;
  } catch {
    if (paths.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(paths); // no orphan photos (F5)
    await supabase.from('treasures').delete().eq('id', row.id);
    throw new Error('Не вдалося завантажити фото. Скарб не збережено.');
  }
}
