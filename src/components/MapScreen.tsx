'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import MapView, { type OtherPlayer } from '@/components/MapView';
import { ensureSession } from '@/lib/session';
import { joinRoom, type Room } from '@/lib/rooms';
import { openRoomConnection, type PresenceUser, type RoomConnection } from '@/lib/realtime';
import { shouldSend } from '@/lib/sendPolicy';
import { supabase } from '@/lib/supabase';
import { useGeolocation } from '@/lib/useGeolocation';
import { useWakeLock } from '@/lib/useWakeLock';
import StatusBar from '@/components/StatusBar';
import TreasureSheetContent from '@/components/TreasureSheetContent';
import BottomSheet from '@/components/BottomSheet';
import type { Treasure } from '@/lib/useTreasures';
import { useTreasures } from '@/lib/useTreasures';
import type { LatLng } from '@/lib/geo';

type Me = { userId: string; nickname: string; color: string };
type Position = LatLng & { seenAt: number };

export default function MapScreen() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState(false);
  const [online, setOnline] = useState(false);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const geo = useGeolocation();
  const wake = useWakeLock();
  const { treasures, error, reload } = useTreasures(room?.id ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const connRef = useRef<RoomConnection | null>(null);
  const names = useRef(new Map<string, PresenceUser>()); // keeps a name after its presence leaves
  const lastSent = useRef<{ pos: LatLng | null; at: number }>({ pos: null, at: -Infinity });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { userId } = await ensureSession();
        const found = await joinRoom(code);
        if (cancelled) return;
        if (!found) return setFailed(true);
        const { data } = await supabase
          .from('participants')
          .select('nickname, color')
          .eq('room_id', found.id)
          .eq('user_id', userId)
          .maybeSingle();
        if (cancelled) return;
        if (!data) return router.replace(`/r/${code}`);
        setRoom(found);
        setMe({ userId, nickname: data.nickname, color: data.color });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [code, router]);

  // Realtime: open once the room and identity are known.
  useEffect(() => {
    if (!room || !me) return;
    const conn = openRoomConnection({
      code: room.code,
      roomId: room.id,
      me: { user_id: me.userId, nickname: me.nickname, color: me.color },
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
  }, [room, me, reload]);

  // Broadcast own position, throttled (spec §3: once per 2–3 s, only after moving more than 2 m).
  useEffect(() => {
    const conn = connRef.current;
    if (!conn || !geo.pos) return;
    const now = Date.now();
    if (shouldSend(lastSent.current.pos, geo.pos, lastSent.current.at, now)) {
      conn.sendPosition(geo.pos, geo.accuracy);
      lastSent.current = { pos: geo.pos, at: now };
    }
  }, [geo.pos, geo.accuracy, room, me]);

  const others: OtherPlayer[] = useMemo(() => {
    return Object.entries(positions)
      .filter(([id]) => id !== me?.userId)
      .map(([id, p]) => ({
        id,
        nickname: names.current.get(id)?.nickname ?? 'Гравець',
        color: names.current.get(id)?.color ?? '#8e8e93',
        lat: p.lat,
        lng: p.lng,
        seenAt: p.seenAt,
      }));
  }, [positions, presence, me]); // presence triggers a re-read of the name cache

  const selected: Treasure | null = treasures.find((t) => t.id === selectedId) ?? null;

  if (failed) return <main className="p-6">Кімнату не знайдено</main>;

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView treasures={treasures} me={geo.pos} others={others} onSelectTreasure={(t) => setSelectedId(t.id)} />
      {selected && (
        <BottomSheet key={selected.id} initial="half">
          <div className="flex justify-end px-3">
            <button type="button" aria-label="Закрити" onClick={() => setSelectedId(null)} className="px-3 text-xl text-neutral-500">×</button>
          </div>
          <TreasureSheetContent
            treasure={selected}
            pos={geo.pos}
            accuracy={geo.accuracy}
            onResult={() => void reload()}
          />
        </BottomSheet>
      )}
      {!selected && room && me && room.host_id === me.userId && (
        <Link
          href={`/r/${code}/treasures/new`}
          className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] rounded-2xl bg-blue-600 px-4 py-3 text-center font-semibold text-white shadow"
        >
          + Додати скарб
        </Link>
      )}
      <div className="absolute inset-x-0 top-0 p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <StatusBar
          roomName={room?.name ?? 'Гра'}
          foundCount={treasures.filter((t) => t.is_found).length}
          total={treasures.length}
          gps={geo.status}
          accuracy={geo.accuracy}
          wakeActive={wake.active}
          wakeSupported={wake.supported}
          online={online || !room}
        />
        {error && <p className="mt-2 rounded-xl bg-white/80 px-3 py-1 text-sm text-red-600">{error}</p>}
      </div>
    </main>
  );
}
