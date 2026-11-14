'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createRoom } from '@/lib/rooms';

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom(name);
      router.push(`/r/${room.code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col gap-5 p-6">
      <h1 className="pt-10 text-4xl font-bold tracking-tight">Lost</h1>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Назва гри"
        maxLength={60}
        className="rounded-xl bg-white/80 px-4 py-3 text-[16px] outline-none ring-1 ring-black/10"
      />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={onCreate}
        disabled={busy}
        className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-40"
      >
        {busy ? 'Створюємо…' : 'Нова гра'}
      </button>
    </main>
  );
}
