'use client';

import { useState } from 'react';
import PinEmojiPicker from '@/components/PinEmojiPicker';
import PinPicker from '@/components/PinPicker';
import StickyAction from '@/components/StickyAction';
import { parseCoordinates } from '@/lib/coords';
import type { LatLng } from '@/lib/geo';
import { createMapMark, type MapMark, type MarkInput, updateMapMark } from '@/lib/mapMarks';
import { markEmoji, MARK_DEFAULT_EMOJI } from '@/lib/mapMarkRules';

// The map-mark form, for a new mark or for editing one (pass `initial`). Saved marks are shown on the map.
export default function MarkForm({ initial, onSaved, initialPoint }: { initial?: MapMark | null; onSaved: () => void; initialPoint?: LatLng | null }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [emoji, setEmoji] = useState<string>(initial?.emoji ?? MARK_DEFAULT_EMOJI);
  const start = initial ?? initialPoint ?? null;
  const [point, setPoint] = useState<LatLng | null>(start ? { lat: start.lat, lng: start.lng } : null);
  const [coordsText, setCoordsText] = useState(start ? `${start.lat.toFixed(6)}, ${start.lng.toFixed(6)}` : '');
  const [coordsError, setCoordsError] = useState<string | null>(null);
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
    if (!title.trim()) return setError('Додайте назву мітки');
    if (!point) return setError('Вкажіть місце на карті або координати');
    const input: MarkInput = { title: title.trim(), note: note.trim() || null, emoji: markEmoji(emoji), lat: point.lat, lng: point.lng };
    setBusy(true);
    setError(null);
    try {
      if (initial) await updateMapMark(initial.id, input);
      else await createMapMark(input);
      onSaved();
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
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="dl-field" placeholder="Наприклад, Небезпечна собака" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="dl-label">Примітка · необов&apos;язково</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} className="dl-field" />
      </label>

      <section className="flex flex-col gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="dl-label">Координати або посилання Google/Apple Maps</span>
          <input value={coordsText} onChange={(e) => applyCoordsText(e.target.value)} onBlur={() => coordsText && applyCoordsText(coordsText)} inputMode="decimal" placeholder="49.8419, 24.0315" className="dl-field" />
        </label>
        {coordsError && <span role="alert" className="text-sm font-semibold text-[var(--danger)]">{coordsError}</span>}
        <PinPicker value={point} onChange={pickOnMap} />
      </section>

      <section className="flex flex-col gap-2">
        <span className="dl-label">Значок</span>
        <PinEmojiPicker value={emoji} onChange={setEmoji} />
      </section>

      {error && <p role="alert" className="text-sm font-semibold text-[var(--danger)]">{error}</p>}
      <StickyAction>
        <button type="submit" disabled={!canSubmit} className="dl-btn">
          {busy ? 'Зберігаємо…' : initial ? 'Зберегти зміни' : 'Додати мітку на карту'}
        </button>
      </StickyAction>
    </form>
  );
}
