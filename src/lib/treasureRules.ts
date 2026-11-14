// Rules for treasure content, shared by the add form and the admin editor (spec §2.1, §6.3).
export const MAX_PHOTOS = 3;

export type TreasureDraft = {
  title: string;
  hint: string;
  lat: number | null;
  lng: number | null;
  photoCount: number;
  pinEmoji?: string; // the emoji shown on the map pin (optional; checked when given)
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
  if (d.pinEmoji !== undefined) {
    const n = [...d.pinEmoji.trim()].length;
    if (n < 1 || n > 8) errors.push('Оберіть емодзі для мітки');
  }
  return errors;
}
