'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import BackButton from '@/components/BackButton';
import Splash from '@/components/Splash';
import TreasureForm from '@/components/TreasureForm';
import { checkIsAdmin } from '@/lib/player';
import { supabase } from '@/lib/supabase';

// The add-treasure screen, separate from the list. Only admins get in; anyone else goes back to the admin sign-in.
export default function NewTreasureScreen() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const admin = data.session !== null && (await checkIsAdmin());
      if (!admin) router.replace('/admin');
      setAllowed(admin);
    })();
  }, [router]);

  if (allowed === null) return <Splash label="Перевіряємо доступ" />;
  if (!allowed) return null;

  return (
    <main className="min-h-dvh bg-[var(--page)]">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-[var(--page)]/90 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur-md">
        <BackButton href="/admin" label="Назад до карти" />
        <h1 className="dl-title text-xl">Новий скарб</h1>
      </header>
      <TreasureForm onCreated={() => router.replace('/admin')} />
    </main>
  );
}
