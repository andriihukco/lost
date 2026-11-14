'use client';

import { useEffect, useState } from 'react';

// Keeps the screen on while the map is visible (spec §8). Re-requests after the tab returns to the foreground,
// because the browser releases the lock whenever the page is hidden.
export function useWakeLock(): { active: boolean; supported: boolean } {
  const [active, setActive] = useState(false);
  const [supported] = useState(() => typeof navigator !== 'undefined' && 'wakeLock' in navigator);

  useEffect(() => {
    if (!supported) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      if (cancelled || sentinel || document.visibilityState !== 'visible') return;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (cancelled) {
          await next.release();
          return;
        }
        sentinel = next;
        setActive(true);
        next.addEventListener('release', () => {
          if (sentinel === next) sentinel = null;
          if (!cancelled) setActive(false);
        });
      } catch {
        if (!cancelled) setActive(false);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release();
    };
  }, [supported]);

  return { active, supported };
}
