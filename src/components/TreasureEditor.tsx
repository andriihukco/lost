'use client';

import { useEffect, useState } from 'react';
import { MAX_PHOTOS, validateTreasure } from '@/lib/treasureRules';
import { pinOrDefault } from '@/lib/pinEmoji';
import PinEmojiPicker from '@/components/PinEmojiPicker';
import Icon from '@/components/Icon';
import {
  addPhoto, deleteTreasure, foundHistory, removePhoto, signedPhotoUrl, updateTreasure,
  type AdminTreasure, type HistoryEvent,
} from '@/lib/adminTreasures';
import { unmarkFound } from '@/lib/found';
import { parseCoordinates } from '@/lib/coords';
import { usePasteImages } from '@/lib/usePasteImages';

type Props = {
  treasure: AdminTreasure;
  names: Record<string, string>;
  onChanged: () => void;
  onDeleted: () => void;
};

function historyLabel(h: HistoryEvent): string {
  if (h.action === 'place') return 'місце відмічено';
  if (h.action === 'found') return `знайдено${h.manual ? ' вручну' : ''}`;
  return 'повернуто на карту';
}

// The admin's treasure view, shown in the full-screen treasure modal. Three parts, top to bottom:
// the details, the photos and status, then the danger zone. The save button is pinned to the bottom.
export default function TreasureEditor({ treasure, names, onChanged, onDeleted }: Props) {
  const [title, setTitle] = useState(treasure.title);
  const [hint, setHint] = useState(treasure.hint ?? '');
  const [coords, setCoords] = useState<string>(`${treasure.lat.toFixed(6)}, ${treasure.lng.toFixed(6)}`);
  const [pinEmoji, setPinEmoji] = useState<string>(pinOrDefault(treasure.pin_emoji));
  const [photos, setPhotos] = useState<string[]>(treasure.photo_paths);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<HistoryEvent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(photos.map(async (p) => [p, await signedPhotoUrl(p)] as const)).then((pairs) => {
      if (!cancelled) setUrls(Object.fromEntries(pairs.filter(([, u]) => u !== null) as [string, string][]));
    });
    return () => { cancelled = true; };
  }, [photos]);

  const current = (): AdminTreasure => ({ ...treasure, photo_paths: photos });

  async function run(label: string, action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(label);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function draftErrors(): string[] {
    const point = parseCoordinates(coords);
    return validateTreasure({
      title,
      hint,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      photoCount: photos.length,
      pinEmoji,
    });
  }

  function save() {
    const errs = draftErrors();
    setErrors(errs);
    const point = parseCoordinates(coords);
    if (errs.length || !point) return;
    void run('Збережено', async () => {
      await updateTreasure(treasure.id, { title: title.trim(), hint: hint.trim() || null, lat: point.lat, lng: point.lng, pin_emoji: pinEmoji.trim() });
      onChanged();
    });
  }

  // Pasted screenshots (Ctrl+V / ⌘V) and picked files take the same path.
  usePasteImages(addFiles);

  function addFiles(files: FileList | File[] | null) {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return setMessage(`Не більше ${MAX_PHOTOS} фото`);
    void run('Фото додано', async () => {
      let paths = photos;
      for (const f of list.slice(0, room)) paths = await addPhoto({ ...current(), photo_paths: paths }, f);
      setPhotos(paths);
      onChanged();
    });
  }

  function dropPhoto(path: string) {
    if (!window.confirm('Видалити це фото? Файл буде видалено назавжди.')) return;
    void run('Фото видалено', async () => {
      setPhotos(await removePhoto(current(), path));
      onChanged();
    });
  }

  function sendBack() {
    void run('Скарб повернуто на карту', async () => {
      const status = await unmarkFound(treasure.id);
      if (status !== 'unfound') throw new Error('Скарб уже на карті');
      onChanged();
    });
  }

  function remove() {
    if (!window.confirm(`Видалити «${treasure.title}»? Це не можна скасувати: історія та фото теж видаляться.`)) return;
    void run('Видалено', async () => {
      await deleteTreasure(current());
      onDeleted();
    });
  }

  async function toggleHistory() {
    if (history) return setHistory(null);
    try {
      setHistory(await foundHistory(treasure.id));
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  return (
    <form className="flex flex-col gap-7 px-5 pb-4 pt-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <section className="flex flex-col gap-4" aria-labelledby="treasure-details">
        <h3 id="treasure-details" className="text-[13px] font-bold uppercase tracking-wide text-[var(--muted)]">Деталі</h3>
        <label className="flex flex-col gap-1.5">
          <span className="dl-label">Назва</span>
          <input className="dl-field" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="dl-label">Підказка · необов&apos;язково</span>
          <textarea className="dl-field" value={hint} rows={2} maxLength={300} onChange={(e) => setHint(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="dl-label">Координати (широта, довгота)</span>
          <input className="dl-field" inputMode="decimal" value={coords} onChange={(e) => setCoords(e.target.value)} placeholder="49.8419, 24.0315" />
        </label>
        {errors.map((e) => <p key={e} role="alert" className="text-sm font-semibold text-[var(--danger)]">{e}</p>)}
      </section>

      <section className="flex flex-col gap-2">
        <span className="dl-label">Мітка на карті</span>
        <PinEmojiPicker value={pinEmoji} onChange={setPinEmoji} />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="treasure-photos">
        <h3 id="treasure-photos" className="dl-label">Фото · {photos.length} з {MAX_PHOTOS}</h3>
        {photos.length > 0 && (
          <ul className="flex gap-2 overflow-x-auto py-1">
            {photos.map((p, i) => (
              <li key={p} className="relative shrink-0">
                {urls[p] ? (
                  <a href={urls[p]} target="_blank" rel="noopener noreferrer" aria-label={`Відкрити фото ${i + 1} повністю у новій вкладці`} className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={urls[p]} alt={`Фото ${i + 1}`} className="h-24 w-24 rounded-2xl object-cover" />
                  </a>
                ) : (
                  <div className="h-24 w-24 rounded-2xl bg-[var(--line)]" />
                )}
                <button type="button" aria-label={`Видалити фото ${i + 1}`} onClick={() => dropPhoto(p)} disabled={busy} className="absolute right-0 top-0 grid h-11 w-11 place-items-center disabled:opacity-40">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"><Icon name="close" size={16} /></span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {photos.length < MAX_PHOTOS && (
          <label className="dl-btn-secondary cursor-pointer text-center">
            Додати фото
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </label>
        )}
        <p className="text-sm text-[var(--muted)]">Можна вставити зображення через Ctrl+V (⌘V).</p>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="treasure-status">
        <h3 id="treasure-status" className="dl-label">Статус</h3>
        <p className="text-[16px] font-semibold">
          {treasure.is_found ? 'Знайдено' : 'На карті'}
        </p>
        {treasure.is_found && (
          <p className="text-sm text-[var(--muted)]">
            {names[treasure.found_by ?? ''] ?? 'гравець'}
            {treasure.found_at ? `, ${new Date(treasure.found_at).toLocaleString('uk-UA')}` : ''}
            {treasure.found_manual ? ` · вручну: ${treasure.found_note ?? ''}` : ''}
          </p>
        )}
        {treasure.is_found && (
          <button type="button" disabled={busy} onClick={sendBack} className="dl-btn-secondary">
            Повернути на карту
          </button>
        )}
        <button type="button" onClick={() => void toggleHistory()} className="dl-btn-secondary">
          {history ? 'Сховати історію' : 'Історія пошуку'}
        </button>
        {history && (
          <ul className="flex flex-col gap-1.5 border-l-2 border-[var(--line)] pl-3 text-sm">
            {history.length === 0 && <li className="text-[var(--muted)]">Подій ще немає</li>}
            {history.map((h) => (
              <li key={h.id}>
                <span className="font-semibold">{names[h.user_id] ?? 'гравець'}</span> · {historyLabel(h)}
                <span className="text-[var(--muted)]"> · {new Date(h.created_at).toLocaleString('uk-UA')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 border-t border-[var(--line)] pt-5" aria-label="Небезпечна зона">
        <button type="button" disabled={busy} onClick={remove} className="dl-btn-danger">
          Видалити скарб
        </button>
        <p className="text-center text-xs text-[var(--muted)]">Разом з історією та фото буде видалено.</p>
      </section>

      {/* Pinned to the bottom of the modal's scroll area, so the save action is always in reach. */}
      <div className="sticky bottom-0 -mx-5 mt-2 border-t border-[var(--line)] bg-[var(--paper)]/95 px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-md">
        {message && <p role="status" className="mb-2 text-center text-sm font-semibold">{message}</p>}
        <button type="submit" disabled={busy} className="dl-btn">
          {busy ? 'Зберігаємо…' : 'Зберегти зміни'}
        </button>
      </div>
    </form>
  );
}
