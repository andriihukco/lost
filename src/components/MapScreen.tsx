'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MapView from '@/components/MapView';
import { ensureSession } from '@/lib/session';
import { joinRoom, type Room } from '@/lib/rooms';
import { supabase } from '@/lib/supabase';
import { useGeolocation } from '@/lib/useGeolocation';
import { useTreasures } from '@/lib/useTreasures';

export default function MapScreen({ code }: { code: string }) {
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [failed, setFailed] = useState(false);
  const geo = useGeolocation();
  const { treasures, error } = useTreasures(room?.id ?? null);

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
          .select('id')
          .eq('room_id', found.id)
          .eq('user_id', userId)
          .maybeSingle();
        if (cancelled) return;
        if (!data) return router.replace(`/r/${code}`);
        setRoom(found);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [code, router]);

  if (failed) return <main className="p-6">Кімнату не знайдено</main>;

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView treasures={treasures} me={geo.pos} />
      <div className="absolute inset-x-0 top-0 p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-sm">
        <div className="rounded-2xl bg-white/80 px-4 py-2 font-medium shadow backdrop-blur">
          {room?.name ?? 'Гра'} · GPS: {geo.status === 'ok' ? 'точно' : geo.status === 'denied' ? 'вимкнено' : 'пошук'}
          {error && <span className="ml-2 text-red-600">{error}</span>}
        </div>
      </div>
    </main>
  );
}
