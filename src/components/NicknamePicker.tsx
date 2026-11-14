'use client';

import { AVATARS, isTaken, type AvatarKey } from '@/lib/avatars';

// Choose a nickname: each card is an animal with its predefined nickname. Animals another player has are greyed out.
export default function NicknamePicker({ value, taken, onPick }: { value: AvatarKey | null; taken: string[]; onPick: (key: AvatarKey) => void }) {
  return (
    <div role="radiogroup" aria-label="Оберіть нік" className="grid grid-cols-2 gap-3">
      {AVATARS.map((a) => {
        const gone = isTaken(a.key, taken, null);
        const selected = value === a.key;
        return (
          <button
            key={a.key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={gone ? `${a.nickname}, уже обрано` : a.nickname}
            disabled={gone}
            onClick={() => onPick(a.key)}
            className={`flex min-h-[64px] items-center gap-3 rounded-full border-2 px-3 py-2.5 text-left transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale ${
              selected
                ? 'border-[var(--green)] bg-[var(--green-soft)] elev-sm'
                : 'border-[var(--line)] bg-[var(--paper)] elev-sm'
            }`}
          >
            <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--page)] text-2xl">{a.emoji}</span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold leading-tight">{a.nickname}</span>
              <span className="block text-[12px] font-semibold text-[var(--muted)]">{gone ? 'Зайнято' : 'Вільно'}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
