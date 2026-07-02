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
import { Loader2, MapPin, Search } from 'lucide-react';
import { geoSearch, type GeoResult } from '@/lib/geo';

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
  const [satellite, setSatellite] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedRef = useRef<string>('');

  // Address search (debounced 350ms) via backend proxy — Ola Maps (India) with
  // OSM fallback. Selecting a result drops the pin there.
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await geoSearch(trimmed);
        setResults(found);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [query]);

  const pickFromSearch = (r: GeoResult) => {
    setQuery(r.name || r.address);
    setShowResults(false);
    onChange({ lat: r.lat, lng: r.lng, address: r.address || r.name, areaName: r.name || '' });
  };

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
      {/* Address search */}
      <div className="relative border-b bg-white">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="text"
          placeholder="Search address, area, landmark…"
          className="w-full pl-9 pr-9 py-2.5 text-[13px] font-medium bg-transparent outline-none"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
        )}
        {query && !searching && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setShowResults(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs"
          >
            ×
          </button>
        )}
      </div>

      {/* Search results */}
      {showResults && (
        <div className="max-h-44 overflow-y-auto bg-white border-b">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-center text-xs text-muted-foreground">
              No results
            </div>
          ) : (
            results.map((r, i) => (
              <button
                type="button"
                key={`${r.lat},${r.lng},${i}`}
                onClick={() => pickFromSearch(r)}
                className="w-full text-left px-3 py-2.5 border-b last:border-0 flex gap-2.5 hover:bg-muted/50"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="text-[13px] font-semibold truncate">
                    {r.name || r.address?.split(',')[0]}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {r.address}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      <div className="relative h-56 w-full">
        <MapContainer
          center={center}
          zoom={hasPin ? 16 : 12}
          style={{ height: '100%', width: '100%' }}
          zoomControl
        >
          {satellite ? (
            <>
              {/* Esri World Imagery — free satellite tiles, no API key. */}
              <TileLayer
                attribution="Tiles &copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
              {/* Transparent labels overlay — road/place names on imagery. */}
              <TileLayer
                attribution="&copy; OpenStreetMap, &copy; CARTO"
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
                maxZoom={20}
              />
            </>
          ) : (
            <TileLayer
              attribution="© OpenStreetMap"
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          )}
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

        <button
          type="button"
          onClick={() => setSatellite((s) => !s)}
          className="absolute top-2 right-2 z-[400] bg-white/95 hover:bg-white text-black text-[10px] font-semibold px-2.5 py-1 rounded-md shadow border border-black/10"
        >
          {satellite ? 'Map view' : 'Satellite'}
        </button>

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
