import { Suspense } from 'react';
import MapScreen from '@/components/MapScreen';

export default function MapPage() {
  return (
    <Suspense fallback={<main className="p-6 text-neutral-500">Завантаження…</main>}>
      <MapScreen />
    </Suspense>
  );
}
