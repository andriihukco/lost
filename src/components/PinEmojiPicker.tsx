'use client';

import { PIN_PRESETS } from '@/lib/pinEmoji';

// The emoji shown on this treasure's map pin: a few presets, or any emoji typed in.
export default function PinEmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm text-[var(--muted)]">Емодзі на мапі</legend>
      <div className="grid grid-cols-7 gap-1.5">
        {PIN_PRESETS.map((e) => (
          <button
            key={e}
            type="button"
            aria-label={`Мітка ${e}`}
            aria-pressed={value === e}
            onClick={() => onChange(e)}
            className={`grid aspect-square min-h-[40px] place-items-center rounded-xl text-xl ${value === e ? 'bg-[var(--green-soft)] ring-2 ring-[var(--green)]' : 'bg-[var(--paper)] ring-1 ring-[var(--line)]'}`}
          >
            {e}
          </button>
        ))}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={8}
        placeholder="Свій емодзі"
        className="dl-field"
      />
    </fieldset>
  );
}
