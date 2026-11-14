import { supabase } from '@/lib/supabase';
import { TRANSFER_MINUTES } from '@/lib/transferCode';

// Moving a profile to another browser: the old browser makes a one-time code, the new browser enters it.
// The server does the move (migration 0008); this file only talks to it.

export type CreatedCode = { code: string; expiresInS: number } | { status: 'not_player' };

export async function createTransferCode(): Promise<CreatedCode> {
  const { data, error } = await supabase.rpc('create_transfer_code');
  if (error || !data) throw new Error('Не вдалося створити код. Спробуйте ще раз.');
  const r = data as { status: string; code?: string; expires_in_s?: number };
  if (r.status === 'ok' && r.code) return { code: r.code, expiresInS: r.expires_in_s ?? TRANSFER_MINUTES * 60 };
  return { status: 'not_player' };
}

export type ClaimStatus = 'moved' | 'bad_code' | 'same_browser' | 'already_player' | 'too_many_attempts' | 'no_profile' | 'not_signed_in';

export async function claimTransferCode(code: string): Promise<ClaimStatus> {
  const { data, error } = await supabase.rpc('claim_transfer', { p_code: code.trim() });
  if (error || !data) throw new Error('Не вдалося перевірити код. Спробуйте ще раз.');
  return (data as { status: ClaimStatus }).status;
}

export const CLAIM_MESSAGE: Record<Exclude<ClaimStatus, 'moved'>, string> = {
  bad_code: 'Код невірний або вже минув. Перевірте й спробуйте ще раз.',
  same_browser: 'Цей код створено в цьому самому браузері. Введіть його в новому браузері.',
  already_player: 'У цьому браузері вже є гравець. Профіль можна перенести лише в порожній браузер.',
  too_many_attempts: 'Забагато спроб. Спробуйте через 10 хвилин.',
  no_profile: 'Профіль більше не існує. Створіть новий.',
  not_signed_in: 'Не вдалося зв’язатися з сервером. Спробуйте ще раз.',
};
