'use client';

import { useEffect, useState } from 'react';
import NicknamePicker from '@/components/NicknamePicker';
import { avatarEmoji, nicknameFor, type AvatarKey } from '@/lib/avatars';
import { getAllPlayers, savePlayer, type Player } from '@/lib/player';
import OfflineMap from '@/components/OfflineMap';
import type { LatLng } from '@/lib/geo';

// "Профіль" tab: the player's animal and nickname. Another free animal can be chosen; its nickname comes with it.
export default function ProfileTab({ player, onSaved, offlinePoints }: { player: Player; onSaved: (p: Player) => void; offlinePoints: LatLng[] }) {
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

      <button type="button" disabled={!dirty || busy} onClick={() => void save()} className="dl-btn mt-6">
        {busy ? 'Зберігаємо…' : 'Зберегти зміни'}
      </button>
      {message && <p role="status" className="mt-3 text-center text-[15px] font-semibold text-[var(--green-deep)]">{message}</p>}

      <p className="ios-section mt-8">Офлайн</p>
      <div className="dl-card mt-2 p-4">
        <OfflineMap points={offlinePoints} variant="card" />
      </div>
    </div>
  );
}
