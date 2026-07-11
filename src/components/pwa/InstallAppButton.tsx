'use client';

/**
 * InstallAppButton — a permanent, always-visible "Install app" CTA for the
 * landing page (unlike the auto-banner in PWARegistration, this never
 * disappears on dismissal — it only hides once the app is actually
 * installed / running standalone).
 *
 * Tap behavior by platform:
 *   - Chromium (Android Chrome, desktop Chrome/Edge/Brave): fires the
 *     native install prompt via the captured `beforeinstallprompt` event.
 *   - iOS Safari (no beforeinstallprompt): shows Add-to-Home-Screen steps.
 *   - Anything else: shows generic "open in Chrome → Install app" steps.
 */

import { useCallback, useEffect, useState } from 'react';
import { Download, X, Share, Plus } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isIos(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

export function InstallAppButton({ className }: { className?: string }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setInstallEvent(null);
      setShowHelp(false);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const onClick = useCallback(async () => {
    if (installEvent) {
      try {
        await installEvent.prompt();
        const choice = await installEvent.userChoice;
        if (choice.outcome === 'accepted') setInstalled(true);
      } catch {
        /* prompt already used or dismissed — fall through silently */
      } finally {
        setInstallEvent(null);
      }
      return;
    }
    // No native prompt available (iOS Safari, Firefox, in-app browsers…):
    // show manual instructions instead.
    setShowHelp(true);
  }, [installEvent]);

  // Hide entirely when already running as the installed app, and render
  // nothing on the server pass to avoid a hydration flash.
  if (!mounted || installed) return null;

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className={
          className ||
          'inline-flex items-center justify-center gap-2 bg-black text-white font-bold text-base px-6 py-3.5 rounded-full shadow-lg shadow-black/20 hover:bg-black/85 active:scale-[0.98] transition'
        }
      >
        <Download className="h-4 w-4" />
        Install app
      </button>

      {showHelp && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4 animate-in slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-base">Install Sarvopakar</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Get the app on your home screen — free, no app store needed.
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowHelp(false)}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIos() ? (
              <ol className="space-y-3 text-sm">
                <li className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-lg bg-brand-greenLight text-brand-green flex items-center justify-center shrink-0">
                    <Share className="h-4 w-4" />
                  </span>
                  Tap the <b>Share</b> button in Safari&apos;s toolbar
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-lg bg-brand-greenLight text-brand-green flex items-center justify-center shrink-0">
                    <Plus className="h-4 w-4" />
                  </span>
                  Choose <b>Add to Home Screen</b>
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-lg bg-brand-greenLight text-brand-green flex items-center justify-center shrink-0">
                    🏪
                  </span>
                  Tap <b>Add</b> — Sarvopakar appears on your home screen
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm">
                <li className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-lg bg-brand-greenLight text-brand-green flex items-center justify-center shrink-0 font-bold">
                    1
                  </span>
                  Open <b>sarvopakar.com</b> in <b>Chrome</b> on your phone
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-lg bg-brand-greenLight text-brand-green flex items-center justify-center shrink-0 font-bold">
                    2
                  </span>
                  Tap the <b>⋮ menu</b> → <b>Install app</b> (or <b>Add to Home screen</b>)
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-8 w-8 rounded-lg bg-brand-greenLight text-brand-green flex items-center justify-center shrink-0 font-bold">
                    3
                  </span>
                  Confirm — Sarvopakar installs like a regular app
                </li>
              </ol>
            )}
          </div>
        </div>
      )}
    </>
  );
}
