'use client';

import { useEffect, useState } from 'react';
import { MAX_PHOTOS, validateTreasure } from '@/lib/treasureRules';
import { pinOrDefault } from '@/lib/pinEmoji';
import PinEmojiPicker from '@/components/PinEmojiPicker';
import {
  addPhoto, deleteTreasure, foundHistory, removePhoto, signedPhotoUrl, updateTreasure,
  type AdminTreasure, type HistoryEvent,
} from '@/lib/adminTreasures';
import { unmarkFound } from '@/lib/found';

type Props = {
  treasure: AdminTreasure;
  names: Record<string, string>;
  onChanged: () => void;
  onDeleted: () => void;
};

const field = 'dl-field';

export default function TreasureEditor({ treasure, names, onChanged, onDeleted }: Props) {
  const [title, setTitle] = useState(treasure.title);
  const [hint, setHint] = useState(treasure.hint ?? '');
  const [lat, setLat] = useState<string>(String(treasure.lat));
  const [lng, setLng] = useState<string>(String(treasure.lng));
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
    return validateTreasure({
      title,
      hint,
      lat: lat.trim() === '' ? null : Number(lat),
      lng: lng.trim() === '' ? null : Number(lng),
      photoCount: photos.length,
      pinEmoji,
    });
  }

  function save() {
    const errs = draftErrors();
    setErrors(errs);
    if (errs.length) return;
    void run('Збережено', async () => {
      await updateTreasure(treasure.id, { title: title.trim(), hint: hint.trim() || null, lat: Number(lat), lng: Number(lng), pin_emoji: pinEmoji.trim() });
      onChanged();
    });
  }

  function addFiles(files: FileList | null) {
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
    <div className="mt-2 flex flex-col gap-3 rounded-2xl dl-card p-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Назва</span>
        <input className={field} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Підказка</span>
        <textarea className={field} value={hint} rows={2} maxLength={300} onChange={(e) => setHint(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Широта</span>
          <input className={field} inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Довгота</span>
          <input className={field} inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} />
        </label>
      </div>
      {errors.map((e) => <p key={e} role="alert" className="text-sm text-[var(--danger)]">{e}</p>)}
      <button type="button" disabled={busy} onClick={save} className="dl-btn !w-auto !py-2.5 !text-sm">
        Зберегти зміни
      </button>

      <PinEmojiPicker value={pinEmoji} onChange={setPinEmoji} />

      <div className="flex flex-col gap-2">
        <span className="text-sm text-[var(--muted)]">Фото ({photos.length}/{MAX_PHOTOS})</span>
        <div className="flex gap-2 overflow-x-auto">
          {photos.map((p) => (
            <div key={p} className="relative shrink-0">
              {urls[p] ? <img src={urls[p]} alt="Фото" className="h-24 w-24 rounded-xl object-cover" /> : <div className="h-24 w-24 rounded-xl bg-neutral-200" />}
              <button type="button" onClick={() => dropPhoto(p)} disabled={busy} className="absolute right-1 top-1 rounded-full bg-black/60 px-2 text-xs text-white">×</button>
            </div>
          ))}
        </div>
        {photos.length < MAX_PHOTOS && (
          <input type="file" accept="image/*" multiple onChange={(e) => addFiles(e.target.files)} className="text-[16px]" />
        )}
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <span className="text-[var(--muted)]">Статус</span>
        {treasure.is_found ? (
          <p>Знайдено: <strong>{names[treasure.found_by ?? ''] ?? 'гравець'}</strong>{treasure.found_at ? `, ${new Date(treasure.found_at).toLocaleString('uk-UA')}` : ''}{treasure.found_manual ? ` · вручну: ${treasure.found_note ?? ''}` : ''}</p>
        ) : (
          <p>На карті</p>
        )}
        {treasure.is_found && (
          <button type="button" disabled={busy} onClick={sendBack} className="self-start text-[var(--green-deep)] font-bold disabled:opacity-40">
            Повернути на карту
          </button>
        )}
        <button type="button" onClick={() => void toggleHistory()} className="self-start text-[var(--green-deep)] font-bold">
          {history ? 'Сховати історію' : 'Історія пошуку'}
        </button>
        {history && (
          <ul className="flex flex-col gap-1 border-l-2 border-neutral-200 pl-3">
            {history.length === 0 && <li className="text-[var(--muted)]">Подій ще немає</li>}
            {history.map((h) => (
              <li key={h.id}>
                <span className="font-medium">{names[h.user_id] ?? 'гравець'}</span>{' '}
                {h.action === 'found' ? `знайшов(ла)${h.manual ? ' вручну' : ''}` : 'повернув(ла) на карту'}
                <span className="text-[var(--muted)]"> · {new Date(h.created_at).toLocaleString('uk-UA')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="button" disabled={busy} onClick={remove} className="self-start text-sm font-semibold text-[var(--danger)] disabled:opacity-40">
        Видалити скарб
      </button>
      {message && <p role="status" className="text-sm font-medium">{message}</p>}
    </div>
  );
}
