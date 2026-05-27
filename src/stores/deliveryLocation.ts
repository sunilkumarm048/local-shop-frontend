import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Customer's chosen delivery location.
 *
 * `mode = 'self'`  → user's own GPS location (default).
 * `mode = 'other'` → "Sending to someone else" gift mode (pinned on a map).
 *
 * Persisted as `localshop-delivery-location` so the choice survives reloads —
 * matches the legacy site's localStorage keys conceptually but namespaced
 * under one zustand key.
 *
 * `areaName` is a short label like "Nemalo, Cuttack" (used in the header chip).
 * `address` is the full reverse-geocoded line (used in the gift banner +
 * pre-filled into checkout's recipient address field).
 */
export type DeliveryMode = 'self' | 'other';

interface DeliveryLocationState {
  mode: DeliveryMode;
  lat: number | null;
  lng: number | null;
  address: string;
  areaName: string;
  setLocation: (loc: {
    mode: DeliveryMode;
    lat: number;
    lng: number;
    address: string;
    areaName: string;
  }) => void;
  clear: () => void;
}

export const useDeliveryLocation = create<DeliveryLocationState>()(
  persist(
    (set) => ({
      mode: 'self',
      lat: null,
      lng: null,
      address: '',
      areaName: '',
      setLocation: (loc) => set(loc),
      clear: () =>
        set({ mode: 'self', lat: null, lng: null, address: '', areaName: '' }),
    }),
    { name: 'localshop-delivery-location' }
  )
);
