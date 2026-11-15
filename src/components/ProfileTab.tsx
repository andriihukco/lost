'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Icon from '@/components/Icon';
import NicknamePicker from '@/components/NicknamePicker';
import OfflineSection from '@/components/OfflineSection';
import { TransferCodeMaker } from '@/components/ProfileTransfer';
import type { LatLng } from '@/lib/geo';
import { avatarEmoji, nicknameFor, type AvatarKey } from '@/lib/avatars';
import { readOfflineStatus, type OfflineStatus } from '@/lib/offlineMap';
import { getAllPlayers, releaseProfile, savePlayer, type Player } from '@/lib/player';
import { supabase } from '@/lib/supabase';

type Page = 'offline' | 'transfer' | null;

// One row of a settings group: an icon, a title, what it shows now, and a chevron.
function SettingsRow({ icon, label, value, onClick, last = false }: { icon: 'travel_explore' | 'group'; label: string; value: string; onClick: () => void; last?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[56px] w-full items-center gap-3 bg-[var(--paper)] px-4 py-3 text-left ${last ? '' : 'border-b border-[var(--line)]'}`}
    >
      <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--green-soft)] text-[var(--green-deep)]">
        <Icon name={icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold">{label}</span>
        <span className="block truncate text-[13px] text-[var(--muted)]">{value}</span>
      </span>
      <Icon name="arrow_forward" size={18} className="shrink-0 text-[var(--muted)]" />
    </button>
  );
}

// "Профіль" tab: the animal and nickname on top, then a settings list. Each feature has its own page.
export default function ProfileTab({ player, onSaved, offlinePoints, bottomInset = 0 }: { player: Player; onSaved: (p: Player) => void; offlinePoints: LatLng[]; bottomInset?: number }) {
  const [avatar, setAvatar] = useState<AvatarKey>(player.avatar);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  const [page, setPage] = useState<Page>(null);
  const [offline, setOffline] = useState<OfflineStatus | null>(null);
  const dirty = avatar !== player.avatar;

  useEffect(() => {
    // Animals chosen by other players are greyed out; my own stays available.
    getAllPlayers().then((list) => setTaken(list.filter((p) => p.user_id !== player.user_id).map((p) => p.avatar))).catch(() => {});
  }, [player.user_id]);

  // The offline status is read again each time a page closes, so the row shows the latest state.
  useEffect(() => {
    if (page === null) setOffline(readOfflineStatus(window.localStorage));
  }, [page]);

  async function save() {
    const nickname = nicknameFor(avatar);
    if (!nickname) return;
    setBusy(true);
    setMessage(null);
    try {
      onSaved(await savePlayer(player.user_id, nickname, avatar));
      setMessage('Збережено');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Signs out of the profile: the animal is released for another player, and this browser starts over.
  async function leave() {
    const ok = window.confirm(
      `Вийти з профілю? Тварина «${nicknameFor(player.avatar) ?? 'гравець'}» звільниться, і її зможе обрати інший гравець. ` +
        'Ваші знахідки лишаться на карті, але з цього браузера ви їх більше не побачите. Відновити профіль не можна.',
    );
    if (!ok) return;
    setBusy(true);
    try {
      await releaseProfile();
      await supabase.auth.signOut({ scope: 'local' });
      window.location.reload();
    } catch (e) {
      setMessage((e as Error).message);
      setBusy(false);
    }
  }

  // A feature's own page: a back button and a title, like a settings detail screen.
  if (page) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-safe-top">
        <header className="flex items-center gap-3 pt-3">
          <button
            type="button"
            onClick={() => setPage(null)}
            aria-label="Назад до профілю"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--paper)] text-[var(--ink)] elev-sm"
          >
            <Icon name="arrow_back" size={22} />
          </button>
          <h1 className="dl-title text-[26px]">{page === 'offline' ? 'Офлайн-карта' : 'Перенести профіль'}</h1>
        </header>
        <div className="ios-group mt-6 p-5">
          {page === 'offline' ? <OfflineSection points={offlinePoints} /> : <TransferCodeMaker />}
        </div>
      </div>
    );
  }

  const savedDate = offline
    ? new Date(offline.savedAt).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })
    : null;

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-safe-top">
      <h1 className="ios-large-title pt-4">Профіль</h1>

      <div className="mt-6 flex flex-col items-center gap-3">
        <span className="grid h-24 w-24 place-items-center rounded-full border-[3px] border-[var(--green)] bg-[var(--paper)] text-5xl elev-green">
          {avatarEmoji(avatar)}
        </span>
        <span className="text-[20px] font-bold">{nicknameFor(avatar) ?? 'Гравець'}</span>
      </div>

      <p className="ios-section mt-10">Мій нік</p>
      <div className="mt-2">
        <NicknamePicker value={avatar} taken={taken} onPick={setAvatar} />
      </div>

      {/* Shown only when the animal has changed: it slides up from the bottom and goes away once saved. */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            key="save-bar"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', visualDuration: 0.3, bounce: 0 }}
            className="fixed inset-x-0 z-40 border-t border-[var(--line)] bg-[var(--paper)]/95 backdrop-blur-md"
            style={{ bottom: bottomInset }}
          >
            <div className="mx-auto w-full max-w-md px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
              <button type="button" disabled={busy} onClick={() => void save()} className="dl-btn">
                {busy ? 'Зберігаємо…' : 'Зберегти зміни'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {message && <p role="status" className="mt-3 text-center text-[15px] font-semibold text-[var(--green-deep)]">{message}</p>}

      <p className="ios-section mt-10">Налаштування</p>
      <div className="ios-group">
        <SettingsRow
          icon="travel_explore"
          label="Офлайн-карта"
          value={savedDate ? `Збережено ${savedDate}` : 'Не збережено'}
          onClick={() => setPage('offline')}
        />
        <SettingsRow icon="group" label="Перенести профіль" value="Код для іншого браузера" onClick={() => setPage('transfer')} last />
      </div>

      <div className="ios-group mt-8">
        <button
          type="button"
          disabled={busy}
          onClick={() => void leave()}
          className="flex min-h-[56px] w-full items-center justify-center bg-[var(--paper)] px-4 py-3 text-[16px] font-bold text-[var(--danger)] disabled:opacity-40"
        >
          Вийти з профілю
        </button>
      </div>
      <p className="px-4 pt-2 text-[13px] leading-snug text-[var(--muted)]">
        Тварина звільниться для іншого гравця. Знахідки лишаться на карті, але з цього браузера їх не буде видно. Відновити профіль не можна.
      </p>
    </div>
  );
}
