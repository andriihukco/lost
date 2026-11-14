'use client';

import { useCallback, useEffect, useState } from 'react';
import { headingFromOrientation, type OrientationReading } from '@/lib/heading';

export type HeadingStatus = 'unsupported' | 'needs-permission' | 'denied' | 'listening';

type IOSOrientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

// Device compass. Works on phones: Android Chrome reports an absolute heading; iOS Safari needs a tap
// (requestPermission) and reports webkitCompassHeading. Desktop browsers have no compass.
export function useHeading(): { heading: number | null; status: HeadingStatus; requestPermission: () => Promise<HeadingStatus> } {
  const [heading, setHeading] = useState<number | null>(null);
  const [status, setStatus] = useState<HeadingStatus>('unsupported');

  const onReading = useCallback((e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
    const reading: OrientationReading = {
      alpha: e.alpha,
      absolute: e.absolute,
      webkitCompassHeading: e.webkitCompassHeading,
    };
    const h = headingFromOrientation(reading);
    if (h !== null) setHeading(h);
  }, []);

  const attach = useCallback(() => {
    window.addEventListener('deviceorientationabsolute', onReading as EventListener);
    window.addEventListener('deviceorientation', onReading as EventListener);
    setStatus('listening');
  }, [onReading]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setStatus('unsupported');
      return;
    }
    const DOE = window.DeviceOrientationEvent as IOSOrientation;
    if (typeof DOE.requestPermission === 'function') {
      setStatus('needs-permission'); // iOS: must be started from a tap
      return;
    }
    attach();
    return () => {
      window.removeEventListener('deviceorientationabsolute', onReading as EventListener);
      window.removeEventListener('deviceorientation', onReading as EventListener);
    };
  }, [attach, onReading]);

  // Returns the resulting status, so callers do not read a stale one.
  const requestPermission = useCallback(async (): Promise<HeadingStatus> => {
    const DOE = window.DeviceOrientationEvent as IOSOrientation | undefined;
    if (!DOE || typeof DOE.requestPermission !== 'function') {
      const current: HeadingStatus = 'listening';
      return current;
    }
    try {
      const result = await DOE.requestPermission();
      if (result === 'granted') {
        attach();
        return 'listening';
      }
      setStatus('denied');
      return 'denied';
    } catch {
      setStatus('denied');
      return 'denied';
    }
  }, [attach]);

  return { heading, status, requestPermission };
}
