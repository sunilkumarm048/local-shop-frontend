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
