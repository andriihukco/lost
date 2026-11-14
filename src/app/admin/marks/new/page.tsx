import { Suspense } from 'react';
import NewMarkScreen from '@/components/NewMarkScreen';
import Splash from '@/components/Splash';

// /admin/marks/new adds a mark; /admin/marks/new?id=… edits one.
export default function NewMarkPage() {
  return (
    <Suspense fallback={<Splash label="Завантаження" />}>
      <NewMarkScreen />
    </Suspense>
  );
}
