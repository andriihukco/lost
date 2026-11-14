'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PinPicker from '@/components/PinPicker';
import { parseCoordinates } from '@/lib/coords';
import type { LatLng } from '@/lib/geo';
import { createTreasure, MAX_PHOTOS } from '@/lib/treasures';

export default function TreasureForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [hint, setHint] = useState('');
  const [coordsText, setCoordsText] = useState('');
  const [point, setPoint] = useState<LatLng | null>(null);
  const [coordsError, setCoordsError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
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
    if (photos.length === 0) return setError('Додайте хоча б одну фото');
    setBusy(true);
    setError(null);
    try {
      await createTreasure({ title, hint: hint || null, point, photos });
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
      <label className="flex flex-col gap-1">
        <span className="text-sm text-[var(--muted)]">Фото (від 1 до {MAX_PHOTOS})</span>
        <input type="file" accept="image/*" multiple
          onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS))}
          className="text-[16px]" />
      </label>
      {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
      <button type="submit" disabled={!canSubmit}
        className="dl-btn">
        {busy ? 'Зберігаємо…' : 'Додати на карту'}
      </button>
    </form>
  );
}
