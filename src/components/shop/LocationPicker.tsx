'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Loader2, MapPin, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { geoSearch } from '@/lib/geo';

/**
 * Leaflet ships its marker icons as separate files. Bundlers don't resolve them
 * correctly. We use a custom divIcon below, but the default icon also gets
 * referenced internally, so patch it once.
 */
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/**
 * Brand-green teardrop pin with a 🏪 glyph — matches the legacy register UI.
 */
const SHOP_PIN = L.divIcon({
  className: 'lshop-pin',
  html: `
    <div style="
      background:#0C831F;width:34px;height:34px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
      box-shadow:0 3px 8px rgba(0,0,0,.3);border:3px solid #fff;
    ">
      <div style="transform:rotate(45deg);font-size:14px;color:#fff;font-weight:800;">🏪</div>
    </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Address hints from reverse-geocoding the pin. The wizard uses these to
 * auto-fill the structured address inputs when they're still empty.
 */
export interface AddressHints {
  display?: string;
  line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

interface Props {
  value: LatLng | null;
  onChange: (v: LatLng, hints?: AddressHints) => void;
  defaultCenter?: LatLng;
}

// Bhubaneswar — same default the legacy register used.
const DEFAULT_CENTER: LatLng = { lat: 20.2961, lng: 85.8245 };

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

function resultToHints(r: NominatimResult): AddressHints {
  const a = r.address || {};
  return {
    display: r.display_name,
    line1: a.road || a.neighbourhood || a.suburb || undefined,
    city: a.city || a.town || a.village || undefined,
    state: a.state || undefined,
    pincode: a.postcode || undefined,
    country: a.country || undefined,
  };
}

// ----- Map sub-components -----

function ClickHandler({ onPick }: { onPick: (v: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function Recenter({ target }: { target: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView([target.lat, target.lng], Math.max(map.getZoom(), 15));
  }, [target, map]);
  return null;
}

// ----- Main -----

export default function LocationPicker({ value, onChange, defaultCenter }: Props) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Address text under the map (reverse-geocoded display name)
  const [pickedAddress, setPickedAddress] = useState<string>('');

  const initial = useMemo(() => value ?? defaultCenter ?? DEFAULT_CENTER, [value, defaultCenter]);

  async function reverseGeocode(ll: LatLng): Promise<AddressHints | undefined> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${ll.lat}&lon=${ll.lng}&format=json&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (!res.ok) return undefined;
      const data = (await res.json()) as NominatimResult;
      return resultToHints(data);
    } catch {
      return undefined;
    }
  }

  async function pickAndReverseGeocode(ll: LatLng) {
    const hints = await reverseGeocode(ll);
    setPickedAddress(hints?.display || `${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`);
    onChange(ll, hints);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported by this browser.');
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await pickAndReverseGeocode({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      (err) => {
        setGeoError(err.message || 'Could not get your location.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  // Forward search (Nominatim autocomplete, 350ms debounce, India-only)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        // Backend geo proxy: Ola Maps (India/village data) with OSM fallback.
        const found = await geoSearch(trimmed);
        const mapped: NominatimResult[] = found.map((g) => ({
          lat: String(g.lat),
          lon: String(g.lng),
          display_name: g.address || g.name,
        }));
        setResults(mapped);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function selectResult(r: NominatimResult) {
    const ll = { lat: Number(r.lat), lng: Number(r.lon) };
    const hints = resultToHints(r);
    setPickedAddress(hints.display || '');
    setQuery('');
    setResults([]);
    setShowResults(false);
    onChange(ll, hints);
  }

  function handleManualLat(raw: string) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= -90 && n <= 90) {
      onChange({ lat: n, lng: value?.lng ?? initial.lng });
    }
  }
  function handleManualLng(raw: string) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= -180 && n <= 180) {
      onChange({ lat: value?.lat ?? initial.lat, lng: n });
    }
  }

  return (
    <div className="space-y-3">
      {/* Search row */}
      <div className="relative">
        <div className="flex items-center gap-2 rounded-md border bg-background px-3 h-10">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            className="flex-1 bg-transparent text-sm focus:outline-none"
            placeholder="Search address, area, landmark…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
          />
          {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {query && !searching && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
                setShowResults(false);
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {showResults && results.length > 0 && (
          <div className="absolute z-[1000] mt-1 w-full bg-popover border rounded-md shadow-lg max-h-64 overflow-y-auto">
            {results.map((r, i) => {
              const display = r.display_name || '';
              const [main, ...rest] = display.split(', ');
              return (
                <button
                  key={`${r.lat}-${r.lon}-${i}`}
                  type="button"
                  onClick={() => selectResult(r)}
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-start gap-2 border-b last:border-b-0"
                >
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{main}</div>
                    <div className="text-xs text-muted-foreground truncate">{rest.join(', ')}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {showResults && !searching && results.length === 0 && query.trim().length >= 3 && (
          <div className="absolute z-[1000] mt-1 w-full bg-popover border rounded-md shadow-lg px-3 py-3 text-sm text-muted-foreground text-center">
            No results
          </div>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          Click the map or drag the pin to set your shop&apos;s exact location.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={useMyLocation}
          disabled={locating}
        >
          {locating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Crosshair className="h-4 w-4 mr-2" />
          )}
          Use my location
        </Button>
      </div>

      {/* Map */}
      <div className="h-72 w-full rounded-md overflow-hidden border">
        <MapContainer
          center={[initial.lat, initial.lng]}
          zoom={value ? 15 : 5}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={pickAndReverseGeocode} />
          <Recenter target={value} />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={SHOP_PIN}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = (e.target as L.Marker).getLatLng();
                  pickAndReverseGeocode({ lat, lng });
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      {/* Picked address preview */}
      {value && (
        <div className="rounded-md bg-brand-greenLight/40 px-3 py-2 text-sm">
          <div className="text-xs font-semibold text-brand-green uppercase tracking-wide">
            Pinned location
          </div>
          <div className="mt-0.5 text-foreground">
            {pickedAddress || `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`}
          </div>
        </div>
      )}

      {/* Manual entry */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="lat" className="text-xs">
            Latitude
          </Label>
          <Input
            id="lat"
            inputMode="decimal"
            value={value?.lat ?? ''}
            placeholder="20.2961"
            onChange={(e) => handleManualLat(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="lng" className="text-xs">
            Longitude
          </Label>
          <Input
            id="lng"
            inputMode="decimal"
            value={value?.lng ?? ''}
            placeholder="85.8245"
            onChange={(e) => handleManualLng(e.target.value)}
          />
        </div>
      </div>

      {geoError && <p className="text-xs text-destructive">{geoError}</p>}
    </div>
  );
}
