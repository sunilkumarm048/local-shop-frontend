'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import Link from 'next/link';
import { Loader2, MapPin } from 'lucide-react';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface PageProps {
  params: Promise<{ code: string }>;
}

type State =
  | { kind: 'loading' }
  | { kind: 'blank' }
  | { kind: 'unknown' }
  | { kind: 'error' };

/**
 * QR landing page.  Printed flyers encode  <SITE>/q/<code>.
 * We resolve the code via the backend, then:
 *   - linked + approved shop -> redirect to that shop's page
 *   - blank (not yet assigned) -> friendly "coming soon" screen
 *   - unknown code            -> not-found screen
 */
export default function QrRedirectPage({ params }: PageProps) {
  const { code } = use(params);
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_URL}/qr/${encodeURIComponent(code)}/resolve`);
        if (cancelled) return;

        if (res.status === 404) {
          setState({ kind: 'unknown' });
          return;
        }
        if (!res.ok) {
          setState({ kind: 'error' });
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        if (data.status === 'linked' && data.shopId) {
          // Redirect straight to the shop page.
          router.replace(`/customer/shop/${data.shopId}`);
        } else if (data.status === 'blank') {
          setState({ kind: 'blank' });
        } else {
          setState({ kind: 'unknown' });
        }
      } catch {
        if (!cancelled) setState({ kind: 'error' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, router]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        {state.kind === 'loading' && (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">
              Opening shop…
            </p>
          </>
        )}

        {state.kind === 'blank' && (
          <>
            <MapPin className="h-10 w-10 mx-auto text-primary" />
            <h1 className="mt-4 text-xl font-bold">Coming soon!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This shop isn&apos;t set up on Sarvopakar yet. Check back soon — or
              explore other shops near you.
            </p>
            <Link
              href="/customer"
              className="inline-block mt-5 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold"
            >
              Explore Sarvopakar
            </Link>
          </>
        )}

        {state.kind === 'unknown' && (
          <>
            <h1 className="text-xl font-bold">Code not recognised</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This QR code isn&apos;t valid. If you scanned a shop flyer, please
              tell the shop owner.
            </p>
            <Link
              href="/customer"
              className="inline-block mt-5 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold"
            >
              Go to Sarvopakar
            </Link>
          </>
        )}

        {state.kind === 'error' && (
          <>
            <h1 className="text-xl font-bold">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Couldn&apos;t open this shop right now. Please try again in a moment.
            </p>
            <Link
              href="/customer"
              className="inline-block mt-5 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold"
            >
              Go to Sarvopakar
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
