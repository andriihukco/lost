import { Suspense } from 'react';
import MapScreen from '@/components/MapScreen';

export default function MapPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<main className="p-6 text-neutral-500">Завантаження…</main>}>
      <ByCode params={params} />
    </Suspense>
  );
}

async function ByCode({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <MapScreen code={code} />;
}
