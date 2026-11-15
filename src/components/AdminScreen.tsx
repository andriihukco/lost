'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminMapPage from '@/components/AdminMapPage';
import BackButton from '@/components/BackButton';
import PlayersPanel from '@/components/PlayersPanel';
import PillTabBar from '@/components/PillTabBar';
import Icon from '@/components/Icon';
import Splash from '@/components/Splash';
import { checkIsAdmin } from '@/lib/player';
import { supabase } from '@/lib/supabase';

type View = 'loading' | 'login' | 'admin';
type Section = 'map' | 'players';

// Admins sign in with email and password (account created in the dashboard). Only admins see the form;
// RLS enforces the same rule on the server (migration 0003).
// After sign-in the admin works on one page: the map, with treasures and marks on it. Players have their own tab.
export default function AdminScreen() {
  const [view, setView] = useState<View>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('map');
  // A link like /admin?s=players opens the players tab. Old links (?s=treasures, ?s=marks) open the map.
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('s');
    if (s === 'players') setSection('players');
  }, []);

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

  if (section === 'map') {
    return <AdminMapPage onSignOut={() => void signOut()} onSection={setSection} />;
  }

  return (
    <main className="min-h-dvh bg-[var(--page)] pb-28">
      <header className="sticky top-0 z-20 bg-[var(--page)]/90 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <BackButton href="/" label="На карту" />
          <p className="text-[15px] font-bold">Адмін · Гравці</p>
          <button type="button" onClick={() => void signOut()} aria-label="Вийти" className="grid h-11 w-11 place-items-center rounded-full bg-[var(--paper)] text-[var(--muted)] elev-sm">
            <Icon name="logout" size={22} />
          </button>
        </div>
      </header>
      <PlayersPanel />
      <PillTabBar
        navLabel="Розділи адмінки"
        position="fixed"
        items={[
          { id: 'map', label: 'Карта', icon: 'map' },
          { id: 'players', label: 'Гравці', icon: 'group' },
        ]}
        value={section}
        onChange={setSection}
      />
    </main>
  );
}
