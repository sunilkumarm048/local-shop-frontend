'use client';

/**
 * Compact, embedded delivery-location picker for the checkout page.
 *
 * Distinct from the larger modal-based `DeliveryLocationModal` in two ways:
 *   1. Inline (no modal, no mode-tiles, no autocomplete search).
 *   2. Designed to *refine* a location the customer has already chosen on
 *      the front page — e.g. drag the pin from the building entrance to
 *      the gate they actually want the partner to come to.
 *
 * Leaflet touches `window` at import time, so this whole file must be
 * dynamically imported with `ssr: false` from the consumer. Same pattern
 * as `components/shop/LocationPicker` + the existing
 * `DeliveryLocationModal`.
 */

import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, MapPin } from 'lucide-react';

// Leaflet default-icon shim — match the existing modal so a duplicate run is harmless.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DROP_PIN = L.divIcon({
  className: '',
  html: `
    <div style="
      background:#0C831F;width:32px;height:32px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
      box-shadow:0 3px 8px rgba(0,0,0,.3);border:3px solid #fff;
    ">
      <div style="transform:rotate(45deg);font-size:13px;color:#fff;font-weight:800;">📍</div>
    </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

/** Bhubaneswar — fallback when no location has been chosen yet. */
const DEFAULT_CENTER: [number, number] = [20.2961, 85.8245];

async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ areaName: string; address: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!res.ok) return { areaName: '', address: '' };
    const data = await res.json();
    const a = data.address || {};
    const areaName =
      a.suburb ||
      a.neighbourhood ||
      a.village ||
      a.town ||
      a.city_district ||
      a.city ||
      a.county ||
      a.state ||
      '';
    return {
      areaName,
      address: data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    };
  } catch {
    return { areaName: '', address: '' };
  }
}

/* --- Map subcomponents --- */

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ to }: { to: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (to) map.setView(to, Math.max(map.getZoom(), 15));
  }, [to, map]);
  return null;
}

function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 120);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

/* ----------------------------------------------------------------------- */

export interface CheckoutLocationPickerProps {
  /** Currently selected pin (controlled). */
  lat: number | null;
  lng: number | null;
  /** Called whenever the pin moves (click, drag, or external recenter). */
  onChange: (next: {
    lat: number;
    lng: number;
    address: string;
    areaName: string;
  }) => void;
  /** Optional gift-mode hint — just changes the helper text. */
  giftMode?: boolean;
}

export function CheckoutLocationPicker({
  lat,
  lng,
  onChange,
  giftMode,
}: CheckoutLocationPickerProps) {
  const [resolving, setResolving] = useState(false);
  const lastFetchedRef = useRef<string>('');

  // Whenever lat/lng change (parent-driven or our own onChange), do a
  // lightweight reverse-geocode and bubble the address back up. Throttled
  // by comparing to the last fetched key so we never refetch the same point.
  useEffect(() => {
    if (lat == null || lng == null) return;
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (lastFetchedRef.current === key) return;
    lastFetchedRef.current = key;
    setResolving(true);
    reverseGeocode(lat, lng)
      .then(({ areaName, address }) => {
        onChange({ lat, lng, address, areaName });
      })
      .finally(() => setResolving(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  const handlePick = (la: number, lo: number) => {
    onChange({ lat: la, lng: lo, address: '', areaName: '' });
  };

  const center: [number, number] = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER;
  const hasPin = lat != null && lng != null;

  return (
    <div className="border rounded-lg overflow-hidden bg-muted">
      <div className="relative h-56 w-full">
        <MapContainer
          center={center}
          zoom={hasPin ? 16 : 12}
          style={{ height: '100%', width: '100%' }}
          zoomControl
        >
          <TileLayer
            attribution="© OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <InvalidateOnMount />
          <Recenter to={hasPin ? [lat as number, lng as number] : null} />
          <MapClickHandler onPick={handlePick} />
          {hasPin && (
            <Marker
              position={[lat as number, lng as number]}
              icon={DROP_PIN}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const p = (e.target as L.Marker).getLatLng();
                  handlePick(p.lat, p.lng);
                },
              }}
            />
          )}
        </MapContainer>

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[400] bg-black/80 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full pointer-events-none whitespace-nowrap">
          Tap the map or drag the pin
        </div>
      </div>

      {/* Resolved-address strip */}
      <div className="bg-card px-3 py-2 border-t flex items-center gap-2">
        <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
        <div className="flex-1 min-w-0 leading-tight">
          <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            {giftMode ? 'Recipient pin' : 'Drop pin'}
          </div>
          <div className="text-[11px] text-foreground/80">
            {hasPin
              ? `${(lat as number).toFixed(4)}, ${(lng as number).toFixed(4)}`
              : 'Tap the map to set a location'}
          </div>
        </div>
        {resolving && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
        )}
      </div>
    </div>
  );
}
