'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Mic, MicOff, X, HelpCircle, Loader2 } from 'lucide-react';

import { useAuth } from '@/stores/auth';
import { useUser } from '@/hooks/useUser';
import { logout } from '@/lib/auth';
import { useSpeechRecognition } from '@/lib/voice/useSpeechRecognition';
import {
  matchIntent,
  intentsForScope,
  type VoiceScope,
  type VoiceContext,
} from '@/lib/voice/intents';

/**
 * Floating voice button — global FAB.
 *
 *   - Hidden on /login, /signup, and unauthenticated visits to landing pages.
 *   - Hidden entirely if the browser doesn't support Web Speech API
 *     (Firefox today, older browsers). We don't show a non-functional button.
 *   - Tap → modal-style listening overlay with interim transcript, mic
 *     animation, and a "What can I say?" help expander.
 *   - On final transcript, the intent matcher runs against the active scope
 *     (customer / shop / delivery / admin based on current pathname).
 */

const HIDDEN_PATHS = new Set(['/login', '/signup']);

function scopeFromPathname(pathname: string): VoiceScope | null {
  if (pathname.startsWith('/shop')) return 'shop';
  if (pathname.startsWith('/delivery')) return 'delivery';
  if (pathname.startsWith('/admin')) return 'admin';
  if (
    pathname === '/' ||
    pathname.startsWith('/customer') ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/transport')
  ) {
    return 'customer';
  }
  return null;
}

export function VoiceButton() {
  const pathname = usePathname();
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const { user } = useUser();

  const [open, setOpen] = useState(false);
  const [lastResult, setLastResult] = useState<{
    transcript: string;
    intentLabel: string | null;
  } | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const scope = useMemo(() => scopeFromPathname(pathname), [pathname]);

  // Build the action context only when needed.
  const buildContext = useCallback(
    (): VoiceContext => ({
      router,
      pathname,
      onLogout: async () => {
        await logout();
        router.push('/login');
      },
    }),
    [router, pathname]
  );

  const handleFinal = useCallback(
    (transcript: string) => {
      const match = matchIntent(transcript, { roleScope: scope });
      if (match) {
        setLastResult({ transcript, intentLabel: match.intent.description });
        // Close briefly after a successful action.
        setTimeout(() => setOpen(false), 800);
        match.intent.run(buildContext());
      } else {
        setLastResult({ transcript, intentLabel: null });
      }
    },
    [scope, buildContext]
  );

  const { supported, listening, interim, error, start, stop } = useSpeechRecognition({
    onFinal: handleFinal,
  });

  // Auto-start listening when the overlay opens, auto-stop when it closes.
  useEffect(() => {
    if (open && supported) start();
    if (!open) stop();
  }, [open, supported, start, stop]);

  // ---- visibility gates ----
  if (!supported) return null;
  if (HIDDEN_PATHS.has(pathname)) return null;
  // Customer pages get the AI VoiceAssistant instead (same corner) — don't
  // stack two mic buttons there.
  if (scope === 'customer') return null;
  // Show on the landing page even when unauthenticated, but only if there's
  // a token (otherwise the user can't do much anyway).
  if (!token || !user) return null;

  return (
    <>
      {/* FAB */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Voice commands"
        className="fixed bottom-4 right-4 z-40 h-12 w-12 rounded-full bg-brand-green text-white shadow-lg flex items-center justify-center hover:bg-brand-green/90 transition-colors"
      >
        <Mic className="h-5 w-5" />
      </button>

      {/* Listening overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4 animate-in slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    listening ? 'bg-red-500 animate-pulse' : 'bg-muted-foreground'
                  }`}
                />
                <h2 className="text-base font-semibold">
                  {listening ? 'Listening…' : 'Voice command'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mic indicator */}
            <div className="flex items-center justify-center py-3">
              <div
                className={`h-20 w-20 rounded-full flex items-center justify-center ${
                  listening
                    ? 'bg-brand-greenLight ring-4 ring-brand-green/30 animate-pulse'
                    : 'bg-muted'
                }`}
              >
                {listening ? (
                  <Mic className="h-9 w-9 text-brand-green" />
                ) : (
                  <MicOff className="h-9 w-9 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Interim / final transcript */}
            <div className="min-h-[60px] text-center px-3">
              {interim && (
                <p className="text-base italic text-muted-foreground">{interim}</p>
              )}
              {lastResult && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">&ldquo;{lastResult.transcript}&rdquo;</p>
                  {lastResult.intentLabel ? (
                    <p className="text-xs text-brand-green flex items-center justify-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {lastResult.intentLabel}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      I didn&apos;t catch a command. Try the suggestions below.
                    </p>
                  )}
                </div>
              )}
              {!interim && !lastResult && !error && listening && (
                <p className="text-sm text-muted-foreground">Try &ldquo;open cart&rdquo;</p>
              )}
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            {/* Help expander */}
            <div className="border-t pt-3">
              <button
                type="button"
                onClick={() => setShowHelp((v) => !v)}
                className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                {showHelp ? 'Hide commands' : 'What can I say?'}
              </button>
              {showHelp && <HelpPanel scope={scope} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function HelpPanel({ scope }: { scope: VoiceScope | null }) {
  const intents = useMemo(() => intentsForScope(scope), [scope]);
  // Show one example phrase per intent so the list stays scannable.
  return (
    <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
      {intents.map((intent) => (
        <li key={intent.id} className="flex items-baseline gap-1.5">
          <span className="text-muted-foreground">&ldquo;{intent.phrases[0]}&rdquo;</span>
          <span className="text-muted-foreground/60">— {intent.description}</span>
        </li>
      ))}
    </ul>
  );
}
