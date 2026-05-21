'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/stores/auth';
import { getSocket } from '@/lib/socket';

interface LatLng {
  lat: number;
  lng: number;
}

interface Opts {
  /** Whether streaming should be active. Pass `false` to pause. */
  enabled: boolean;
  /** Order IDs to fan the location ping out to (so customers tracking them see the partner move). */
  orderIds: string[];
  /** Min ms between socket emits (the GPS may fire much faster). Default 5000. */
  emitIntervalMs?: number;
}

/**
 * PHASE 5b — Continuous GPS streaming for a delivery partner.
 *
 * - Uses navigator.geolocation.watchPosition (low-power, OS-driven updates).
 * - Throttles socket emits to once per emitIntervalMs to avoid hammering the
 *   server / customer's tracking page.
 * - Returns the latest local position and any geolocation error so the UI can
 *   show "GPS off" / "Permission denied" / a stat pill.
 *
 * Pass `enabled: false` (e.g. when offline) and the watcher unsubscribes.
 */
export function useLiveLocation({ enabled, orderIds, emitIntervalMs = 5_000 }: Opts) {
  const token = useAuth((s) => s.token);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep latest orderIds in a ref so the geolocation callback (registered once)
  // emits to the up-to-date set without re-subscribing on every render.
  const orderIdsRef = useRef<string[]>(orderIds);
  orderIdsRef.current = orderIds;
  const lastEmitRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(next);
        setError(null);

        // Throttle socket emits — many devices fire watchPosition every 1s or
        // faster; that's too chatty for a live tracking link.
        const now = Date.now();
        if (now - lastEmitRef.current < emitIntervalMs) return;
        lastEmitRef.current = now;

        const socket = getSocket(token);
        socket?.emit('delivery:location', {
          lat: next.lat,
          lng: next.lng,
          orderIds: orderIdsRef.current,
        });
      },
      (err) => setError(err.message || 'Could not get your location.'),
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 30_000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, token, emitIntervalMs]);

  return { position, error };
}
