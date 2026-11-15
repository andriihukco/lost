'use client';

import { useEffect, useState } from 'react';
import NicknamePicker from '@/components/NicknamePicker';
import { avatarEmoji, nicknameFor, type AvatarKey } from '@/lib/avatars';
import { getAllPlayers, releaseProfile, savePlayer, type Player } from '@/lib/player';
import { supabase } from '@/lib/supabase';
import OfflineSection from '@/components/OfflineSection';
import { TransferCodeMaker } from '@/components/ProfileTransfer';
import { AnimatePresence, motion } from 'motion/react';
import type { LatLng } from '@/lib/geo';

// "Профіль" tab: the player's animal and nickname. Another free animal can be chosen; its nickname comes with it.
export default function ProfileTab({ player, onSaved, offlinePoints, bottomInset = 0 }: { player: Player; onSaved: (p: Player) => void; offlinePoints: LatLng[]; bottomInset?: number }) {
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

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-safe-top">
      <h1 className="ios-large-title pt-4">Профіль</h1>

      <div className="mt-6 flex flex-col items-center gap-3">
        <span className="grid h-24 w-24 place-items-center rounded-full border-[3px] border-[var(--green)] bg-[var(--paper)] text-5xl elev-green">
          {avatarEmoji(avatar)}
        </span>
        <span className="text-[20px] font-bold">{nicknameFor(avatar) ?? 'Гравець'}</span>
      </div>

      <p className="ios-section mt-8">Мій нік</p>
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

      <p className="ios-section mt-8">Офлайн-карта</p>
      <div className="dl-card mt-2 p-4">
        <OfflineSection points={offlinePoints} />
      </div>

      <p className="ios-section mt-8">Перенести профіль</p>
      <div className="dl-card mt-2 p-4">
        <TransferCodeMaker />
      </div>

      <p className="ios-section mt-8">Профіль</p>
      <div className="mt-2 flex flex-col gap-2">
        <p className="px-1 text-[14px] leading-snug text-[var(--muted)]">
          Вийдіть, щоб звільнити тварину для іншого гравця. Наступного разу буде новий профіль.
        </p>
        <button type="button" disabled={busy} onClick={() => void leave()} className="dl-btn-danger">
          Вийти з профілю
        </button>
      </div>
    </div>
  );
}
