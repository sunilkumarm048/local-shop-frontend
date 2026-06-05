'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, MapPin, Search, X, Gift, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useDeliveryLocation, type DeliveryMode } from '@/stores/deliveryLocation';

/* -----------------------------------------------------------------------
 * Leaflet default-icon shim (bundlers can't resolve the marker PNGs).
 * The shop LocationPicker does the same; harmless if it runs twice.
 * --------------------------------------------------------------------- */
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
      background:#0C831F;width:34px;height:34px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
      box-shadow:0 3px 8px rgba(0,0,0,.3);border:3px solid #fff;
    ">
      <div style="transform:rotate(45deg);font-size:14px;color:#fff;font-weight:800;">📍</div>
    </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

/** Bhubaneswar — same fallback the legacy site used when GPS isn't available. */
const DEFAULT_CENTER: [number, number] = [20.2961, 85.8245];

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    suburb?: string;
    neighbourhood?: string;
    village?: string;
    town?: string;
    city?: string;
    city_district?: string;
    county?: string;
    state?: string;
    postcode?: string;
  };
}

/** Short locality label (e.g. "Nemalo, Cuttack"). */
function shortLabel(r: NominatimResult): string {
  const a = r.address || {};
  const locality =
    a.suburb ||
    a.neighbourhood ||
    a.village ||
    a.town ||
    a.city_district ||
    a.city ||
    a.county ||
    a.state ||
    '';
  const city = a.city || a.town || a.county || '';
  if (locality && city && locality !== city) return `${locality}, ${city}`;
  return locality || city || (r.display_name?.split(',')[0] ?? '');
}

/** Reverse-geocode a lat/lng → {areaName, address}. Both fields tolerated empty. */
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
    const data = (await res.json()) as NominatimResult;
    return {
      areaName: shortLabel(data) || 'Selected location',
      address: data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    };
  } catch {
    return { areaName: '', address: '' };
  }
}

/* ---------- Map subcomponents ---------- */

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

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * "Where to deliver?" modal — port of the legacy `#locModal`.
 *
 * Local state is held until the user clicks "Use This Location", at which
 * point we commit to the persisted store. Closing without confirming leaves
 * the saved location unchanged.
 */
export function DeliveryLocationModal({ open, onClose }: Props) {
  const saved = useDeliveryLocation();
  const commit = useDeliveryLocation((s) => s.setLocation);

  // Modal-internal state — committed on "Use This Location".
  const [mode, setMode] = useState<DeliveryMode>(saved.mode);
  const [lat, setLat] = useState<number | null>(saved.lat);
  const [lng, setLng] = useState<number | null>(saved.lng);
  const [areaName, setAreaName] = useState(saved.areaName);
  const [address, setAddress] = useState(saved.address);

  // Self panel
  const [gpsState, setGpsState] = useState<'idle' | 'detecting' | 'ok' | 'error'>('idle');
  const [gpsError, setGpsError] = useState('');

  // Other panel search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-sync from store every time the modal opens
  useEffect(() => {
    if (!open) return;
    setMode(saved.mode);
    setLat(saved.lat);
    setLng(saved.lng);
    setAreaName(saved.areaName);
    setAddress(saved.address);
    setGpsState('idle');
    setGpsError('');
    setQuery('');
    setResults([]);
    setShowResults(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-trigger GPS the first time Self mode is entered without a saved fix
  useEffect(() => {
    if (!open) return;
    if (mode !== 'self') return;
    if (lat != null && lng != null && saved.mode === 'self') return;
    detectGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, open]);

  // Nominatim autocomplete for "Other" mode (350 ms debounce, India-only)
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
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            trimmed
          )}&format=json&limit=6&countrycodes=in&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = (await res.json()) as NominatimResult[];
        setResults(data || []);
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

  // Escape closes (matches legacy)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function detectGps() {
    if (!navigator.geolocation) {
      setGpsState('error');
      setGpsError('Geolocation not supported on this device.');
      return;
    }
    setGpsState('detecting');
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const la = pos.coords.latitude;
        const lo = pos.coords.longitude;
        const { areaName: an, address: ad } = await reverseGeocode(la, lo);
        setLat(la);
        setLng(lo);
        setAreaName(an || 'Your location');
        setAddress(ad || an);
        setGpsState('ok');
      },
      (err) => {
        setGpsState('error');
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Enable it in browser settings.'
            : 'Could not get GPS. Tap Retry.'
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  }

  async function pickFromMap(newLat: number, newLng: number) {
    setLat(newLat);
    setLng(newLng);
    const { areaName: an, address: ad } = await reverseGeocode(newLat, newLng);
    setAreaName(an || 'Selected location');
    setAddress(ad || `${newLat.toFixed(4)}, ${newLng.toFixed(4)}`);
  }

  function pickFromSearch(r: NominatimResult) {
    const la = parseFloat(r.lat);
    const lo = parseFloat(r.lon);
    setLat(la);
    setLng(lo);
    setAreaName(shortLabel(r) || 'Selected location');
    setAddress(r.display_name);
    setQuery(shortLabel(r) || r.display_name);
    setShowResults(false);
  }

  function confirm() {
    if (lat == null || lng == null) return;
    commit({ mode, lat, lng, address, areaName });
    onClose();
  }

  const mapCenter: [number, number] =
    lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER;

  const canConfirm = lat != null && lng != null;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 flex items-end sm:items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 px-5 pt-4 pb-3 border-b flex items-start justify-between">
          <div>
            <div className="text-base font-extrabold">📍 Where to deliver?</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Choose delivery location
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 flex items-center justify-center text-base"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pt-3 pb-5 space-y-3">
          {/* Mode tiles */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setMode('self')}
              className={`rounded-xl border-2 p-3.5 text-center transition flex flex-col items-center gap-1 ${
                mode === 'self'
                  ? 'border-primary bg-[#f0fbf2] shadow-[0_2px_8px_rgba(12,131,31,0.15)]'
                  : 'border-border hover:border-[#b3e5bf]'
              }`}
            >
              <div className="text-2xl leading-none">📍</div>
              <div
                className={`text-[13px] font-bold ${
                  mode === 'self' ? 'text-primary' : ''
                }`}
              >
                For Me
              </div>
              <div className="text-[10px] text-muted-foreground">
                My current location
              </div>
            </button>
            <button
              onClick={() => setMode('other')}
              className={`rounded-xl border-2 p-3.5 text-center transition flex flex-col items-center gap-1 ${
                mode === 'other'
                  ? 'border-primary bg-[#f0fbf2] shadow-[0_2px_8px_rgba(12,131,31,0.15)]'
                  : 'border-border hover:border-[#b3e5bf]'
              }`}
            >
              <div className="text-2xl leading-none">🎁</div>
              <div
                className={`text-[13px] font-bold ${
                  mode === 'other' ? 'text-primary' : ''
                }`}
              >
                For Someone Else
              </div>
              <div className="text-[10px] text-muted-foreground">Pick on map</div>
            </button>
          </div>

          {/* SELF PANEL */}
          {mode === 'self' && (
            <div className="space-y-2">
              <div
                className={`rounded-lg px-3 py-3 text-xs flex items-center gap-2.5 ${
                  gpsState === 'ok'
                    ? 'bg-[#dcf3e1] text-primary'
                    : gpsState === 'error'
                    ? 'bg-[#fff5d6] text-[#8a6500]'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {gpsState === 'detecting' ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4 shrink-0" />
                )}
                <span className="flex-1 leading-snug">
                  {gpsState === 'detecting' && 'Detecting your location…'}
                  {gpsState === 'ok' && (
                    <>
                      <b>{areaName || 'Your location'}</b>
                      <br />
                      <span className="opacity-80 text-[10px]">
                        Tap below to use this · or Retry for fresh GPS
                      </span>
                    </>
                  )}
                  {gpsState === 'error' && gpsError}
                  {gpsState === 'idle' && lat != null && (
                    <>
                      <b>{areaName || 'Saved location'}</b>
                    </>
                  )}
                  {gpsState === 'idle' && lat == null && 'Getting your location…'}
                </span>
                {(gpsState === 'ok' || gpsState === 'error' || gpsState === 'idle') && (
                  <button
                    onClick={detectGps}
                    className="text-[11px] font-bold text-primary bg-white border border-primary rounded-md px-2.5 py-1.5 shrink-0 inline-flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {gpsState === 'ok' ? 'Refresh' : 'Retry'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* OTHER PANEL */}
          {mode === 'other' && (
            <div className="border-2 border-border rounded-xl overflow-hidden bg-muted">
              {/* Search */}
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
                        key={`${r.lat},${r.lon},${i}`}
                        onClick={() => pickFromSearch(r)}
                        className="w-full text-left px-3 py-2.5 border-b last:border-0 flex gap-2.5 hover:bg-muted/50"
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                        <div className="min-w-0 flex-1 leading-tight">
                          <div className="text-[13px] font-semibold truncate">
                            {shortLabel(r) || r.display_name?.split(',')[0]}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {r.display_name}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Map */}
              <div className="relative h-60 w-full">
                <MapContainer
                  center={mapCenter}
                  zoom={lat != null ? 16 : 12}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl
                >
                  <TileLayer
                    attribution="© OpenStreetMap"
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={19}
                  />
                  <InvalidateOnMount />
                  <Recenter to={lat != null && lng != null ? [lat, lng] : null} />
                  <MapClickHandler onPick={pickFromMap} />
                  {lat != null && lng != null && (
                    <Marker
                      position={[lat, lng]}
                      icon={DROP_PIN}
                      draggable
                      eventHandlers={{
                        dragend: async (e) => {
                          const p = (e.target as L.Marker).getLatLng();
                          await pickFromMap(p.lat, p.lng);
                        },
                      }}
                    />
                  )}
                </MapContainer>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[400] bg-black/80 text-white text-[11px] font-semibold px-3 py-1 rounded-full pointer-events-none whitespace-nowrap">
                  Tap the map or drag the pin to set location
                </div>
              </div>

              {/* Selected address */}
              <div className="bg-white px-3 py-2.5 border-t">
                <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mb-0.5">
                  Selected location
                </div>
                <div
                  className={`text-[13px] leading-snug break-words ${
                    address ? 'text-foreground font-medium' : 'text-muted-foreground italic'
                  }`}
                >
                  {address || 'Tap the map to select a location'}
                </div>
              </div>
            </div>
          )}

          {/* Confirm */}
          <Button
            onClick={confirm}
            disabled={!canConfirm}
            className="w-full h-12 text-sm font-extrabold tracking-wide"
            size="lg"
          >
            {mode === 'other' && <Gift className="h-4 w-4 mr-1.5" />}
            Use This Location
          </Button>
        </div>
      </div>
    </div>
  );
}
