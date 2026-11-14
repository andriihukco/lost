'use client';

import { type ReactElement, useEffect, useRef } from 'react';

export type Tab = 'map' | 'finds' | 'profile';

const ORDER: Tab[] = ['map', 'finds', 'profile'];

// Floating pill navbar in the iOS 26 Liquid Glass style: frosted, rounded, with a sliding active indicator.
// The solid fallback applies when the player reduces transparency. Reports its height so sheets sit above it.
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

  const items: { id: Tab; label: string; icon: ReactElement }[] = [
    { id: 'map', label: 'Карта', icon: <IconMap /> },
    { id: 'finds', label: 'Знахідки', icon: <IconCheck /> },
    { id: 'profile', label: 'Профіль', icon: <IconPerson /> },
  ];
  const index = ORDER.indexOf(tab);

  return (
    <nav
      ref={ref}
      aria-label="Головна навігація"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2"
    >
      <div className="liquid-pill pointer-events-auto relative mx-auto grid max-w-sm grid-cols-3 rounded-full p-1.5">
        <span
          aria-hidden
          className="liquid-indicator"
          style={{ left: `calc(6px + ${index} * (100% - 12px) / 3)` }}
        />
        {items.map((it) => {
          const active = tab === it.id;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onChange(it.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative z-10 flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-full transition-colors ${active ? 'text-[var(--green-deep)]' : 'text-[var(--ink)]/70'}`}
            >
              {it.icon}
              <span className="text-[11px] font-semibold leading-none">{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function IconMap() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.8 2.7L16 9.5" />
    </svg>
  );
}
function IconPerson() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}
