/**
 * Browser geolocation wrapper that returns a Promise.
 * Resolves to null on permission denied / unavailable rather than throwing,
 * so UIs can fall back to a manual location picker.
 */
export function getCurrentPosition(timeoutMs = 15000): Promise<GeolocationCoordinates | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}

/**
 * Human-friendly distance label, Google-"near me" style.
 *   0.45 km -> "450 m"
 *   1.234 km -> "1.2 km"
 * Sub-kilometre rounds to the nearest 10 m; otherwise one decimal of km.
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    const m = Math.round((km * 1000) / 10) * 10;
    return `${m} m`;
  }
  return `${km.toFixed(1)} km`;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export interface GeoResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

/**
 * Address search via our backend proxy (Ola Maps in India, OSM fallback).
 * Returns [] on any error so callers can keep working.
 */
export async function geoSearch(query: string): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const res = await fetch(`${API_URL}/geo/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

/** Reverse geocode (coords → address) via our backend proxy. */
export async function geoReverse(
  lat: number,
  lng: number
): Promise<{ address: string; areaName: string }> {
  try {
    const res = await fetch(`${API_URL}/geo/reverse?lat=${lat}&lng=${lng}`);
    if (!res.ok) throw new Error('reverse failed');
    const data = await res.json();
    return {
      address: data.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      areaName: data.areaName || '',
    };
  } catch {
    return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, areaName: '' };
  }
}

/** Road distance + travel time for one destination, from /api/geo/route-distance. */
export interface RoadDistance {
  km: number;
  mins: number | null;
}

/**
 * Road distances from the customer to up to 20 provider coordinates, via the
 * backend's Ola Distance Matrix proxy. Returns null when unavailable (no key,
 * API down) — callers keep their straight-line estimate.
 */
export async function fetchRoadDistances(
  origin: { lat: number; lng: number },
  dests: Array<{ lat: number; lng: number }>
): Promise<Array<RoadDistance | null> | null> {
  if (!dests.length) return [];
  try {
    const destsParam = dests
      .slice(0, 20)
      .map((d) => `${d.lat},${d.lng}`)
      .join('|');
    const res = await fetch(
      `${API_URL}/geo/route-distance?olat=${origin.lat}&olng=${origin.lng}&dests=${encodeURIComponent(destsParam)}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { results: Array<RoadDistance | null> | null };
    return data.results;
  } catch {
    return null;
  }
}
