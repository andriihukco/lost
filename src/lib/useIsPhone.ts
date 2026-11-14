'use client';

import { useEffect, useState } from 'react';

// True on a touch device (a phone or tablet). Desktops and laptops report a fine pointer: no motion sensors,
// and nothing in the field to point a camera at. Starts false on the server and corrects after mount.
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return phone;
}
