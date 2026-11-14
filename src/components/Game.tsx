'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import MapView, { type OtherPlayer } from '@/components/MapView';
import Onboarding from '@/components/Onboarding';
import StatusBar from '@/components/StatusBar';
import TreasureSheetContent from '@/components/TreasureSheetContent';
import type { LatLng } from '@/lib/geo';
import { openGameConnection, type GameConnection, type PresenceUser } from '@/lib/realtime';
import { checkIsAdmin, getPlayer, type Player } from '@/lib/player';
import { ensureSession } from '@/lib/session';
import { shouldSend } from '@/lib/sendPolicy';
import { useGeolocation } from '@/lib/useGeolocation';
import { useTreasures } from '@/lib/useTreasures';
import { useWakeLock } from '@/lib/useWakeLock';

type Position = LatLng & { seenAt: number };

// The one screen for everyone: the map is visible at once; a player without a profile sees onboarding over it.
export default function Game() {
  const [userId, setUserId] = useState<string | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [admin, setAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const geo = useGeolocation();
  const wake = useWakeLock();
  const { treasures, error, reload } = useTreasures();
  const connRef = useRef<GameConnection | null>(null);
  const lastSent = useRef<{ pos: LatLng | null; at: number }>({ pos: null, at: -Infinity });
  const names = useRef(new Map<string, PresenceUser>()); // keeps a name after its presence leaves

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { userId: uid } = await ensureSession();
        const [p, isAdmin] = await Promise.all([getPlayer(uid), checkIsAdmin()]);
        if (cancelled) return;
        setUserId(uid);
        setPlayer(p);
        setAdmin(isAdmin);
      } catch (e) {
        if (!cancelled) setFailed((e as Error).message);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Realtime opens once this browser has a player profile.
  useEffect(() => {
    if (!player) return;
    const conn = openGameConnection({
      me: { user_id: player.user_id, nickname: player.nickname, avatar: player.avatar },
      onPosition: (m) =>
        setPositions((prev) => ({ ...prev, [m.user_id]: { lat: m.lat, lng: m.lng, seenAt: Date.now() } })),
      onOnline: (users) => {
        for (const u of users) names.current.set(u.user_id, u);
        setPresence(users);
      },
      onTreasuresChanged: () => { void reload(); },
      onStatus: setOnline,
    });
    connRef.current = conn;
    return () => { conn.close(); connRef.current = null; };
  }, [player, reload]);

  // Broadcast own position, throttled (spec §3: at most every 2 s, and only after moving more than 2 m).
  useEffect(() => {
    const conn = connRef.current;
    if (!conn || !geo.pos) return;
    const now = Date.now();
    if (shouldSend(lastSent.current.pos, geo.pos, lastSent.current.at, now)) {
      conn.sendPosition(geo.pos, geo.accuracy);
      lastSent.current = { pos: geo.pos, at: now };
    }
  }, [geo.pos, geo.accuracy, player]);

  const others: OtherPlayer[] = useMemo(() => {
    void presence; // re-read the name cache when presence changes
    return Object.entries(positions)
      .filter(([id]) => id !== player?.user_id)
      .map(([id, p]) => ({
        id,
        nickname: names.current.get(id)?.nickname ?? 'Гравець',
        avatar: names.current.get(id)?.avatar ?? '',
        lat: p.lat,
        lng: p.lng,
        seenAt: p.seenAt,
      }));
  }, [positions, presence, player]);

  const selectTreasure = useCallback((t: { id: string }) => {
    if (player) setSelectedId(t.id);
  }, [player]);

  const selected = treasures.find((t) => t.id === selectedId) ?? null;
  const foundCount = treasures.filter((t) => t.is_found).length;
  const allFound = treasures.length > 0 && foundCount === treasures.length;

  if (!ready) return <main className="p-6 text-neutral-500">Завантаження…</main>;
  if (failed) return <main className="p-6 text-red-600">{failed}</main>;

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView
        treasures={treasures}
        me={geo.pos}
        meAvatar={player?.avatar ?? null}
        others={others}
        onSelectTreasure={selectTreasure}
      />
      <div className="absolute inset-x-0 top-0 p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <StatusBar
          title="Lost"
          foundCount={foundCount}
          total={treasures.length}
          gps={geo.status}
          accuracy={geo.accuracy}
          wakeActive={wake.active}
          wakeSupported={wake.supported}
          online={online || !player}
        />
        {allFound && <p className="mt-2 rounded-xl bg-white/80 px-3 py-1 text-sm font-semibold">Усі скарби знайдено</p>}
        {geo.status === 'denied' && <p className="mt-2 rounded-xl bg-white/80 px-3 py-1 text-sm">Увімкніть геолокацію, щоб шукати</p>}
        {error && <p className="mt-2 rounded-xl bg-white/80 px-3 py-1 text-sm text-red-600">{error}</p>}
        {admin && (
          <Link href="/admin" className="mt-2 inline-block rounded-xl bg-white/80 px-3 py-1 text-sm font-medium text-blue-600">
            Адмін: додати скарб
          </Link>
        )}
      </div>
      {selected && player && (
        <BottomSheet key={selected.id} initial="half">
          <div className="flex justify-end px-3">
            <button type="button" aria-label="Закрити" onClick={() => setSelectedId(null)} className="px-3 text-xl text-neutral-500">×</button>
          </div>
          <TreasureSheetContent
            treasure={selected}
            pos={geo.pos}
            accuracy={geo.accuracy}
            onResult={() => { void reload(); }}
          />
        </BottomSheet>
      )}
      {ready && userId && !player && <Onboarding userId={userId} onSaved={setPlayer} />}
    </main>
  );
}
