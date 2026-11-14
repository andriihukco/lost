'use client';

import { useState } from 'react';

export const PLAYER_COLORS = [
  '#ff3b30', '#ff9500', '#ffcc00', '#34c759',
  '#00c7be', '#007aff', '#af52de', '#ff2d55',
] as const;

type Props = {
  initialNickname: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (nickname: string, color: string) => void;
};

export default function JoinForm({ initialNickname, submitting, error, onSubmit }: Props) {
  const [nickname, setNickname] = useState(initialNickname);
  const [color, setColor] = useState<string>(PLAYER_COLORS[0]);
  const trimmed = nickname.trim();

  return (
    <form
      className="flex flex-col gap-5 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed) onSubmit(trimmed, color);
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-sm text-neutral-500">Ваше імʼя</span>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={24}
          autoComplete="nickname"
          className="rounded-xl bg-white/80 px-4 py-3 text-[16px] outline-none ring-1 ring-black/10"
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm text-neutral-500">Колір</legend>
        <div className="flex flex-wrap gap-3">
          {PLAYER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`h-9 w-9 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-neutral-900' : ''}`}
            />
          ))}
        </div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={!trimmed || submitting}
        className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-40"
      >
        {submitting ? 'Приєднуємось…' : 'Приєднатися'}
      </button>
    </form>
  );
}
