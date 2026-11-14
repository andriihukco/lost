// Rules for treasure content, shared by the add form and the admin editor (spec §2.1, §6.3).
export const MAX_PHOTOS = 3;

export type TreasureDraft = {
  title: string;
  hint: string;
  lat: number | null;
  lng: number | null;
  photoCount: number;
};

// Returns Ukrainian messages for the first problems found; an empty list means valid.
export function validateTreasure(d: TreasureDraft): string[] {
  const errors: string[] = [];
  const title = d.title.trim();
  if (title.length === 0) errors.push('Додайте назву скарбу');
  else if (title.length > 80) errors.push('Назва до 80 символів');
  if (d.hint.length > 300) errors.push('Підказка до 300 символів');
  const coordsOk =
    d.lat !== null && d.lng !== null &&
    Number.isFinite(d.lat) && Number.isFinite(d.lng) &&
    Math.abs(d.lat) <= 90 && Math.abs(d.lng) <= 180;
  if (!coordsOk) errors.push('Вкажіть координати');
  if (d.photoCount < 1) errors.push('Потрібне принаймні одне фото');
  if (d.photoCount > MAX_PHOTOS) errors.push(`Не більше ${MAX_PHOTOS} фото`);
  return errors;
}
