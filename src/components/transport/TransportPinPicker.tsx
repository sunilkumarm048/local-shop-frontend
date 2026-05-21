'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Loader2, MapPin, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Lightweight pin picker for transport pickup / drop selection.
 * Same Leaflet+Nominatim pattern as the shop-onboarding LocationPicker,
 * but trimmed down: just a pin + address text field, no structured address
 * inputs (transport addresses are free-text — "Behind the petrol pump" is OK).
 */

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PIN_COLORS = {
  pickup: '#0C831F', // brand green
  drop: '#ea580c', // orange-600
};
const PIN_EMOJI = {
  pickup: '📦',
  drop: '🎯',
};

function makePin(role: 'pickup' | 'drop') {
  return L.divIcon({
    className: 'lshop-pin',
    html: `
      <div style="
        background:${PIN_COLORS[role]};width:34px;height:34px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
        box-shadow:0 3px 8px rgba(0,0,0,.3);border:3px solid #fff;
      ">
        <div style="transform:rotate(45deg);font-size:14px;line-height:1;">${PIN_EMOJI[role]}</div>
      </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
}

export interface LatLng {
  lat: number;
  lng: number;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  role: 'pickup' | 'drop';
  value: LatLng | null;
  onChange: (latlng: LatLng, addressHint?: string) => void;
  /** Optional initial center if no value yet (defaults to Bhubaneswar). */
  initialCenter?: LatLng;
}

const DEFAULT_CENTER: LatLng = { lat: 20.2961, lng: 85.8245 };

export function TransportPinPicker({ role, value, onChange, initialCenter }: Props) {
  const pinIcon = useMemo(() => makePin(role), [role]);
  const center = value || initialCenter || DEFAULT_CENTER;

  const [searchQ, setSearchQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<NominatimResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [reverseBusy, setReverseBusy] = useState(false);

  async function doSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = searchQ.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    setResults(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(
        q
      )}`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en' },
      });
      if (!res.ok) throw new Error('Search failed');
      const data = (await res.json()) as NominatimResult[];
      setResults(data);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  function pickResult(r: NominatimResult) {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    onChange({ lat, lng }, r.display_name);
    setResults(null);
    setSearchQ('');
  }

  /**
   * When the pin moves (via click, drag, or "use my location"), reverse-geocode
   * and pass the address back as a hint so the parent can pre-fill the
   * address text input (only if it's empty — see parent).
   */
  async function reverseGeocode(latlng: LatLng) {
    setReverseBusy(true);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      if (!res.ok) return undefined;
      const data = (await res.json()) as { display_name?: string };
      return data.display_name;
    } catch {
      return undefined;
    } finally {
      setReverseBusy(false);
    }
  }

  async function handleMapPick(latlng: LatLng) {
    const hint = await reverseGeocode(latlng);
    onChange(latlng, hint);
  }

  async function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const hint = await reverseGeocode(ll);
        onChange(ll, hint);
      },
      () => {
        /* swallow */
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <form onSubmit={doSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={role === 'pickup' ? 'Pickup address…' : 'Drop address…'}
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="pl-9 pr-8"
          />
          {searchQ && (
            <button
              type="button"
              onClick={() => {
                setSearchQ('');
                setResults(null);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button type="submit" disabled={searching || !searchQ.trim()} size="sm">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={useMyLocation}
          title="Use my current location"
        >
          <Crosshair className="h-4 w-4" />
        </Button>
      </form>

      {searchError && (
        <div className="text-xs text-destructive">{searchError}</div>
      )}

      {results && results.length > 0 && (
        <ul className="bg-white border rounded-md divide-y max-h-44 overflow-auto text-sm">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => pickResult(r)}
                className="w-full text-left px-3 py-2 hover:bg-muted/60 flex items-start gap-2"
              >
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <span className="text-xs">{r.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {results && results.length === 0 && (
        <div className="text-xs text-muted-foreground px-1">No results.</div>
      )}

      {/* Map */}
      <div className="rounded-lg overflow-hidden border" style={{ height: 280 }}>
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={value ? 15 : 12}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RecenterOnValue value={value} />
          <ClickToPlace onPick={handleMapPick} />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = (e.target as L.Marker).getLatLng();
                  void handleMapPick({ lat, lng });
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <div className="text-[11px] text-muted-foreground flex items-center gap-1 px-1">
        {reverseBusy && <Loader2 className="h-3 w-3 animate-spin" />}
        Tap the map or drag the pin to adjust.
      </div>
    </div>
  );
}

function RecenterOnValue({ value }: { value: LatLng | null }) {
  const map = useMap();
  const lastRef = useRef<LatLng | null>(null);
  useEffect(() => {
    if (!value) return;
    if (lastRef.current && lastRef.current.lat === value.lat && lastRef.current.lng === value.lng)
      return;
    lastRef.current = value;
    map.setView([value.lat, value.lng], Math.max(map.getZoom(), 14), { animate: true });
  }, [value, map]);
  return null;
}

function ClickToPlace({ onPick }: { onPick: (latlng: LatLng) => void }) {
  useMapEvents({
    click: (e) => {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}
