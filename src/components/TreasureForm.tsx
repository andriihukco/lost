'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PinPicker from '@/components/PinPicker';
import { parseCoordinates } from '@/lib/coords';
import type { LatLng } from '@/lib/geo';
import { createTreasure, MAX_PHOTOS } from '@/lib/treasures';

export default function TreasureForm({ roomId, code }: { roomId: string; code: string }) {
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
    setBusy(true);
    setError(null);
    try {
      await createTreasure({ roomId, title, hint: hint || null, point, photos });
      router.replace(`/r/${code}/map`);
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
        <span className="text-sm text-neutral-500">Назва</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80}
          className="rounded-xl bg-white/80 px-4 py-3 text-[16px] outline-none ring-1 ring-black/10" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-500">Підказка (необов&apos;язково)</span>
        <textarea value={hint} onChange={(e) => setHint(e.target.value)} rows={2} maxLength={300}
          className="rounded-xl bg-white/80 px-4 py-3 text-[16px] outline-none ring-1 ring-black/10" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-500">Координати або посилання Google/Apple Maps</span>
        <input value={coordsText} onChange={(e) => applyCoordsText(e.target.value)} inputMode="decimal"
          onBlur={() => coordsText && applyCoordsText(coordsText)}
          className="rounded-xl bg-white/80 px-4 py-3 text-[16px] outline-none ring-1 ring-black/10" />
        {coordsError && <span role="alert" className="text-sm text-red-600">{coordsError}</span>}
      </label>
      <PinPicker value={point} onChange={pickOnMap} />
      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-500">Фото (до {MAX_PHOTOS})</span>
        <input type="file" accept="image/*" multiple
          onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS))}
          className="text-[16px]" />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={!canSubmit}
        className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-40">
        {busy ? 'Зберігаємо…' : 'Додати на карту'}
      </button>
    </form>
  );
}
