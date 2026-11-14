'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import TreasureManager from '@/components/TreasureManager';
import PlayersPanel from '@/components/PlayersPanel';
import AdminMap from '@/components/AdminMap';
import PillTabBar from '@/components/PillTabBar';
import Icon from '@/components/Icon';
import Splash from '@/components/Splash';
import { checkIsAdmin } from '@/lib/player';
import { supabase } from '@/lib/supabase';

type View = 'loading' | 'login' | 'admin';

// Admins sign in with email and password (account created in the dashboard). Only admins see the form;
// RLS enforces the same rule on the server (migration 0003).
export default function AdminScreen() {
  const [view, setView] = useState<View>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<'treasures' | 'players' | 'map'>('treasures');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return setView('login');
      setView((await checkIsAdmin()) ? 'admin' : 'login');
    })();
  }, []);

  async function signIn() {
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setError('Невірний email або пароль');
      setBusy(false);
      return;
    }
    if (!(await checkIsAdmin())) {
      await supabase.auth.signOut();
      setError('Цей акаунт не має доступу адміністратора');
      setBusy(false);
      return;
    }
    setView('admin');
    setBusy(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setPassword('');
    setView('login');
  }

  if (view === 'loading') return <Splash label="Перевіряємо доступ" />;

  if (view === 'login') {
    return (
      <main className="flex min-h-dvh flex-col gap-4 p-6">
        <h1 className="pt-8 text-2xl font-bold tracking-tight">Вхід адміністратора</h1>
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void signIn(); }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="username"
            className="dl-field"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            autoComplete="current-password"
            className="dl-field"
          />
          {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
          <button
            type="submit"
            disabled={busy || !email.trim() || !password}
            className="dl-btn"
          >
            {busy ? 'Входимо…' : 'Увійти'}
          </button>
        </form>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-[var(--green-deep)] font-bold"><Icon name="arrow_back" size={18} />На карту</Link>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[var(--page)] pb-28">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-[var(--page)]/90 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur-md">
        <Link href="/" aria-label="На карту" className="grid h-11 w-11 place-items-center rounded-full bg-[var(--paper)] text-[var(--ink)] elev-sm">
          <Icon name="arrow_back" size={22} />
        </Link>
        <p className="text-[15px] font-bold">Адмін</p>
        <button type="button" onClick={() => void signOut()} aria-label="Вийти" className="grid h-11 w-11 place-items-center rounded-full bg-[var(--paper)] text-[var(--muted)] elev-sm">
          <Icon name="logout" size={22} />
        </button>
      </header>
      {section === 'treasures' && <TreasureManager />}
      {section === 'players' && <PlayersPanel />}
      {section === 'map' && <AdminMap />}
      <PillTabBar
        navLabel="Розділи адмінки"
        position="fixed"
        items={[
          { id: 'treasures', label: 'Скарби', icon: 'travel_explore' },
          { id: 'players', label: 'Гравці', icon: 'group' },
          { id: 'map', label: 'Карта', icon: 'map' },
        ]}
        value={section}
        onChange={setSection}
      />
    </main>
  );
}
