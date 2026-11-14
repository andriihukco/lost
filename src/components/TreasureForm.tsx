'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { takeUpTo } from '@/lib/clipboardImages';
import { usePasteImages } from '@/lib/usePasteImages';
import { useRouter } from 'next/navigation';
import PinPicker from '@/components/PinPicker';
import { parseCoordinates } from '@/lib/coords';
import type { LatLng } from '@/lib/geo';
import { createTreasure, MAX_PHOTOS } from '@/lib/treasures';
import { DEFAULT_PIN } from '@/lib/pinEmoji';
import PinEmojiPicker from '@/components/PinEmojiPicker';
import { validateTreasure } from '@/lib/treasureRules';

export default function TreasureForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [hint, setHint] = useState('');
  const [coordsText, setCoordsText] = useState('');
  const [point, setPoint] = useState<LatLng | null>(null);
  const [coordsError, setCoordsError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  // Adds photos up to the limit; more than that is cut and the admin is told.
  function addPhotos(incoming: File[]) {
    if (incoming.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return setError(`Не більше ${MAX_PHOTOS} фото`);
    if (incoming.length > room) setError(`Не більше ${MAX_PHOTOS} фото: додано перші ${room}`);
    else setError(null);
    setPhotos((prev) => [...prev, ...takeUpTo(incoming, MAX_PHOTOS - prev.length)]);
  }
  function removePhoto(i: number) {
    setPhotos((prev) => prev.filter((_, j) => j !== i));
  }
  usePasteImages(addPhotos);
  const [pinEmoji, setPinEmoji] = useState<string>(DEFAULT_PIN);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyCoordsText(text: string) {
    setCoordsText(text);
    if (!text.trim()) return setCoordsError(null);
    const parsed = parseCoordinates(text);
    if (parsed) {
      setPoint(parsed);
      setCoordsError(null);
    } else {
      setCoordsError('Вкажіть координати: 49.8419, 24.0315');
    }
  }

  function pickOnMap(p: LatLng) {
    setPoint(p);
    setCoordsText(`${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`);
    setCoordsError(null);
  }

  async function submit() {
    if (!title.trim()) return setError('Додайте назву скарбу');
    if (!point) return setError('Вкажіть місце на карті або координати');
    const problems = validateTreasure({ title, hint, lat: point.lat, lng: point.lng, photoCount: photos.length, pinEmoji });
    if (problems.length > 0) return setError(problems[0]);
    setBusy(true);
    setError(null);
    try {
      await createTreasure({ title, hint: hint || null, point, photos, pinEmoji: pinEmoji.trim() || DEFAULT_PIN });
      router.replace('/');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const canSubmit = !busy && title.trim().length > 0 && point !== null;

  return (
    <form
      className="flex flex-col gap-4 p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
    >
      <h1 className="text-2xl font-bold tracking-tight">Новий скарб</h1>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-[var(--muted)]">Назва</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80}
          className="dl-field" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-[var(--muted)]">Підказка (необов&apos;язково)</span>
        <textarea value={hint} onChange={(e) => setHint(e.target.value)} rows={2} maxLength={300}
          className="dl-field" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-[var(--muted)]">Координати або посилання Google/Apple Maps</span>
        <input value={coordsText} onChange={(e) => applyCoordsText(e.target.value)} inputMode="decimal"
          onBlur={() => coordsText && applyCoordsText(coordsText)}
          className="dl-field" />
        {coordsError && <span role="alert" className="text-sm text-[var(--danger)]">{coordsError}</span>}
      </label>
      <PinPicker value={point} onChange={pickOnMap} />
      <PinEmojiPicker value={pinEmoji} onChange={setPinEmoji} />
      <div className="flex flex-col gap-2">
        <span className="text-sm text-[var(--muted)]">Фото (від 1 до {MAX_PHOTOS}) · вставте зображення через Ctrl+V / ⌘V або оберіть файли</span>
        {previews.length > 0 && (
          <ul className="flex gap-2 overflow-x-auto">
            {previews.map((url, i) => (
              <li key={url} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Фото ${i + 1}`} className="h-24 w-24 rounded-xl object-cover" />
                <button type="button" aria-label="Прибрати фото" onClick={() => removePhoto(i)}
                  className="absolute right-0 top-0 grid h-11 w-11 place-items-center">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"><Icon name="close" size={16} /></span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {photos.length < MAX_PHOTOS && (
          <input type="file" accept="image/*" multiple
            onChange={(e) => { addPhotos(Array.from(e.target.files ?? [])); e.target.value = ''; }}
            className="text-[16px]" />
        )}
      </div>
      {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
      <button type="submit" disabled={!canSubmit}
        className="dl-btn">
        {busy ? 'Зберігаємо…' : 'Додати на карту'}
      </button>
    </form>
  );
}
