'use client';

import { useState } from 'react';
import { getPlayer, type Player } from '@/lib/player';
import { CLAIM_MESSAGE, claimTransferCode, createTransferCode } from '@/lib/transfer';
import { isTransferCode, TRANSFER_CODE_LENGTH, TRANSFER_MINUTES } from '@/lib/transferCode';

// Profile: make a code, to enter in another browser.
export function TransferCodeMaker() {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const r = await createTransferCode();
      if ('code' in r) setCode(r.code);
      else setError('Спочатку створіть профіль.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] leading-snug text-[var(--muted)]">
        Щоб грати з іншого телефону чи браузера, створіть код тут і введіть його там. Код одноразовий і діє {TRANSFER_MINUTES} хвилин.
      </p>
      {code && (
        <div className="flex flex-col items-center gap-1 rounded-2xl bg-[var(--page)] py-4">
          <p aria-label={`Код: ${code.split('').join(' ')}`} className="text-[32px] font-extrabold tabular-nums tracking-[0.2em]">{code}</p>
          <p className="text-[13px] font-semibold text-[var(--muted)]">Введіть його в новому браузері протягом {TRANSFER_MINUTES} хвилин.</p>
        </div>
      )}
      {error && <p role="alert" className="text-[14px] font-semibold text-[var(--danger)]">{error}</p>}
      <button type="button" disabled={busy} onClick={() => void make()} className="dl-btn-secondary">
        {busy ? 'Створюємо…' : code ? 'Створити новий код' : 'Отримати код'}
      </button>
    </div>
  );
}

// Onboarding (a new browser): "I already have a profile" — enter the code from the old browser.
export function TransferCodeEntry({ userId, onMoved }: { userId: string; onMoved: (p: Player) => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function move() {
    setBusy(true);
    setError(null);
    try {
      const status = await claimTransferCode(code);
      if (status !== 'moved') {
        setError(CLAIM_MESSAGE[status]);
        return;
      }
      const p = await getPlayer(userId);
      if (!p) throw new Error('Профіль не знайдено. Створіть новий.');
      onMoved(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-[44px] text-center text-[15px] font-bold text-[var(--green-deep)]">
        У мене вже є профіль · ввести код
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-[24px] bg-[var(--paper)] p-4 elev-sm"
      onSubmit={(e) => { e.preventDefault(); if (isTransferCode(code)) void move(); }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="dl-label">Код з попереднього браузера</span>
        <input
          className="dl-field text-center text-[22px] font-bold tabular-nums tracking-[0.2em]"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, TRANSFER_CODE_LENGTH))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          aria-describedby="transfer-hint"
        />
      </label>
      <p id="transfer-hint" className="text-[13px] text-[var(--muted)]">Код з {TRANSFER_CODE_LENGTH} цифр, діє {TRANSFER_MINUTES} хвилин.</p>
      {error && <p role="alert" className="text-[14px] font-semibold text-[var(--danger)]">{error}</p>}
      <button type="submit" disabled={busy || !isTransferCode(code)} className="dl-btn">
        {busy ? 'Переносимо…' : 'Перенести профіль'}
      </button>
    </form>
  );
}
