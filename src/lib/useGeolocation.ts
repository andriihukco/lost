'use client';

import { useEffect, useState } from 'react';
import type { LatLng } from '@/lib/geo';

export type GpsStatus = 'off' | 'searching' | 'ok' | 'denied';

export type GeoState = { pos: LatLng | null; accuracy: number | null; status: GpsStatus; course: number | null };

// watchPosition with enableHighAccuracy (spec §3, Task 9). Accuracy passes through; geo.ts handles missing values.
export function useGeolocation(enabled: boolean = true): GeoState {
  const [state, setState] = useState<GeoState>({ pos: null, accuracy: null, status: 'searching', course: null });

  useEffect(() => {
    if (!enabled) return; // not asked yet (first-run welcome)
    if (!('geolocation' in navigator)) {
      setState({ pos: null, accuracy: null, status: 'off', course: null });
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) =>
        setState({
          pos: { lat: p.coords.latitude, lng: p.coords.longitude },
          accuracy: p.coords.accuracy,
          status: 'ok',
          // GPS course: the direction of travel, only meaningful while moving
          course: typeof p.coords.heading === 'number' && Number.isFinite(p.coords.heading) ? p.coords.heading : null,
        }),
      (err) =>
        setState((s) => ({
          ...s,
          status: err.code === err.PERMISSION_DENIED ? 'denied' : 'searching',
        })),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return state;
}
