'use client';

import { useEffect, useMemo, useState } from 'react';
import MapView, { type OtherPlayer } from '@/components/MapView';
import { listPlayers, type AdminPlayer } from '@/lib/adminPlayers';
import { listTreasures, type AdminTreasure } from '@/lib/adminTreasures';
import { listMapMarks, type MapMark } from '@/lib/mapMarks';
import type { LatLng } from '@/lib/geo';

const REFRESH_MS = 15000;

// The admin's own map: every player's last known position and every treasure still on the map.
// The camera fits everything once, then the admin is free to move around it.
export default function AdminMap() {
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [treasures, setTreasures] = useState<AdminTreasure[]>([]);
  const [fitTo, setFitTo] = useState<LatLng[] | undefined>(undefined);
  const [marks, setMarks] = useState<MapMark[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [p, t, m] = await Promise.all([listPlayers(), listTreasures(), listMapMarks().catch(() => [] as MapMark[])]);
        if (!alive) return;
        setPlayers(p);
        setTreasures(t);
        setMarks(m);
        const points: LatLng[] = [
          ...p.filter((x) => x.lat !== null && x.lng !== null).map((x) => ({ lat: x.lat as number, lng: x.lng as number })),
          ...t.map((x) => ({ lat: x.lat, lng: x.lng })),
        ];
        setFitTo((prev) => (prev && prev.length > 0) || points.length === 0 ? prev : points);
      } catch {
        // keep the last picture; the next refresh tries again
      }
    };
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const others: OtherPlayer[] = useMemo(
    () =>
      players
        .filter((p) => p.lat !== null && p.lng !== null)
        .map((p) => ({
          id: p.user_id,
          nickname: p.nickname,
          avatar: p.avatar,
          lat: p.lat as number,
          lng: p.lng as number,
          heading: null,
          seenAt: p.seen_at ? Date.parse(p.seen_at) : 0,
        })),
    [players],
  );
  const open = useMemo(() => treasures.filter((t) => !t.is_found), [treasures]);

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 pb-6">
      <p className="text-sm font-semibold text-[var(--muted)]">Гравців на мапі: {others.length} · скарбів на мапі: {open.length}</p>
      <div className="relative h-[calc(100dvh-14rem)] overflow-hidden rounded-[24px] border-2 border-[var(--line)]">
        <MapView
          treasures={open}
          distances={{}}
          me={null}
          meAvatar={null}
          meName={null}
          meHeading={null}
          others={others}
          bottomInset={24}
          marks={marks}
          unlimited
          fitTo={fitTo}
        />
      </div>
    </section>
  );
}
