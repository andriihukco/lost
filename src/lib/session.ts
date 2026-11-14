import { supabase } from '@/lib/supabase';

// Returns the current anonymous user, creating one on first visit (spec §2.2).
export async function ensureSession(): Promise<{ userId: string }> {
  const { data: current, error: getError } = await supabase.auth.getSession();
  if (getError) throw new Error('Не вдалося перевірити сесію');

  let user = current.session?.user;
  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) throw new Error('Не вдалося створити сесію. Спробуйте ще раз.');
    user = data.user;
  }
  return { userId: user.id };
}
