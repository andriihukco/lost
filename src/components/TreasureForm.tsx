'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import PinPicker from '@/components/PinPicker';
import PinEmojiPicker from '@/components/PinEmojiPicker';
import StickyAction from '@/components/StickyAction';
import { takeUpTo } from '@/lib/clipboardImages';
import { parseCoordinates } from '@/lib/coords';
import type { LatLng } from '@/lib/geo';
import { DEFAULT_PIN } from '@/lib/pinEmoji';
import { createTreasure, MAX_PHOTOS } from '@/lib/treasures';
import { validateTreasure } from '@/lib/treasureRules';
import { usePasteImages } from '@/lib/usePasteImages';

// The new-treasure form, shown in the admin sheet. onCreated runs after the treasure is saved.
export default function TreasureForm({ onCreated, initialPoint }: { onCreated: () => void; initialPoint?: LatLng | null }) {
  const [title, setTitle] = useState('');
  const [hint, setHint] = useState('');
  const [coordsText, setCoordsText] = useState(initialPoint ? `${initialPoint.lat.toFixed(6)}, ${initialPoint.lng.toFixed(6)}` : '');
  const [point, setPoint] = useState<LatLng | null>(initialPoint ?? null);
  const [coordsError, setCoordsError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [pinEmoji, setPinEmoji] = useState<string>(DEFAULT_PIN);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  // Adds photos up to the limit; more than that is cut and the admin is told.
  function addPhotos(incoming: File[]) {
    if (incoming.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return setError(`Не більше ${MAX_PHOTOS} фото`);
    setError(incoming.length > room ? `Не більше ${MAX_PHOTOS} фото: додано перші ${room}` : null);
    setPhotos((prev) => [...prev, ...takeUpTo(incoming, MAX_PHOTOS - prev.length)]);
  }
  function removePhoto(i: number) {
    setPhotos((prev) => prev.filter((_, j) => j !== i));
  }
  usePasteImages(addPhotos);

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
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !busy && title.trim().length > 0 && point !== null;

  return (
    <form className="flex flex-col gap-5 px-5 pb-40 pt-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <label className="flex flex-col gap-1.5">
        <span className="dl-label">Назва</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="dl-field" placeholder="Наприклад, Гриб під дубом" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="dl-label">Підказка · необов&apos;язково</span>
        <textarea value={hint} onChange={(e) => setHint(e.target.value)} rows={2} maxLength={300} className="dl-field" />
      </label>

      <section className="flex flex-col gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="dl-label">Координати або посилання Google/Apple Maps</span>
          <input
            value={coordsText}
            onChange={(e) => applyCoordsText(e.target.value)}
            onBlur={() => coordsText && applyCoordsText(coordsText)}
            inputMode="decimal"
            placeholder="49.8419, 24.0315"
            className="dl-field"
          />
        </label>
        {coordsError && <span role="alert" className="text-sm font-semibold text-[var(--danger)]">{coordsError}</span>}
        <PinPicker value={point} onChange={pickOnMap} />
      </section>

      <section className="flex flex-col gap-2">
        <span className="dl-label">Мітка</span>
        <PinEmojiPicker value={pinEmoji} onChange={setPinEmoji} />
      </section>

      <section className="flex flex-col gap-2">
        <span className="dl-label">Фото · від 1 до {MAX_PHOTOS}</span>
        <p className="text-sm text-[var(--muted)]">Вставте зображення через Ctrl+V (⌘V) або оберіть файли.</p>
        {previews.length > 0 && (
          <ul className="flex gap-2 overflow-x-auto py-1">
            {previews.map((url, i) => (
              <li key={url} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Фото ${i + 1}`} className="h-24 w-24 rounded-2xl object-cover" />
                <button type="button" aria-label="Прибрати фото" onClick={() => removePhoto(i)} className="absolute right-0 top-0 grid h-11 w-11 place-items-center">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"><Icon name="close" size={16} /></span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {photos.length < MAX_PHOTOS && (
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => { addPhotos(Array.from(e.target.files ?? [])); e.target.value = ''; }}
            className="text-[16px]"
          />
        )}
      </section>

      {error && <p role="alert" className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
      <StickyAction>
        <button type="submit" disabled={!canSubmit} className="dl-btn">
          {busy ? 'Зберігаємо…' : 'Додати на карту'}
        </button>
      </StickyAction>
    </form>
  );
}
