'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import MarkForm from '@/components/MarkForm';
import Splash from '@/components/Splash';
import { checkIsAdmin } from '@/lib/player';
import { supabase } from '@/lib/supabase';

// The add-map-mark screen. Only admins get in; anyone else goes back to the admin sign-in.
export default function NewMarkScreen() {
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
        <Link href="/admin" aria-label="Назад до адмінки" className="grid h-11 w-11 place-items-center rounded-full bg-[var(--paper)] text-[var(--ink)] elev-sm">
          <Icon name="arrow_back" size={22} />
        </Link>
        <h1 className="dl-title text-xl">Нова мітка</h1>
      </header>
      <MarkForm onCreated={() => router.replace('/admin?s=marks')} />
    </main>
  );
}
