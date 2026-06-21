'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Layers, Loader2, MapPin, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { geoSearch } from '@/lib/geo';

/**
 * Minimal shape of the Capacitor Geolocation plugin — declared locally so the
 * web build doesn't need @capacitor/geolocation installed. The actual plugin
 * is loaded at runtime only inside the native app.
 */
type NativeGeoPos = { coords: { latitude: number; longitude: number; accuracy?: number } };
type NativeGeoPerm = { location: string };
interface NativeGeo {
  checkPermissions: () => Promise<NativeGeoPerm>;
  requestPermissions: () => Promise<NativeGeoPerm>;
  getCurrentPosition: (opts: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  }) => Promise<NativeGeoPos>;
}

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

// When a GPS fix arrives, zoom in close so the user can actually orient
// themselves (rural OSM tiles are blank when zoomed out).
function FlyToFix({ fix }: { fix: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (fix) map.setView([fix.lat, fix.lng], 17, { animate: true });
  }, [fix, map]);
  return null;
}

// ----- Main -----

export default function LocationPicker({ value, onChange, defaultCenter }: Props) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoIsNote, setGeoIsNote] = useState(false);
  // Accuracy radius (metres) of the last GPS fix, for the uncertainty circle.
  const [accuracy, setAccuracy] = useState<number | null>(null);
  // Bumped each time a fresh GPS fix lands, to trigger a close zoom-in.
  const [gpsFix, setGpsFix] = useState<LatLng | null>(null);
  // Satellite vs map tiles — satellite helps rural users recognise their area.
  const [satellite, setSatellite] = useState(true);
  const watchRef = useRef<number | null>(null);
  // Browser location permission: 'granted' | 'denied' | 'prompt' | null (unknown)
  const [permission, setPermission] = useState<string | null>(null);
  // Whether to show the "GPS is weak / how to fix" help panel (poor accuracy).
  const [showAccuracyHelp, setShowAccuracyHelp] = useState(false);

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

  // Native (Capacitor) high-accuracy path — uses Android Fused Location
  // Provider, which is far more accurate than browser geolocation. Dynamically
  // imported so the web build doesn't require the Capacitor packages.
  async function tryNativeLocation(): Promise<boolean> {
    try {
      // Capacitor injects window.Capacitor at runtime in the native app only.
      const w = window as unknown as {
        Capacitor?: { isNativePlatform?: () => boolean };
      };
      if (!w.Capacitor?.isNativePlatform?.()) return false;

      // Load the plugin without letting TypeScript/webpack resolve the module
      // at build time (the package is only installed in the native build, not
      // on Vercel). The indirection via a variable specifier keeps the web
      // build from needing @capacitor/geolocation.
      const dynImport = new Function('m', 'return import(m)') as (
        m: string
      ) => Promise<unknown>;
      const mod = (await dynImport('@capacitor/geolocation').catch(
        () => null
      )) as { Geolocation?: NativeGeo } | null;
      const Geolocation = mod?.Geolocation;
      if (!Geolocation) return false;

      // Ensure permission (native prompt).
      try {
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted') {
          const req = await Geolocation.requestPermissions();
          if (req.location !== 'granted') {
            setPermission('denied');
            setGeoError(
              'Location permission is needed. Please enable it for the app, then try again.'
            );
            setLocating(false);
            return true; // handled (as a denial)
          }
        }
      } catch {
        /* checkPermissions may be unavailable — continue to getCurrentPosition */
      }

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 30_000,
        maximumAge: 0,
      });
      const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const acc = pos.coords.accuracy ?? 0;
      setAccuracy(acc);
      setGpsFix(ll);
      await pickAndReverseGeocode(ll);
      if (acc > 75) {
        setGeoIsNote(true);
        setShowAccuracyHelp(true);
        setGeoError(
          `Location is approximate (within ~${Math.round(acc)} m). Switch to Satellite and drag the pin onto your shop.`
        );
      } else {
        setShowAccuracyHelp(false);
        setGeoError(null);
      }
      setLocating(false);
      return true;
    } catch {
      return false; // fall back to browser geolocation
    }
  }

  function useMyLocation() {
    setLocating(true);
    setGeoError(null);
    setGeoIsNote(false);
    setAccuracy(null);
    setShowAccuracyHelp(false);

    // Prefer the native high-accuracy provider when available.
    tryNativeLocation().then((handled) => {
      if (handled) return;
      runBrowserLocation();
    });
  }

  function runBrowserLocation() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported by this browser.');
      setLocating(false);
      return;
    }
    // Cancel any in-flight watch.
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }

    let best: GeolocationPosition | null = null;
    let committed = false;
    let gotAny = false;
    const GOOD_ENOUGH_M = 20; // genuinely precise (true GPS) — commit & stop
    const SETTLE_AFTER_M = 50; // decent — keep refining a bit, then settle
    const MAX_WAIT_MS = 35_000; // patient like a maps app
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const consider = (pos: GeolocationPosition) => {
      gotAny = true;
      if (!best || pos.coords.accuracy < best.coords.accuracy) {
        best = pos;
        const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setAccuracy(pos.coords.accuracy);
        // Live-move the pin + circle as it tightens (like a maps app).
        setGpsFix(ll);
        pickAndReverseGeocode(ll);
      }
    };

    const finish = async () => {
      if (committed) return;
      committed = true;
      if (settleTimer) clearTimeout(settleTimer);
      clearTimeout(stopTimer);
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      if (!best) {
        setGeoError(
          'Could not get your location. Please search your area above, or drag the pin onto your shop using the satellite view.'
        );
        setLocating(false);
        return;
      }
      const ll = { lat: best.coords.latitude, lng: best.coords.longitude };
      const acc = best.coords.accuracy;
      setAccuracy(acc);
      setGpsFix(ll);
      await pickAndReverseGeocode(ll);

      if (acc > 75) {
        setGeoIsNote(true);
        setShowAccuracyHelp(true);
        setGeoError(
          `Location is approximate (within ~${Math.round(acc)} m). Switch to Satellite and drag the pin onto your shop.`
        );
      } else {
        setShowAccuracyHelp(false);
        setGeoError(null);
      }
      setLocating(false);
    };

    const stopTimer = setTimeout(finish, MAX_WAIT_MS);

    // (1) Immediate fix — allow a recent cached/network reading so we ALWAYS
    // get something fast and never falsely report "couldn't get location".
    navigator.geolocation.getCurrentPosition(
      (pos) => consider(pos),
      () => {
        /* ignore — the watch below is the real attempt */
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
    );

    // (2) High-accuracy watch — refines the pin as true GPS locks on.
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        consider(pos);
        const acc = pos.coords.accuracy;
        if (acc <= GOOD_ENOUGH_M) {
          finish(); // truly precise — done
        } else if (acc <= SETTLE_AFTER_M && !settleTimer) {
          // Decent fix — give GPS a few more seconds to tighten, then settle.
          settleTimer = setTimeout(finish, 6_000);
        }
      },
      (err) => {
        // Only treat as a hard error if we never got ANY reading (incl. the
        // instant getCurrentPosition above). Otherwise let the timer settle.
        if (err.code === err.PERMISSION_DENIED) {
          if (watchRef.current != null) {
            navigator.geolocation.clearWatch(watchRef.current);
            watchRef.current = null;
          }
          clearTimeout(stopTimer);
          if (settleTimer) clearTimeout(settleTimer);
          committed = true;
          setGeoError(
            'Location permission blocked. Allow location access in your browser settings, then try again — or drag the pin manually.'
          );
          setLocating(false);
        } else if (!gotAny) {
          // No GPS and no instant fix — let MAX_WAIT timer call finish(),
          // which will show the friendly fallback message.
        }
      },
      { enableHighAccuracy: true, timeout: MAX_WAIT_MS, maximumAge: 0 }
    );
  }

  // Clean up any active GPS watch on unmount.
  useEffect(() => {
    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, []);

  // Detect the browser's location-permission state up front, so we can guide
  // the user. The Permissions API isn't on every browser — degrade silently.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    let cancelled = false;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        if (cancelled) return;
        setPermission(status.state);
        status.onchange = () => setPermission(status.state);
      })
      .catch(() => {
        /* not supported — ignore */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
        {locating && (
          <span className="text-xs text-muted-foreground">
            {accuracy != null
              ? `Locating… ~${Math.round(accuracy)} m, improving`
              : 'Getting GPS… please wait outdoors'}
          </span>
        )}
      </div>

      {/* Map */}
      <div className="relative h-72 w-full rounded-md overflow-hidden border">
        {/* Map / Satellite toggle */}
        <button
          type="button"
          onClick={() => setSatellite((s) => !s)}
          className="absolute top-2 right-2 z-[1000] flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-xs font-medium shadow border hover:bg-white"
        >
          <Layers className="h-3.5 w-3.5" />
          {satellite ? 'Map' : 'Satellite'}
        </button>

        <MapContainer
          center={[initial.lat, initial.lng]}
          zoom={value ? 16 : 5}
          scrollWheelZoom
          className="h-full w-full"
        >
          {satellite ? (
            <>
              {/* Esri World Imagery — free satellite tiles, no API key. */}
              <TileLayer
                attribution='Tiles &copy; Esri'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
              {/* Transparent labels overlay (CARTO, OSM data) — shows village
                  names, roads, schools, temples even in rural areas, so users
                  can orient like on Google Maps. */}
              <TileLayer
                attribution='&copy; OpenStreetMap, &copy; CARTO'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
                maxZoom={20}
              />
            </>
          ) : (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          )}
          <ClickHandler onPick={pickAndReverseGeocode} />
          <Recenter target={value} />
          <FlyToFix fix={gpsFix} />
          {/* Accuracy circle — shows how uncertain the GPS fix is. */}
          {value && accuracy != null && accuracy > 30 && (
            <Circle
              center={[value.lat, value.lng]}
              radius={accuracy}
              pathOptions={{ color: '#0C831F', fillColor: '#0C831F', fillOpacity: 0.12, weight: 1 }}
            />
          )}
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={SHOP_PIN}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = (e.target as L.Marker).getLatLng();
                  setAccuracy(null); // user placed it manually — uncertainty gone
                  setShowAccuracyHelp(false);
                  setGeoError(null);
                  setGeoIsNote(false);
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

      {geoError && (
        <p className={`text-xs ${geoIsNote ? 'text-amber-600' : 'text-destructive'}`}>
          {geoError}
        </p>
      )}

      {/* Permission blocked — guide the user to re-enable it. */}
      {permission === 'denied' && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-foreground/80 space-y-1">
          <p className="font-medium text-destructive">Location access is blocked</p>
          <p>To use “Use my location”, allow location for this site:</p>
          <p>
            Tap the <span className="font-medium">lock / ⓘ icon</span> next to the
            web address → <span className="font-medium">Permissions</span> →
            set <span className="font-medium">Location</span> to{' '}
            <span className="font-medium">Allow</span>, then reload.
          </p>
          <p className="text-muted-foreground">
            You can also just search your area above and drag the pin.
          </p>
        </div>
      )}

      {/* Poor accuracy — explain how to get a precise GPS fix. */}
      {showAccuracyHelp && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 space-y-1.5">
          <p className="font-medium">Getting a more accurate location</p>
          <p>Your phone gave only an approximate position. To improve it:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>
              Turn on <span className="font-medium">High accuracy</span> location:
              Settings → Location → turn on{' '}
              <span className="font-medium">Google Location Accuracy</span>.
            </li>
            <li>
              Allow <span className="font-medium">Precise</span> (not Approximate)
              location for your browser in App settings.
            </li>
            <li>Go outdoors with open sky and try again.</li>
          </ul>
          <p className="font-medium pt-1">
            Easiest: tap <span className="underline">Satellite</span> above and drag
            the pin onto your shop’s roof — that’s always exact.
          </p>
        </div>
      )}
    </div>
  );
}
