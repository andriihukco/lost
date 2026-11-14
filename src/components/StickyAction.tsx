'use client';

import type { ReactNode } from 'react';

// The main call to action of a screen, pinned to the bottom of the screen so it never needs scrolling to.
// bottomOffset lifts it above the tab bar when the screen has one.
export default function StickyAction({ children, bottomOffset = 0 }: { children: ReactNode; bottomOffset?: number }) {
  return (
    <div className="fixed inset-x-0 z-40 border-t border-[var(--line)] bg-[var(--paper)]/95 backdrop-blur-md" style={{ bottom: bottomOffset }}>
      <div className="mx-auto w-full max-w-md px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">{children}</div>
    </div>
  );
}
