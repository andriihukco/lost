'use client';

import { useEffect, useState } from 'react';
import type { LatLng } from '@/lib/geo';

export type GpsStatus = 'off' | 'searching' | 'ok' | 'denied';

export type GeoState = { pos: LatLng | null; accuracy: number | null; status: GpsStatus };

// watchPosition with enableHighAccuracy (spec §3, Task 9). Accuracy passes through; geo.ts handles missing values.
export function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>({ pos: null, accuracy: null, status: 'searching' });

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setState({ pos: null, accuracy: null, status: 'off' });
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) =>
        setState({
          pos: { lat: p.coords.latitude, lng: p.coords.longitude },
          accuracy: p.coords.accuracy,
          status: 'ok',
        }),
      (err) =>
        setState((s) => ({
          ...s,
          status: err.code === err.PERMISSION_DENIED ? 'denied' : 'searching',
        })),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return state;
}
