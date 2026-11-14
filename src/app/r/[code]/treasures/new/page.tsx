import { Suspense } from 'react';
import NewTreasureScreen from '@/components/NewTreasureScreen';

export default function NewTreasurePage() {
  return (
    <Suspense fallback={<main className="p-6 text-neutral-500">Завантаження…</main>}>
      <NewTreasureScreen />
    </Suspense>
  );
}
