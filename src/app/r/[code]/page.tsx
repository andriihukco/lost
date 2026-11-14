import { Suspense } from 'react';
import JoinRoom from '@/components/JoinRoom';

// Room codes are only known per request, so the param read sits behind Suspense (Cache Components).
export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<main className="p-6 text-neutral-500">Завантаження…</main>}>
      <RoomByCode params={params} />
    </Suspense>
  );
}

async function RoomByCode({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JoinRoom code={code} />;
}
