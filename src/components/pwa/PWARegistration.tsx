'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, X, Share, Plus } from 'lucide-react';

/**
 * PWA bootstrap.
 *
 *   - Registers /sw.js on mount (production only — in dev there's no SW).
 *   - Watches `beforeinstallprompt` for Chromium browsers: stashes the
 *     event, renders a small "Install" banner, and triggers the native
 *     prompt on tap.
 *   - On iOS Safari (which doesn't fire `beforeinstallprompt`), shows an
 *     "Add to Home Screen" instruction card instead.
 *   - Persists dismissal in localStorage so it doesn't keep nagging.
 *
 * This component renders nothing 99% of the time — only the install banner,
 * and only when appropriate.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'localshop:pwa-install-dismissed';

function dismissedRecently(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || '0');
    if (!at) return false;
    // Suppress for 14 days after dismiss.
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;
    return Date.now() - at < fourteenDays;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // Both spellings — Chromium uses the matchMedia query, iOS Safari uses
  // navigator.standalone.
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  // On iOS, Chrome / Firefox / etc all use WebKit and report differently,
  // but only Safari supports add-to-home-screen.
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && isSafari;
}

export function PWARegistration() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // 1. Register service worker.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Skip dev mode — Next.js dev server doesn't serve a useful SW environment.
    if (process.env.NODE_ENV !== 'production') return;

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => console.warn('[pwa] sw registration failed:', err));
    };
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });
    return () => window.removeEventListener('load', onLoad);
  }, []);

  // 2. Capture the install prompt on Chromium.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) return; // already installed
    if (dismissedRecently()) return;

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstallEvent(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // 3. iOS Safari has no event — decide whether to show instructions.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) return;
    if (dismissedRecently()) return;
    if (!isIosSafari()) return;
    // Delay slightly so it doesn't appear in the first paint.
    const t = setTimeout(() => setShowIosInstructions(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const onInstall = useCallback(async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === 'dismissed') markDismissed();
    } catch {
      /* user dismissed the OS prompt */
    } finally {
      setInstallEvent(null);
    }
  }, [installEvent]);

  const onDismiss = useCallback(() => {
    markDismissed();
    setDismissed(true);
    setInstallEvent(null);
    setShowIosInstructions(false);
  }, []);

  if (dismissed) return null;

  // Chromium / Edge / Brave path — native install prompt available.
  if (installEvent) {
    return (
      <InstallBanner onInstall={onInstall} onDismiss={onDismiss} />
    );
  }

  // iOS Safari path — manual instructions.
  if (showIosInstructions) {
    return <IosInstructionCard onDismiss={onDismiss} />;
  }

  return null;
}

// ============================================================

function InstallBanner({
  onInstall,
  onDismiss,
}: {
  onInstall: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-[360px] z-50 bg-white border shadow-lg rounded-lg p-3 flex items-center gap-3 animate-in slide-in-from-bottom-4">
      <div className="h-10 w-10 rounded-lg bg-brand-greenLight flex items-center justify-center text-xl shrink-0">
        🏪
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">Install Local Shop</div>
        <div className="text-xs text-muted-foreground">
          Add to your home screen for fast access.
        </div>
      </div>
      <button
        type="button"
        onClick={onInstall}
        className="bg-brand-green text-white text-xs font-bold px-3 py-2 rounded-md flex items-center gap-1.5 hover:bg-brand-green/90 shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        Install
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function IosInstructionCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-white border shadow-lg rounded-lg p-4 animate-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-brand-greenLight flex items-center justify-center text-xl shrink-0">
          🏪
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Install Local Shop</div>
          <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Tap <Share className="inline h-3.5 w-3.5 align-text-bottom" /> below, then choose{' '}
            <span className="inline-flex items-center gap-0.5 font-medium">
              <Plus className="h-3 w-3" />
              Add to Home Screen
            </span>
            .
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
