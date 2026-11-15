'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { getPlayer, type Player } from '@/lib/player';
import { CLAIM_MESSAGE, claimTransferCode, createTransferCode } from '@/lib/transfer';
import { isTransferCode, TRANSFER_CODE_LENGTH, TRANSFER_MINUTES } from '@/lib/transferCode';

// Six boxes, one digit each. Used for the code shown in Profile and for the code typed in onboarding.
function CodeCells({ value, active = false }: { value: string; active?: boolean }) {
  return (
    <div aria-hidden className="flex justify-center gap-2">
      {Array.from({ length: TRANSFER_CODE_LENGTH }, (_, i) => {
        const digit = value[i] ?? '';
        const current = active && i === value.length && value.length < TRANSFER_CODE_LENGTH;
        return (
          <span
            key={i}
            className={`grid h-14 w-11 place-items-center rounded-2xl border-2 bg-[var(--paper)] text-[26px] font-extrabold tabular-nums transition-colors ${
              digit ? 'border-[var(--green)] text-[var(--ink)]' : current ? 'border-[var(--green)] elev-sm' : 'border-[var(--line)] text-[var(--muted)]'
            }`}
          >
            {digit}
          </span>
        );
      })}
    </div>
  );
}

function formatLeft(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Profile: make a code to enter in another browser. The code shows in boxes, counts down, and can be copied.
export function TransferCodeMaker() {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // The countdown only runs while a code is shown.
  useEffect(() => {
    if (!code) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [code]);

  const left = expiresAt - now;
  const expired = code !== null && left <= 0;

  async function make() {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const r = await createTransferCode();
      if ('code' in r) {
        setCode(r.code);
        setExpiresAt(Date.now() + r.expiresInS * 1000);
        setNow(Date.now());
      } else {
        setError('Спочатку створіть профіль.');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Не вдалося скопіювати. Перепишіть код вручну.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14px] leading-snug text-[var(--muted)]">
        Щоб грати з іншого телефону чи браузера, створіть код тут і введіть його там. Код одноразовий.
      </p>

      {code && !expired ? (
        <div className="flex flex-col gap-4 rounded-2xl bg-[var(--page)] p-4">
          <CodeCells value={code} />
          <p role="status" aria-live="polite" className="text-center text-[14px] font-semibold text-[var(--muted)]">
            Дійсний ще {formatLeft(left)}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void copy()} className="dl-btn-secondary !w-full">
              <span className="inline-flex items-center justify-center gap-2">
                <Icon name={copied ? 'check' : 'edit'} size={18} />
                {copied ? 'Скопійовано' : 'Копіювати код'}
              </span>
            </button>
            <button type="button" disabled={busy} onClick={() => void make()} className="dl-btn-secondary !w-full">
              Новий код
            </button>
          </div>
        </div>
      ) : (
        <>
          {expired && (
            <p role="status" className="text-[14px] font-semibold text-[var(--muted)]">
              Код минув. Створіть новий, щоб перенести профіль.
            </p>
          )}
          <button type="button" disabled={busy} onClick={() => void make()} className="dl-btn">
            {busy ? 'Створюємо…' : 'Отримати код'}
          </button>
        </>
      )}

      {error && <p role="alert" className="text-[14px] font-semibold text-[var(--danger)]">{error}</p>}
      <p className="text-[13px] text-[var(--muted)]">Код діє {TRANSFER_MINUTES} хвилин після створення.</p>
    </div>
  );
}

// Onboarding (a new browser): "I already have a profile". The code is typed or pasted into the boxes and
// moves the profile as soon as all six digits are in.
export function TransferCodeEntry({ userId, onMoved }: { userId: string; onMoved: (p: Player) => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  async function move(value: string) {
    setBusy(true);
    setError(null);
    try {
      const status = await claimTransferCode(value);
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

  // Six digits in: move the profile at once, as one-time-code fields do.
  function onChange(raw: string) {
    const next = raw.replace(/\D/g, '').slice(0, TRANSFER_CODE_LENGTH);
    setCode(next);
    setError(null);
    if (isTransferCode(next) && !busy) void move(next);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-[44px] text-center text-[15px] font-bold text-[var(--green-deep)]">
        У мене вже є профіль · ввести код
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[24px] bg-[var(--paper)] p-4 elev-sm">
      <p className="dl-label">Код з попереднього браузера</p>
      {/* The boxes show the digits; the real field sits over them, so typing, paste and the one-time-code
          keyboard suggestion all work, and a tap on the boxes opens the keyboard. */}
      <div className="relative">
        <CodeCells value={code} active />
        <input
          ref={input}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={`Код з ${TRANSFER_CODE_LENGTH} цифр`}
          disabled={busy}
          className="absolute inset-0 h-full w-full cursor-text opacity-0"
          style={{ fontSize: 16 }}
        />
      </div>
      {busy && <p role="status" className="text-center text-[14px] font-semibold text-[var(--muted)]">Переносимо профіль…</p>}
      {error && <p role="alert" className="text-center text-[14px] font-semibold text-[var(--danger)]">{error}</p>}
      <p className="text-center text-[13px] text-[var(--muted)]">Код з {TRANSFER_CODE_LENGTH} цифр. Можна вставити з буфера.</p>
    </div>
  );
}
