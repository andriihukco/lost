'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import MapView, { type OtherPlayer } from '@/components/MapView';
import MyFinds from '@/components/MyFinds';
import Onboarding from '@/components/Onboarding';
import StatusBar from '@/components/StatusBar';
import TreasureSheetContent from '@/components/TreasureSheetContent';
import { haversineM, type LatLng } from '@/lib/geo';
import { nearestWithin, NEARBY_M } from '@/lib/nearby';
import { shouldLogLocation } from '@/lib/locationLog';
import { saveLocation } from '@/lib/locationStore';
import { openGameConnection, type GameConnection, type PresenceUser, type TreasureChange } from '@/lib/realtime';
import { checkIsAdmin, getAllPlayers, getPlayer, type Player } from '@/lib/player';
import { ensureSession } from '@/lib/session';
import { shouldSend } from '@/lib/sendPolicy';
import { useGeolocation } from '@/lib/useGeolocation';
import { useTreasures, type Treasure } from '@/lib/useTreasures';
import { useWakeLock } from '@/lib/useWakeLock';

type Position = LatLng & { seenAt: number };
type Toast = { id: number; text: string };
type Sheet = { kind: 'treasure'; id: string } | { kind: 'finds' } | null;

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
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const geo = useGeolocation();
  const wake = useWakeLock();
  const { treasures, error, reload } = useTreasures();
  const connRef = useRef<GameConnection | null>(null);
  const lastSent = useRef<{ pos: LatLng | null; at: number }>({ pos: null, at: -Infinity });
  const lastLogged = useRef<{ pos: LatLng | null; at: number }>({ pos: null, at: -Infinity });
  const names = useRef(new Map<string, { nickname: string; avatar: string }>());

  const nameOf = useCallback((id: string) => names.current.get(id)?.nickname ?? 'Гравець', []);

  // Players who joined after the page loaded are looked up once and cached (for notices).
  const resolveName = useCallback(async (id: string) => {
    if (names.current.has(id)) return nameOf(id);
    const p = await getPlayer(id).catch(() => null);
    if (p) names.current.set(id, { nickname: p.nickname, avatar: p.avatar });
    return p?.nickname ?? 'Гравець';
  }, [nameOf]);

  const pushToast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text }].slice(-3));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { userId: uid } = await ensureSession();
        const [p, isAdmin, everyone] = await Promise.all([getPlayer(uid), checkIsAdmin(), getAllPlayers()]);
        if (cancelled) return;
        for (const e of everyone) names.current.set(e.user_id, { nickname: e.nickname, avatar: e.avatar });
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

  // Realtime opens once this browser has a player profile. Found changes arrive here too.
  useEffect(() => {
    if (!player) return;
    const conn = openGameConnection({
      me: { user_id: player.user_id, nickname: player.nickname, avatar: player.avatar },
      onPosition: (m) =>
        setPositions((prev) => ({ ...prev, [m.user_id]: { lat: m.lat, lng: m.lng, seenAt: Date.now() } })),
      onOnline: (users) => {
        for (const u of users) names.current.set(u.user_id, { nickname: u.nickname, avatar: u.avatar });
        setPresence(users);
      },
      onTreasuresChanged: (change: TreasureChange) => {
        void reload();
        const row = change.new;
        const title = row.title ?? 'скарб';
        if (change.eventType === 'UPDATE' && row.is_found === false) pushToast(`«${title}» знову на карті`);
        if (row.is_found === true && row.found_by && row.found_by !== player.user_id) {
          const finder = row.found_by;
          void resolveName(finder).then((name) => pushToast(`${name} знайшов(ла) «${title}»`));
        }
      },
      onStatus: setOnline,
    });
    connRef.current = conn;
    return () => { conn.close(); connRef.current = null; };
  }, [player, reload, pushToast, resolveName]);

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

  // Trail for later path and search history: a point per 10 m moved or per 30 s.
  useEffect(() => {
    if (!player || !geo.pos) return;
    const now = Date.now();
    if (shouldLogLocation(lastLogged.current.pos, geo.pos, lastLogged.current.at, now)) {
      lastLogged.current = { pos: geo.pos, at: now };
      saveLocation(player.user_id, geo.pos, geo.accuracy).catch(() => {});
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

  // Found treasures leave the map for everyone; the finder sees them under "Мої знахідки".
  const openTreasures = useMemo(() => treasures.filter((t) => !t.is_found), [treasures]);
  const distances = useMemo(() => {
    const out: Record<string, number> = {};
    if (geo.pos) for (const t of openTreasures) out[t.id] = haversineM(geo.pos, t);
    return out;
  }, [geo.pos, openTreasures]);
  const nearby = useMemo(() => nearestWithin(openTreasures, geo.pos), [openTreasures, geo.pos]);
  const myFinds = useMemo(
    () => treasures.filter((t) => t.is_found && t.found_by === player?.user_id),
    [treasures, player],
  );

  const selectTreasure = useCallback((t: { id: string }) => {
    if (player) setSheet({ kind: 'treasure', id: t.id });
  }, [player]);

  const selected: Treasure | null =
    sheet?.kind === 'treasure' ? treasures.find((t) => t.id === sheet.id) ?? null : null;
  const foundCount = treasures.filter((t) => t.is_found).length;
  const allFound = treasures.length > 0 && foundCount === treasures.length;

  if (!ready) return <main className="p-6 text-neutral-500">Завантаження…</main>;
  if (failed) return <main className="p-6 text-red-600">{failed}</main>;

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView
        treasures={openTreasures}
        distances={distances}
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
        {player && (
          <button
            type="button"
            onClick={() => setSheet({ kind: 'finds' })}
            className="mt-2 rounded-xl bg-white/80 px-3 py-1 text-sm font-medium text-blue-600"
          >
            Мої знахідки ({myFinds.length})
          </button>
        )}
        {allFound && <p className="mt-2 rounded-xl bg-white/80 px-3 py-1 text-sm font-semibold">Усі скарби знайдено</p>}
        {geo.status === 'denied' && <p className="mt-2 rounded-xl bg-white/80 px-3 py-1 text-sm">Увімкніть геолокацію, щоб шукати</p>}
        {error && <p className="mt-2 rounded-xl bg-white/80 px-3 py-1 text-sm text-red-600">{error}</p>}
        {admin && (
          <Link href="/admin" className="mt-2 inline-block rounded-xl bg-white/80 px-3 py-1 text-sm font-medium text-blue-600">
            Адмін: додати скарб
          </Link>
        )}
        {toasts.map((t) => (
          <p key={t.id} role="status" className="mt-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow">
            {t.text}
          </p>
        ))}
      </div>
      {player && nearby && !sheet && (
        <button
          type="button"
          onClick={() => setSheet({ kind: 'treasure', id: nearby.treasure.id })}
          className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+1rem)] rounded-2xl bg-white/95 px-4 py-3 text-left shadow-xl"
        >
          <span className="block text-xs text-neutral-500">Скарб поруч (до {NEARBY_M} м)</span>
          <span className="font-semibold">{nearby.treasure.title} · {Math.round(nearby.distanceM)} м</span>
        </button>
      )}
      {selected && player && (
        <BottomSheet key={selected.id} initial="half">
          <div className="flex justify-end px-3">
            <button type="button" aria-label="Закрити" onClick={() => setSheet(null)} className="px-3 text-xl text-neutral-500">×</button>
          </div>
          <TreasureSheetContent
            treasure={selected}
            pos={geo.pos}
            accuracy={geo.accuracy}
            distanceM={distances[selected.id] ?? null}
            onResult={() => { void reload(); }}
          />
        </BottomSheet>
      )}
      {sheet?.kind === 'finds' && player && (
        <BottomSheet key="finds" initial="half">
          <div className="flex justify-end px-3">
            <button type="button" aria-label="Закрити" onClick={() => setSheet(null)} className="px-3 text-xl text-neutral-500">×</button>
          </div>
          <MyFinds finds={myFinds} onChanged={() => { void reload(); }} />
        </BottomSheet>
      )}
      {ready && userId && !player && <Onboarding userId={userId} onSaved={setPlayer} />}
    </main>
  );
}
