'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Icon from '@/components/Icon';
import NicknamePicker from '@/components/NicknamePicker';
import OfflineSection from '@/components/OfflineSection';
import { LockPicker, PasscodeSetup } from '@/components/Passcode';
import { TransferCodeMaker } from '@/components/ProfileTransfer';
import type { LatLng } from '@/lib/geo';
import { avatarEmoji, nicknameFor, type AvatarKey } from '@/lib/avatars';
import { clearPasscode, DEFAULT_LOCK_MS, passcodeSummary, type Passcode, readPasscode, setLockAfter, setPasscode } from '@/lib/passcode';
import { readOfflineStatus, type OfflineStatus } from '@/lib/offlineMap';
import { getAllPlayers, releaseProfile, savePlayer, type Player } from '@/lib/player';
import { supabase } from '@/lib/supabase';

type Page = 'animal' | 'passcode' | 'offline' | 'transfer' | null;

// One row of a settings cell: an emoji, a title, what it shows now, and a chevron.
function SettingsRow({ emoji, label, value, onClick, last = false }: { emoji: string; label: string; value: string; onClick: () => void; last?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[60px] w-full items-center gap-3 bg-[var(--paper)] px-4 py-3 text-left ${last ? '' : 'border-b border-[var(--line)]'}`}
    >
      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center text-[24px] leading-none">{emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold">{label}</span>
        <span className="block truncate text-[13px] text-[var(--muted)]">{value}</span>
      </span>
      <Icon name="arrow_forward" size={18} className="shrink-0 text-[var(--muted)]" />
    </button>
  );
}

// A page opened from the profile: a back button and a title.
function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="flex items-center gap-3 pt-3">
      <button
        type="button"
        onClick={onBack}
        aria-label="Назад до профілю"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--paper)] text-[var(--ink)] elev-sm"
      >
        <Icon name="arrow_back" size={22} />
      </button>
      <h1 className="dl-title text-[26px]">{title}</h1>
    </header>
  );
}

// "Profile" tab: the animal and nickname on top, then one settings cell. Each setting has its own page.
export default function ProfileTab({ player, onSaved, offlinePoints, bottomInset = 0 }: { player: Player; onSaved: (p: Player) => void; offlinePoints: LatLng[]; bottomInset?: number }) {
  const [page, setPage] = useState<Page>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [offline, setOffline] = useState<OfflineStatus | null>(null);
  const [passcode, setPasscodeState] = useState<Passcode | null>(null);

  // Saved states are read again each time a page closes, so the rows show the latest.
  useEffect(() => {
    if (page !== null) return;
    setOffline(readOfflineStatus(window.localStorage));
    setPasscodeState(readPasscode(window.localStorage));
  }, [page]);

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

  if (page === 'animal') {
    return (
      <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-safe-top">
        <PageHeader title="Тварина і нік" onBack={() => setPage(null)} />
        <AnimalPage player={player} onSaved={onSaved} bottomInset={bottomInset} />
      </div>
    );
  }

  if (page === 'passcode') {
    return (
      <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-safe-top">
        <PageHeader title="Код-пароль" onBack={() => setPage(null)} />
        <PasscodePage />
      </div>
    );
  }

  if (page === 'offline' || page === 'transfer') {
    return (
      <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-safe-top">
        <PageHeader title={page === 'offline' ? 'Офлайн-карта' : 'Перенести профіль'} onBack={() => setPage(null)} />
        <div className="ios-group mt-6 p-5">
          {page === 'offline' ? <OfflineSection points={offlinePoints} /> : <TransferCodeMaker />}
        </div>
      </div>
    );
  }

  const savedDate = offline ? new Date(offline.savedAt).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' }) : null;

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-safe-top">
      <h1 className="ios-large-title pt-4">Профіль</h1>

      <div className="mt-6 flex flex-col items-center gap-3">
        <span className="grid h-24 w-24 place-items-center rounded-full border-[3px] border-[var(--green)] bg-[var(--paper)] text-5xl elev-green">
          {avatarEmoji(player.avatar)}
        </span>
        <span className="text-[20px] font-bold">{nicknameFor(player.avatar) ?? 'Гравець'}</span>
      </div>

      <p className="ios-section mt-10">Налаштування</p>
      <div className="ios-group">
        <SettingsRow emoji={avatarEmoji(player.avatar)} label="Тварина і нік" value={nicknameFor(player.avatar) ?? 'Гравець'} onClick={() => setPage('animal')} />
        <SettingsRow emoji="🔐" label="Код-пароль" value={passcodeSummary(passcode)} onClick={() => setPage('passcode')} />
        <SettingsRow emoji="🗺️" label="Офлайн-карта" value={savedDate ? `Збережено ${savedDate}` : 'Не збережено'} onClick={() => setPage('offline')} />
        <SettingsRow emoji="📲" label="Перенести профіль" value="Код для іншого браузера" onClick={() => setPage('transfer')} last />
      </div>

      {message && <p role="status" className="mt-3 text-center text-[15px] font-semibold text-[var(--danger)]">{message}</p>}

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

// The animal and nickname: choose another free animal. Its nickname comes with it.
function AnimalPage({ player, onSaved, bottomInset }: { player: Player; onSaved: (p: Player) => void; bottomInset: number }) {
  const [avatar, setAvatar] = useState<AvatarKey>(player.avatar);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  const dirty = avatar !== player.avatar;

  useEffect(() => {
    // Animals chosen by other players are greyed out; my own stays available.
    getAllPlayers().then((list) => setTaken(list.filter((p) => p.user_id !== player.user_id).map((p) => p.avatar))).catch(() => {});
  }, [player.user_id]);

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

  return (
    <div className="mt-6">
      <div className="flex flex-col items-center gap-3">
        <span className="grid h-24 w-24 place-items-center rounded-full border-[3px] border-[var(--green)] bg-[var(--paper)] text-5xl elev-green">
          {avatarEmoji(avatar)}
        </span>
        <span className="text-[20px] font-bold">{nicknameFor(avatar) ?? 'Гравець'}</span>
      </div>

      <p className="ios-section mt-10">Оберіть тварину</p>
      <NicknamePicker value={avatar} taken={taken} onPick={setAvatar} />

      {message && <p role="status" className="mt-3 text-center text-[15px] font-semibold text-[var(--green-deep)]">{message}</p>}

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
    </div>
  );
}

// The passcode: turn it on, change it, choose when it locks, or turn it off.
function PasscodePage() {
  const [p, setP] = useState<Passcode | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'view' | 'set'>('view');

  useEffect(() => {
    setP(readPasscode(window.localStorage));
    setReady(true);
  }, []);

  function reread() {
    setP(readPasscode(window.localStorage));
  }

  async function onNewCode(pin: string) {
    await setPasscode(window.localStorage, pin, p?.lockAfterMs ?? DEFAULT_LOCK_MS);
    reread();
    setMode('view');
  }

  function changeLock(ms: number) {
    setLockAfter(window.localStorage, ms);
    reread();
  }

  function turnOff() {
    if (!window.confirm('Вимкнути код-пароль на цьому пристрої?')) return;
    clearPasscode(window.localStorage);
    reread();
  }

  if (!ready) return null;

  if (mode === 'set') {
    return (
      <div className="ios-group mt-6 p-5">
        <PasscodeSetup onSet={(pin) => void onNewCode(pin)} />
        <button type="button" onClick={() => setMode('view')} className="mt-6 min-h-[44px] w-full text-center text-[15px] font-bold text-[var(--muted)]">
          Скасувати
        </button>
      </div>
    );
  }

  if (!p) {
    return (
      <div className="mt-6 flex flex-col gap-4">
        <div className="ios-group p-5 text-center">
          <span aria-hidden className="text-[48px] leading-none">🔐</span>
          <p className="mt-3 text-[17px] font-bold">Код-пароль вимкнено</p>
          <p className="mt-2 text-[14px] leading-snug text-[var(--muted)]">
            З кодом застосунок відкривається тільки для вас. Код знає лише цей пристрій.
          </p>
        </div>
        <button type="button" onClick={() => setMode('set')} className="dl-btn">
          Увімкнути код
        </button>
      </div>
    );
  }

  return (
    <>
      <p className="ios-section mt-10">Код</p>
      <div className="ios-group">
        <button type="button" onClick={() => setMode('set')} className="flex min-h-[52px] w-full items-center justify-between bg-[var(--paper)] px-4 text-left text-[16px] font-semibold">
          Змінити код
          <Icon name="arrow_forward" size={18} className="text-[var(--muted)]" />
        </button>
      </div>

      <p className="ios-section mt-10">Блокувати після</p>
      <LockPicker value={p.lockAfterMs} onChange={changeLock} />
      <p className="px-4 pt-2 text-[13px] leading-snug text-[var(--muted)]">
        Застосунок попросить код, якщо ним не користуватися стільки часу. Він також просить код, коли відкривається.
      </p>

      <div className="ios-group mt-10">
        <button type="button" onClick={turnOff} className="flex min-h-[52px] w-full items-center justify-center bg-[var(--paper)] px-4 text-[16px] font-bold text-[var(--danger)]">
          Вимкнути код
        </button>
      </div>
    </>
  );
}
