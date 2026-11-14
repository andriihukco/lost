'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import JoinForm from '@/components/JoinForm';
import { ensureSession } from '@/lib/session';
import { joinRoom, type Room } from '@/lib/rooms';
import { supabase } from '@/lib/supabase';

const NICK_KEY = 'lost.nickname'; // convenience only (spec §2.2)

type State =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string }
  | { kind: 'form'; room: Room; userId: string; submitting: boolean; error: string | null };

export default function JoinRoom({ code }: { code: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { userId } = await ensureSession();
        const room = await joinRoom(code);
        if (cancelled) return;
        if (!room) return setState({ kind: 'not_found' });

        const { data: existing, error } = await supabase
          .from('participants')
          .select('id')
          .eq('room_id', room.id)
          .eq('user_id', userId)
          .maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        if (existing) return router.replace(`/r/${room.code}/map`);

        setState({ kind: 'form', room, userId, submitting: false, error: null });
      } catch (e) {
        if (!cancelled) setState({ kind: 'error', message: (e as Error).message });
      }
    })();
    return () => { cancelled = true; };
  }, [code, router]);

  if (state.kind === 'loading') {
    return <main className="p-6 text-neutral-500">Завантаження…</main>;
  }
  if (state.kind === 'not_found') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-semibold">Кімнату не знайдено</p>
        <a href="/" className="text-blue-600">На головну</a>
      </main>
    );
  }
  if (state.kind === 'error') {
    return <main className="p-6 text-red-600">{state.message}</main>;
  }

  const { room, userId, submitting, error } = state;
  const initialNickname = typeof window === 'undefined' ? '' : localStorage.getItem(NICK_KEY) ?? '';

  async function submit(nickname: string, color: string) {
    setState({ kind: 'form', room, userId, submitting: true, error: null });
    try {
      const { error: insertError } = await supabase.from('participants').insert({
        room_id: room.id,
        user_id: userId,
        nickname,
        color,
      });
      if (insertError) throw insertError;
      try { localStorage.setItem(NICK_KEY, nickname); } catch { /* storage may be blocked */ }
      router.replace(`/r/${room.code}/map`);
    } catch {
      setState({ kind: 'form', room, userId, submitting: false, error: 'Не вдалося приєднатися. Спробуйте ще раз.' });
    }
  }

  return (
    <main className="min-h-dvh">
      <h1 className="px-6 pt-10 text-3xl font-bold tracking-tight">{room.name ?? 'Нова гра'}</h1>
      <JoinForm initialNickname={initialNickname} submitting={submitting} error={error} onSubmit={submit} />
    </main>
  );
}
