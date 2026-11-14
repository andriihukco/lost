import { beforeEach, expect, test, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  signInAnonymously: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }));

import { ensureSession } from '@/lib/session';

beforeEach(() => {
  for (const fn of Object.values(auth)) fn.mockReset();
});

test('keeps a valid stored session', async () => {
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
  auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  expect(await ensureSession()).toEqual({ userId: 'u1' });
  expect(auth.signInAnonymously).not.toHaveBeenCalled();
});

test('drops a stale session (user no longer exists) and signs in again', async () => {
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'old' } } }, error: null });
  auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'User from sub claim does not exist', status: 403 } });
  auth.signOut.mockResolvedValue({ error: null });
  auth.signInAnonymously.mockResolvedValue({ data: { user: { id: 'new' } }, error: null });
  expect(await ensureSession()).toEqual({ userId: 'new' });
  expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
});

test('signs in when there is no session', async () => {
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  auth.signInAnonymously.mockResolvedValue({ data: { user: { id: 'fresh' } }, error: null });
  expect(await ensureSession()).toEqual({ userId: 'fresh' });
});

test('reports a clear error when anonymous sign-in fails', async () => {
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  auth.signInAnonymously.mockResolvedValue({ data: { user: null }, error: { message: 'rate limit' } });
  await expect(ensureSession()).rejects.toThrow('Не вдалося створити сесію');
});

test('a failed check with no server answer (offline) keeps the identity', async () => {
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'old' } } }, error: null });
  auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Failed to fetch' } });
  auth.signOut.mockClear();
  expect(await ensureSession()).toEqual({ userId: 'old' });
  expect(auth.signOut).not.toHaveBeenCalled();
});
