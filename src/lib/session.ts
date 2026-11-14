import { supabase } from '@/lib/supabase';
import { shouldDropSession } from '@/lib/sessionRules';

// Returns the current identity, creating an anonymous one on first visit (spec §2.2).
// A stored session can outlive its user (database reset, cleanup): validate it with the server,
// drop it if it is stale, and sign in again.
export async function ensureSession(): Promise<{ userId: string }> {
  const { data: current, error: getError } = await supabase.auth.getSession();
  if (getError) throw new Error('Не вдалося перевірити сесію');

  if (current.session) {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) return { userId: data.user.id };
    // A failed check (offline, flaky signal) keeps the stored identity; only a refusal drops it.
    if (!shouldDropSession(error)) return { userId: current.session.user.id };
    await supabase.auth.signOut({ scope: 'local' });
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) throw new Error('Не вдалося створити сесію. Спробуйте ще раз.');
  return { userId: data.user.id };
}
