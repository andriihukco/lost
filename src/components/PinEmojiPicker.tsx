'use client';

import { DEFAULT_PIN } from '@/lib/pinEmoji';

// The emoji on this treasure's map pin. Free input: the admin types or pastes any emoji (1 to 8 characters).
export default function PinEmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-[3px] border-[var(--green)] bg-[var(--paper)] text-2xl elev-sm">
        {value.trim() || DEFAULT_PIN}
      </span>
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm text-[var(--muted)]">Емодзі на мапі</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={8}
          placeholder={DEFAULT_PIN}
          className="dl-field text-2xl"
        />
      </label>
    </div>
  );
}
