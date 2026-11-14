'use client';

import { useEffect, useRef } from 'react';
import Icon from '@/components/Icon';
import type { IconName } from '@/components/iconPaths';

export type Tab = 'map' | 'finds' | 'rating' | 'profile';

const ORDER: Tab[] = ['map', 'finds', 'rating', 'profile'];
const ITEMS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'map', label: 'Карта', icon: 'map' },
  { id: 'finds', label: 'Знахідки', icon: 'task_alt' },
  { id: 'rating', label: 'Рейтинг', icon: 'trophy' },
  { id: 'profile', label: 'Профіль', icon: 'person' },
];

// Floating pill navigation (iOS 26 Liquid Glass style). The active tab fills its Material icon and
// sits on a sliding indicator. Reports its height so the sheet and the nearby notice sit above it.
export default function TabBar({ tab, onChange, onHeight }: { tab: Tab; onChange: (t: Tab) => void; onHeight: (h: number) => void }) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => onHeight(el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight]);

  const index = ORDER.indexOf(tab);

  return (
    <nav
      ref={ref}
      aria-label="Головна навігація"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2"
    >
      <div className="liquid-pill pointer-events-auto relative mx-auto grid max-w-sm grid-cols-4 rounded-full p-1.5">
        <span
          aria-hidden
          className="liquid-indicator"
          style={{ left: `calc(6px + ${index} * (100% - 12px) / 4)` }}
        />
        {ITEMS.map((it) => {
          const active = tab === it.id;
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
