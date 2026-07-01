'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginWithGoogle } from '@/lib/auth';
import { ApiError } from '@/lib/api';

/**
 * "Sign in with Google" using Google Identity Services (GIS).
 *
 * Loads Google's script, renders their official button, and on success sends
 * the returned ID token to our backend (/auth/google), which verifies it and
 * issues our app JWT. Requires NEXT_PUBLIC_GOOGLE_CLIENT_ID to be set.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (resp: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';

export function GoogleSignInButton({ next }: { next?: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !ref.current) return;

    let cancelled = false;

    function loadScript(): Promise<void> {
      return new Promise((resolve, reject) => {
        if (window.google?.accounts?.id) return resolve();
        const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
        if (existing) {
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject());
          return;
        }
        const s = document.createElement('script');
        s.src = GIS_SRC;
        s.async = true;
        s.defer = true;
        s.onload = () => resolve();
        s.onerror = () => reject();
        document.head.appendChild(s);
      });
    }

    loadScript()
      .then(() => {
        if (cancelled || !window.google || !ref.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (resp: { credential: string }) => {
            try {
              await loginWithGoogle(resp.credential);
              router.push(next || '/customer');
            } catch (err) {
              setError(
                err instanceof ApiError ? err.message : 'Google sign-in failed. Try again.'
              );
            }
          },
        });
        window.google.accounts.id.renderButton(ref.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 320,
        });
      })
      .catch(() => setError('Could not load Google sign-in.'));

    return () => {
      cancelled = true;
    };
  }, [clientId, next, router]);

  if (!clientId) return null; // Google sign-in not configured; hide silently.

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <div ref={ref} className="flex justify-center" />
      {error && <p className="text-xs text-destructive text-center">{error}</p>}
    </div>
  );
}
