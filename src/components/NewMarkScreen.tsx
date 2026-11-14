'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import MarkForm from '@/components/MarkForm';
import Splash from '@/components/Splash';
import { listMapMarks, type MapMark } from '@/lib/mapMarks';
import { checkIsAdmin } from '@/lib/player';
import { supabase } from '@/lib/supabase';

// The map-mark screen: a new mark, or editing one when the link has ?id=… Only admins get in.
export default function NewMarkScreen() {
  const router = useRouter();
  const editId = useSearchParams().get('id');
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [initial, setInitial] = useState<MapMark | null | undefined>(editId ? undefined : null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const admin = data.session !== null && (await checkIsAdmin());
      if (!admin) router.replace('/admin');
      setAllowed(admin);
    })();
  }, [router]);

  // Editing: load the mark. A mark that is gone (deleted elsewhere) is reported, not shown empty.
  useEffect(() => {
    if (!editId || allowed !== true) return;
    listMapMarks()
      .then((marks) => {
        const found = marks.find((m) => m.id === editId) ?? null;
        if (!found) setLoadError('Мітку не знайдено. Можливо, її вже видалено.');
        setInitial(found);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [editId, allowed]);

  if (allowed === null || (allowed && initial === undefined && !loadError)) return <Splash label="Перевіряємо доступ" />;
  if (!allowed) return null;

  const editing = Boolean(editId);
  return (
    <main className="min-h-dvh bg-[var(--page)]">
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-[var(--page)]/90 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur-md">
        <Link href="/admin?s=marks" aria-label="Назад до міток" className="grid h-11 w-11 place-items-center rounded-full bg-[var(--paper)] text-[var(--ink)] elev-sm">
          <Icon name="arrow_back" size={22} />
        </Link>
        <h1 className="dl-title text-xl">{editing ? 'Редагувати мітку' : 'Нова мітка'}</h1>
      </header>
      {loadError && <p role="alert" className="mx-5 mt-4 text-sm font-semibold text-[var(--danger)]">{loadError}</p>}
      {(!editing || initial) && (
        <MarkForm key={initial?.id ?? 'new'} initial={initial} onSaved={() => router.replace('/admin?s=marks')} />
      )}
    </main>
  );
}
