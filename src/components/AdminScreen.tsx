'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import TreasureForm from '@/components/TreasureForm';
import TreasureManager from '@/components/TreasureManager';
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
  const [tab, setTab] = useState<'add' | 'manage'>('manage');

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

  if (view === 'loading') return <main className="p-6 text-[var(--muted)]">Завантаження…</main>;

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
        <Link href="/" className="text-sm text-[var(--green-deep)] font-bold">← На карту</Link>
      </main>
    );
  }

  return (
    <main className="min-h-dvh">
      <div className="flex items-center justify-between px-5 pt-6">
        <Link href="/" className="text-sm text-[var(--green-deep)] font-bold">← На карту</Link>
        <button type="button" onClick={() => void signOut()} className="text-sm text-[var(--muted)]">Вийти</button>
      </div>
      <div className="flex gap-2 px-5 pt-4">
        {(['manage', 'add'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === t ? 'bg-[var(--green)] text-white shadow-[0_4px_0_var(--green-deep)]' : 'dl-card text-[var(--ink)]'}`}
          >
            {t === 'manage' ? 'Скарби' : 'Додати скарб'}
          </button>
        ))}
      </div>
      {tab === 'add' ? <TreasureForm /> : <TreasureManager />}
    </main>
  );
}
