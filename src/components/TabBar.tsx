'use client';

import { type ReactElement, useEffect, useRef } from 'react';

export type Tab = 'map' | 'finds' | 'profile';

// iOS-style bottom tab bar. Solid, with a hairline top edge and the home-indicator inset.
// Reports its own height so sheets can sit above it.
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

  return (
    <nav ref={ref} aria-label="Головна навігація" className="absolute inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-[var(--paper)] pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-3">
        {items.map((it) => {
          const active = tab === it.id;
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => onChange(it.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[56px] w-full flex-col items-center justify-center gap-1 pt-2 transition-colors ${active ? 'text-[var(--green)]' : 'text-[var(--muted)]'}`}
              >
                {it.icon}
                <span className="text-[11px] font-semibold leading-none">{it.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function IconMap() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.8 2.7L16 9.5" />
    </svg>
  );
}
function IconPerson() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}
