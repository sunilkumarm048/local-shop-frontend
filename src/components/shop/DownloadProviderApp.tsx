'use client';

/**
 * DownloadProviderApp — a compact banner for provider surfaces pointing to
 * the native Android APK (served from /sarvopakar.apk in public/).
 *
 * The native app is what enables the call-style loud order ring even when
 * the app is fully closed — browsers and the PWA cannot do that. So this
 * banner nudges providers toward the APK, and hides itself when:
 *   - already running inside the native app (Capacitor), or
 *   - the provider dismissed it (remembered for 30 days), or
 *   - on desktop-sized screens where an Android APK makes no sense.
 */

import { useEffect, useState } from 'react';
import { Smartphone, X, Download } from 'lucide-react';

import { isNativeApp } from '@/lib/nativePush';

const DISMISS_KEY = 'sarvopakar:provider-apk-dismissed';
const DISMISS_DAYS = 30;

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || '0');
    return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function DownloadProviderApp() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isNativeApp()) return; // already in the APK — nothing to sell
    if (dismissedRecently()) return;
    // Android APK is only installable on Android devices.
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (!isAndroid) return;
    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  return (
    <div className="rounded-xl border border-brand-green/30 bg-brand-greenLight px-4 py-3 flex items-start gap-3 mb-4">
      <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-brand-green shrink-0">
        <Smartphone className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-brand-green">
          Get the Sarvopakar Provider app
        </div>
        <div className="text-xs text-brand-green/85 mt-0.5">
          Rings loudly for every new order — even when the app is closed.
          Recommended for all providers.
        </div>
      </div>
      <a
        href="/sarvopakar.apk"
        download
        className="shrink-0 inline-flex items-center gap-1.5 bg-brand-green text-white text-xs font-bold px-3 py-2 rounded-md hover:bg-brand-green/90"
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-brand-green/70 hover:text-brand-green shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
