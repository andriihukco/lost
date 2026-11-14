'use client';

import { useEffect, useRef } from 'react';
import Icon from '@/components/Icon';
import type { IconName } from '@/components/iconPaths';

export type PillItem<T extends string> = { id: T; label: string; icon: IconName };

// Floating pill navigation (iOS 26 Liquid Glass style), shared by the player and the admin.
// The active item fills its icon and sits on a sliding indicator. position="fixed" for screens that scroll the page.
// Reports its height so content above it can keep clear.
export default function PillTabBar<T extends string>({
  items,
  value,
  onChange,
  onHeight,
  navLabel,
  position = 'absolute',
}: {
  items: PillItem<T>[];
  value: T;
  onChange: (v: T) => void;
  onHeight?: (h: number) => void;
  navLabel: string;
  position?: 'absolute' | 'fixed';
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onHeight) return;
    const report = () => onHeight(el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight]);

  const n = items.length;
  const index = items.findIndex((i) => i.id === value);

  return (
    <nav
      ref={ref}
      aria-label={navLabel}
      className={`pointer-events-none inset-x-0 bottom-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 ${position === 'fixed' ? 'fixed' : 'absolute'}`}
    >
      <div
        className="liquid-pill pointer-events-auto relative mx-auto grid max-w-sm rounded-full p-1.5"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {index >= 0 && (
          <span
            aria-hidden
            className="liquid-indicator"
            style={{ left: `calc(6px + ${index} * (100% - 12px) / ${n})`, width: `calc((100% - 12px) / ${n})` }}
          />
        )}
        {items.map((it) => {
          const active = value === it.id;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onChange(it.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative z-10 flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-full transition-colors ${active ? 'text-[var(--green-deep)]' : 'text-[var(--muted)]'}`}
            >
              <Icon name={it.icon} filled={active} size={26} />
              <span className="text-[12px] font-bold leading-none">{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
