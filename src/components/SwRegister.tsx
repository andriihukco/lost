'use client';

import { useEffect } from 'react';

// Registers the service worker (public/sw.js) in production builds: the offline app shell and the saved map.
export default function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // no service worker: the app works online as before
    });
  }, []);
  return null;
}
