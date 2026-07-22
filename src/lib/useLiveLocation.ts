/**
 * Native location bridge — used by useLiveLocation to keep tracking when the
 * site runs inside the Sarvopakar Android app (Capacitor WebView).
 *
 * Honest capability note: this uses the Capacitor Geolocation plugin when the
 * APK ships it. Until that plugin is added to the Android project, these
 * helpers report "not available" and callers fall back to web geolocation
 * (foreground-only). True screen-off background tracking additionally needs a
 * foreground-service plugin in the APK — planned for a future app build.
 */

type CapGeoPlugin = {
  requestPermissions?: () => Promise<{ location?: string }>;
  watchPosition: (
    options: { enableHighAccuracy?: boolean; timeout?: number },
    cb: (
      position: { coords?: { latitude: number; longitude: number } } | null,
      err?: unknown
    ) => void
  ) => Promise<string>;
  clearWatch: (opts: { id: string }) => Promise<void>;
};

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  Plugins?: { Geolocation?: CapGeoPlugin };
};

function getGeo(): CapGeoPlugin | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.Geolocation ?? null;
}

/** True when running in the native app AND its Geolocation plugin is present. */
export function hasNativeBackgroundLocation(): boolean {
  return getGeo() !== null;
}

/**
 * Start the native position watcher. Resolves to a stop function (or null if
 * unavailable / permission denied — the caller should then use the web path).
 */
export async function startNativeLocationWatcher(
  onPosition: (lat: number, lng: number) => void
): Promise<(() => void) | null> {
  const geo = getGeo();
  if (!geo) return null;

  try {
    if (geo.requestPermissions) {
      const perm = await geo.requestPermissions();
      if (perm.location && perm.location !== 'granted') return null;
    }

    const watchId = await geo.watchPosition(
      { enableHighAccuracy: true, timeout: 15_000 },
      (position) => {
        const lat = position?.coords?.latitude;
        const lng = position?.coords?.longitude;
        if (typeof lat === 'number' && typeof lng === 'number') {
          onPosition(lat, lng);
        }
      }
    );

    return () => {
      geo.clearWatch({ id: watchId }).catch(() => {
        /* already cleared */
      });
    };
  } catch {
    return null;
  }
}
