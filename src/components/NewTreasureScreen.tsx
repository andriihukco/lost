'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TreasureForm from '@/components/TreasureForm';
import { joinRoom } from '@/lib/rooms';
import { ensureSession } from '@/lib/session';

// Only the host may add treasures; RLS enforces it too (migration 0001).
export default function NewTreasureScreen({ code }: { code: string }) {
  const router = useRouter();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { userId } = await ensureSession();
        const room = await joinRoom(code);
        if (cancelled) return;
        if (!room || room.host_id !== userId) return router.replace(`/r/${code}/map`);
        setRoomId(room.id);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [code, router]);

  if (failed) return <main className="p-6">Не вдалося відкрити форму</main>;
  if (!roomId) return <main className="p-6 text-neutral-500">Завантаження…</main>;
  return <main className="min-h-dvh"><TreasureForm roomId={roomId} code={code} /></main>;
}
