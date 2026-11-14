import { Suspense } from 'react';
import JoinRoom from '@/components/JoinRoom';

export default function RoomPage() {
  return (
    <Suspense fallback={<main className="p-6 text-neutral-500">Завантаження…</main>}>
      <JoinRoom />
    </Suspense>
  );
}
