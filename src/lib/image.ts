const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const QUALITY = 0.85;

export function fitWithin(w: number, h: number, max: number): { w: number; h: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Не вдалося стиснути фото'))),
      type,
      QUALITY,
    );
  });
}

// Re-encoding through a canvas strips EXIF, including GPS (decision D2 / spec §6.5).
// Safari may answer a WebP request with PNG; then fall back to JPEG.
export async function compressPhoto(file: File, maxSide = 1200): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Оберіть зображення');
  if (file.size > MAX_INPUT_BYTES) throw new Error('Файл завеликий (макс. 25 МБ)');

  const bitmap = await createImageBitmap(file);
  const { w, h } = fitWithin(bitmap.width, bitmap.height, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas недоступний');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const webp = await canvasToBlob(canvas, 'image/webp');
  return webp.type === 'image/webp' ? webp : canvasToBlob(canvas, 'image/jpeg');
}
