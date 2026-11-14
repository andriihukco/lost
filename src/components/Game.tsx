'use client';

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
import { getAllPlayers, getPlayer, type Player } from '@/lib/player';
import { ensureSession } from '@/lib/session';
import { shouldSend } from '@/lib/sendPolicy';
import { shouldBroadcastHeading } from '@/lib/heading';
import { useGeolocation } from '@/lib/useGeolocation';
import { useHeading } from '@/lib/useHeading';
import { useTreasures, type Treasure } from '@/lib/useTreasures';
import { useWakeLock } from '@/lib/useWakeLock';

type Position = LatLng & { seenAt: number; heading: number | null };
type Toast = { id: number; text: string };
type Sheet = { kind: 'treasure'; id: string } | { kind: 'finds' } | null;

// The one screen for everyone: the map is visible at once; a player without a profile sees onboarding over it.
export default function Game() {
  const [userId, setUserId] = useState<string | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const geo = useGeolocation();
  const compass = useHeading();
  const wake = useWakeLock();
  const { treasures, error, reload } = useTreasures();
  // Compass if the browser has one (phones), otherwise the GPS course while moving.
  const myHeading = compass.heading ?? geo.course;
  const connRef = useRef<GameConnection | null>(null);
  const lastSent = useRef<{ pos: LatLng | null; at: number; heading: number | null }>({ pos: null, at: -Infinity, heading: null });
  const lastLogged = useRef<{ pos: LatLng | null; at: number }>({ pos: null, at: -Infinity });
  const names = useRef(new Map<string, { nickname: string; avatar: string }>());

  const nameOf = useCallback((id: string) => names.current.get(id)?.nickname ?? 'Гравець', []);

  // Players who joined after the page loaded are looked up once and cached (for notices and labels).
  const resolveName = useCallback(async (id: string) => {
    if (names.current.has(id)) return nameOf(id);
    const p = await getPlayer(id).catch(() => null);
    if (p) names.current.set(id, { nickname: p.nickname, avatar: p.avatar });
    return p?.nickname ?? 'Гравець';
  }, [nameOf]);

  const pushToast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text }].slice(-3));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { userId: uid } = await ensureSession();
        const [p, everyone] = await Promise.all([getPlayer(uid), getAllPlayers()]);
        if (cancelled) return;
        for (const e of everyone) names.current.set(e.user_id, { nickname: e.nickname, avatar: e.avatar });
        setUserId(uid);
        setPlayer(p);
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
        setPositions((prev) => ({
          ...prev,
          [m.user_id]: { lat: m.lat, lng: m.lng, heading: m.heading ?? null, seenAt: Date.now() },
        })),
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

  // Broadcast own position and heading. Position: at most every 2 s, after 2 m. Heading: after a 30° turn.
  useEffect(() => {
    const conn = connRef.current;
    if (!conn || !geo.pos) return;
    const now = Date.now();
    const moved = shouldSend(lastSent.current.pos, geo.pos, lastSent.current.at, now);
    const turned = shouldBroadcastHeading(lastSent.current.heading, myHeading, lastSent.current.at, now);
    if (moved || turned) {
      conn.sendPosition(geo.pos, geo.accuracy, myHeading);
      lastSent.current = { pos: geo.pos, at: now, heading: myHeading };
    }
  }, [geo.pos, geo.accuracy, myHeading, player]);

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
        heading: p.heading,
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

  if (!ready) return <main className="p-6 text-[var(--muted)]">Завантаження…</main>;
  if (failed) return <main className="p-6 font-semibold text-[var(--danger)]">{failed}</main>;

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView
        treasures={openTreasures}
        distances={distances}
        me={geo.pos}
        meAvatar={player?.avatar ?? null}
        meName={player?.nickname ?? null}
        meHeading={myHeading}
        others={others}
        onSelectTreasure={selectTreasure}
      />

      <div className="absolute inset-x-0 top-0 flex flex-col gap-2 p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
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
        <div className="flex flex-wrap gap-2">
          {player && (
            <button type="button" onClick={() => setSheet({ kind: 'finds' })} className="dl-tag px-3 py-1.5 text-sm">
              Мої знахідки ({myFinds.length})
            </button>
          )}
          {compass.status === 'needs-permission' && (
            <button type="button" onClick={() => void compass.requestPermission()} className="dl-tag px-3 py-1.5 text-sm">
              Увімкнути компас
            </button>
          )}
        </div>
        {allFound && <p className="dl-card px-4 py-2 text-sm font-bold">Усі скарби знайдено</p>}
        {geo.status === 'denied' && (
          <p className="dl-card px-4 py-2 text-sm font-semibold text-[var(--danger)]">Увімкніть геолокацію, щоб шукати</p>
        )}
        {error && <p className="dl-card px-4 py-2 text-sm font-semibold text-[var(--danger)]">{error}</p>}
        {toasts.map((t) => (
          <p key={t.id} role="status" className="rounded-2xl bg-[var(--green)] px-4 py-3 text-sm font-bold text-white shadow-[0_4px_0_var(--green-deep)]">
            {t.text}
          </p>
        ))}
      </div>

      {player && nearby && !sheet && (
        <button
          type="button"
          onClick={() => setSheet({ kind: 'treasure', id: nearby.treasure.id })}
          className="dl-card absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+1rem)] flex items-center gap-3 px-4 py-3 text-left"
        >
          <span className="dl-pin-badge !h-12 !w-12 shrink-0">🍄</span>
          <span className="min-w-0">
            <span className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Скарб поруч (до {NEARBY_M} м)</span>
            <span className="block truncate text-base font-extrabold">{nearby.treasure.title} · {Math.round(nearby.distanceM)} м</span>
          </span>
        </button>
      )}

      {selected && player && (
        <BottomSheet key={selected.id} initial="half">
          <div className="flex justify-end px-4 pt-2">
            <button type="button" aria-label="Закрити" onClick={() => setSheet(null)} className="grid h-10 w-10 place-items-center rounded-full text-2xl text-[var(--muted)]">×</button>
          </div>
          <TreasureSheetContent
            treasure={selected}
            pos={geo.pos}
            accuracy={geo.accuracy}
            distanceM={distances[selected.id] ?? null}
            heading={myHeading}
            onResult={(status) => {
              void reload();
              if (status === 'won') {
                setSheet(null);
                pushToast('Знахідку підтверджено! Скарб знято з карти.');
              }
            }}
          />
        </BottomSheet>
      )}

      {sheet?.kind === 'finds' && player && (
        <BottomSheet key="finds" initial="half">
          <div className="flex justify-end px-4 pt-2">
            <button type="button" aria-label="Закрити" onClick={() => setSheet(null)} className="grid h-10 w-10 place-items-center rounded-full text-2xl text-[var(--muted)]">×</button>
          </div>
          <MyFinds finds={myFinds} onChanged={() => { void reload(); }} />
        </BottomSheet>
      )}

      {ready && userId && !player && <Onboarding userId={userId} onSaved={setPlayer} />}
    </main>
  );
}
