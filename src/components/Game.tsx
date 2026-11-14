'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import FindsTab from '@/components/FindsTab';
import MapView, { type OtherPlayer, type RouteView } from '@/components/MapView';
import Onboarding from '@/components/Onboarding';
import Welcome from '@/components/Welcome';
import InAppGate from '@/components/InAppGate';
import { detectInApp, type InApp } from '@/lib/inApp';
import { isWelcomed, markWelcomed } from '@/lib/welcome';
import ProfileTab from '@/components/ProfileTab';
import TabBar, { type Tab } from '@/components/TabBar';
import TreasureSheetContent from '@/components/TreasureSheetContent';
import { haversineM, type LatLng } from '@/lib/geo';
import { optimalOrder, pathLengthM } from '@/lib/routePlan';
import { fetchWalkingRoute, straightRoute, type WalkRoute } from '@/lib/routing';
import { formatDistance } from '@/lib/geoFormat';
import { pinOrDefault } from '@/lib/pinEmoji';
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
type RouteState = { stops: Treasure[]; walk: WalkRoute; pending: boolean };
type Toast = { id: number; text: string };

// Three tabs, iOS-style: the map, my finds, my profile. The sheet and the nearby notice sit above the tab bar.
export default function Game() {
  const [userId, setUserId] = useState<string | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('map');
  const [tabBarH, setTabBarH] = useState(64);
  const [online, setOnline] = useState(false);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteState | null>(null);
  const [focus, setFocus] = useState<{ id: string | null; nonce: number }>({ id: null, nonce: 0 });
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Location is asked for on the welcome screen first; until then nothing prompts the browser.
  const [welcomed, setWelcomed] = useState<boolean | null>(null);
  const [inApp, setInApp] = useState<InApp | null>(null);
  const [inAppOk, setInAppOk] = useState(false); // the player chose to continue inside the app
  const [recenter, setRecenter] = useState(0);
  const geo = useGeolocation(welcomed === true);
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

  // Best order for the chosen treasures from where I am, then the walk along paths (straight line as fallback).
  const planRoute = useCallback(async (ids: string[], list: Treasure[]) => {
    if (!geo.pos) {
      pushToast('Потрібен GPS, щоб побудувати маршрут');
      return;
    }
    const chosen = list.filter((t) => ids.includes(t.id));
    if (chosen.length === 0) return;
    const start = geo.pos;
    const order = optimalOrder(start, chosen.map((t) => ({ lat: t.lat, lng: t.lng })));
    const ordered = order.map((i) => chosen[i]);
    const pts = ordered.map((t) => ({ lat: t.lat, lng: t.lng }));
    const straight = [start, ...pts];
    setRoute({ stops: ordered, walk: straightRoute(straight, pathLengthM(start, pts)), pending: true });
    setTab('map');
    setSelectedId(null);
    const walk = await fetchWalkingRoute(straight);
    setRoute((prev) => (prev && prev.stops === ordered ? { ...prev, walk: walk ?? prev.walk, pending: false } : prev));
  }, [geo.pos, pushToast]);

  // Show a treasure on the map (from the Знахідки tab): switch to the map and fly to it.
  const showOnMap = useCallback((id: string) => {
    setTab('map');
    setSelectedId(null);
    setFocus((f) => ({ id, nonce: f.nonce + 1 }));
  }, []);

  useEffect(() => {
    setWelcomed(isWelcomed(window.localStorage));
    setInApp(detectInApp(navigator.userAgent));
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

  // Found treasures leave the map for everyone; the finder sees them under the "Знахідки" tab.
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
    if (player) setSelectedId(t.id);
  }, [player]);

  const selected: Treasure | null = treasures.find((t) => t.id === selectedId) ?? null;
  const foundCount = treasures.filter((t) => t.is_found).length;
  const allFound = treasures.length > 0 && foundCount === treasures.length;
  const showSheet = tab === 'map' && selected !== null && player !== null;

  const gate = inApp?.inApp === true && !inAppOk;
  if (gate) return <InAppGate info={inApp} url={window.location.href} onContinue={() => setInAppOk(true)} />;
  if (!ready) return <main className="p-6 text-[17px] text-[var(--muted)]">Завантаження…</main>;
  if (failed) return <main className="p-6 text-[17px] font-semibold text-[var(--danger)]">{failed}</main>;

  const nameRecord = Object.fromEntries([...names.current].map(([id, v]) => [id, v.nickname]));
  const routeView: RouteView | null = route
    ? {
        coords: route.walk.coords,
        stops: route.stops.map((t, i) => ({ id: t.id, lat: t.lat, lng: t.lng, index: i + 1 })),
      }
    : null;
  const gpsOk = geo.status === 'ok';

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
        bottomInset={tabBarH + 12}
        route={routeView}
        focusId={focus.id}
        focusNonce={focus.nonce}
        recenterNonce={recenter}
      />

      {tab !== 'map' && player && (
        <div className="absolute inset-0 z-20 overflow-y-auto bg-[var(--page)]">
          {tab === 'finds' ? (
            <FindsTab
              treasures={treasures}
              myId={player.user_id}
              names={nameRecord}
              distances={distances}
              gpsReady={gpsOk}
              onShow={showOnMap}
              onRoute={(ids) => void planRoute(ids, treasures)}
              onChanged={() => { void reload(); }}
            />
          ) : (
            <ProfileTab player={player} onSaved={setPlayer} />
          )}
        </div>
      )}

      {tab === 'map' && (
        <div className="absolute inset-x-0 top-0 z-10 flex flex-col items-start gap-2 p-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
          {!gpsOk && (
            <span className="dl-tag px-3 py-1.5 text-[13px]">
              {geo.status === 'denied' ? 'GPS вимкнено · увімкніть геолокацію' : 'GPS: шукаю сигнал…'}
            </span>
          )}
          {compass.status === 'needs-permission' && (
            <button type="button" onClick={() => void compass.requestPermission()} className="dl-tag px-4 py-2 text-[15px]">
              Увімкнути компас
            </button>
          )}
          {allFound && <p className="dl-card px-4 py-3 text-[15px] font-bold">Усі скарби знайдено</p>}
          {error && <p className="dl-card px-4 py-3 text-[15px] font-semibold text-[var(--danger)]">{error}</p>}
          {toasts.map((t) => (
            <p key={t.id} role="status" className="rounded-2xl bg-[var(--green)] px-4 py-3 text-[15px] font-bold text-white shadow-[0_4px_0_var(--green-deep)]">
              {t.text}
            </p>
          ))}
        </div>
      )}

      {tab === 'map' && (
        <button
          type="button"
          aria-label="Показати моє місцеположення"
          onClick={() => {
            if (!geo.pos) pushToast('Немає GPS: увімкніть геолокацію');
            else setRecenter((n) => n + 1);
          }}
          style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
          className="dl-card absolute right-3 z-10 grid h-12 w-12 place-items-center rounded-full"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--green-deep)" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="3.5" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      )}

      {tab === 'map' && route && (
        <div style={{ bottom: `calc(${tabBarH}px + 12px)` }} className="dl-card absolute inset-x-3 z-10 flex flex-col gap-2 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Маршрут · {route.stops.length} {route.stops.length === 1 ? 'точка' : 'точок'}
              </p>
              <p className="text-[17px] font-extrabold tabular-nums">
                {route.pending ? 'Прокладаю…' : `${formatDistance(route.walk.distanceM)} · ~${Math.max(1, Math.round(route.walk.durationS / 60))} хв`}
              </p>
              <p className="text-[12px] font-semibold text-[var(--muted)]">
                {route.walk.source === 'paths' ? 'По стежках і дорогах' : 'По прямій (маршрут стежками недоступний)'}
              </p>
            </div>
            <button type="button" onClick={() => setRoute(null)} className="dl-btn-secondary !w-auto !px-4 !py-2 !text-[15px]">
              Закрити
            </button>
          </div>
          <ol className="flex flex-wrap gap-2 text-[13px] font-semibold">
            {route.stops.map((t, i) => (
              <li key={t.id}>
                <button type="button" onClick={() => showOnMap(t.id)} className="dl-tag px-2.5 py-1">{i + 1}. {t.title}</button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {tab === 'map' && player && nearby && !showSheet && !route && (
        <button
          type="button"
          onClick={() => setSelectedId(nearby.treasure.id)}
          style={{ bottom: `calc(${tabBarH}px + 12px)` }}
          className="dl-card absolute inset-x-3 z-10 flex min-h-[64px] items-center gap-3 px-4 py-3 text-left"
        >
          <span className="dl-pin-badge !h-12 !w-12 shrink-0">{pinOrDefault(nearby.treasure.pin_emoji)}</span>
          <span className="min-w-0">
            <span className="block text-[12px] font-bold uppercase tracking-wider text-[var(--muted)]">Скарб поруч (до {NEARBY_M} м)</span>
            <span className="block truncate text-[17px] font-bold">{nearby.treasure.title} · {Math.round(nearby.distanceM)} м</span>
          </span>
        </button>
      )}

      {showSheet && (
        <BottomSheet key={selected.id} initial="half" bottomOffset={tabBarH}>
          <div className="flex justify-end px-4 pt-1">
            <button type="button" aria-label="Закрити" onClick={() => setSelectedId(null)} className="grid h-11 w-11 place-items-center rounded-full text-2xl text-[var(--muted)]">×</button>
          </div>
          <TreasureSheetContent
            treasure={selected}
            pos={geo.pos}
            accuracy={geo.accuracy}
            distanceM={distances[selected.id] ?? null}
            heading={myHeading}
            onRoute={() => void planRoute([selected.id], treasures)}
            onResult={(status) => {
              void reload();
              if (status === 'won') {
                setSelectedId(null);
                pushToast('Знахідку підтверджено! Скарб знято з карти.');
              }
            }}
          />
        </BottomSheet>
      )}

      {player && <TabBar tab={tab} onChange={(t) => { setTab(t); setSelectedId(null); }} onHeight={setTabBarH} />}

      {welcomed === false && (
        <Welcome
          compassStatus={compass.status}
          onCompass={compass.requestPermission}
          onDone={() => {
            markWelcomed(window.localStorage);
            setWelcomed(true);
          }}
        />
      )}

      {ready && userId && !player && welcomed === true && <Onboarding userId={userId} onSaved={setPlayer} />}
    </main>
  );
}
