/**
 * Browser geolocation wrapper that returns a Promise.
 * Resolves to null on permission denied / unavailable rather than throwing,
 * so UIs can fall back to a manual location picker.
 */
export function getCurrentPosition(timeoutMs = 8000): Promise<GeolocationCoordinates | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 }
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
