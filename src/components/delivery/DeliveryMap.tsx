'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Leaflet's default marker images don't resolve through bundlers — same patch
 * we use in LocationPicker.
 */
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function pin(emoji: string, bg: string) {
  return L.divIcon({
    className: 'lshop-pin',
    html: `
      <div style="
        background:${bg};width:32px;height:32px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
        box-shadow:0 3px 8px rgba(0,0,0,.3);border:3px solid #fff;
      ">
        <div style="transform:rotate(45deg);font-size:13px;line-height:1;color:#fff;font-weight:800;">${emoji}</div>
      </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

const PIN_PARTNER = pin('🛵', '#0C831F');
const PIN_SHOP = pin('🏪', '#F8CD46');
const PIN_CUSTOMER = pin('📍', '#1f2937');

export interface LatLng {
  lat: number;
  lng: number;
}

interface Props {
  /** The delivery partner's live location, if known. */
  partner?: LatLng | null;
  /** The shop's pinned location. */
  shop?: LatLng | null;
  /** The customer's drop location, if known. */
  customer?: LatLng | null;
  /**
   * Which leg of the trip is "active" — shown as a solid line. The other leg
   * is dashed/faded. If omitted, both legs are dashed.
   */
  activeLeg?: 'to_shop' | 'to_customer' | null;
  /** Map height in px. */
  height?: number;
}

/**
 * Pans/zooms the map so all available points are in view.
 */
function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [points, map]);
  return null;
}

export default function DeliveryMap({
  partner,
  shop,
  customer,
  activeLeg,
  height = 280,
}: Props) {
  const points = useMemo(
    () => [partner, shop, customer].filter((p): p is LatLng => !!p),
    [partner, shop, customer]
  );

  // Center default — Bhubaneswar, same as the location picker fallback.
  const center: [number, number] = points.length
    ? [points[0].lat, points[0].lng]
    : [20.2961, 85.8245];

  return (
    <div className="rounded-lg overflow-hidden border" style={{ height }}>
      <MapContainer center={center} zoom={13} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds points={points} />

        {partner && (
          <Marker position={[partner.lat, partner.lng]} icon={PIN_PARTNER}>
            <Tooltip direction="top" offset={[0, -20]}>Delivery partner</Tooltip>
          </Marker>
        )}
        {shop && (
          <Marker position={[shop.lat, shop.lng]} icon={PIN_SHOP}>
            <Tooltip direction="top" offset={[0, -20]}>Shop</Tooltip>
          </Marker>
        )}
        {customer && (
          <Marker position={[customer.lat, customer.lng]} icon={PIN_CUSTOMER}>
            <Tooltip direction="top" offset={[0, -20]}>Drop-off</Tooltip>
          </Marker>
        )}

        {/* Leg 1: partner → shop */}
        {partner && shop && (
          <Polyline
            positions={[
              [partner.lat, partner.lng],
              [shop.lat, shop.lng],
            ]}
            pathOptions={{
              color: activeLeg === 'to_shop' ? '#0C831F' : '#9ca3af',
              weight: activeLeg === 'to_shop' ? 4 : 3,
              dashArray: activeLeg === 'to_shop' ? undefined : '8 8',
              opacity: 0.85,
            }}
          />
        )}

        {/* Leg 2: shop → customer */}
        {shop && customer && (
          <Polyline
            positions={[
              [shop.lat, shop.lng],
              [customer.lat, customer.lng],
            ]}
            pathOptions={{
              color: activeLeg === 'to_customer' ? '#0C831F' : '#9ca3af',
              weight: activeLeg === 'to_customer' ? 4 : 3,
              dashArray: activeLeg === 'to_customer' ? undefined : '8 8',
              opacity: 0.85,
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
