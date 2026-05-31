'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary. Next.js renders this when a page or its data
 * throws during render. Replaces the blank white screen / raw error overlay
 * with a friendly retry. `reset()` re-renders the segment without a full
 * reload, so a transient failure (e.g. a slow API that recovered) can recover
 * in place.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the console so you can see it in browser devtools / logs.
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 gap-4">
      <div className="text-5xl">😕</div>
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        We hit a snag loading this page. It might be a temporary hiccup — try
        again in a moment.
      </p>
      <div className="flex gap-3 mt-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = '/')}>
          Go home
        </Button>
      </div>
    </div>
  );
}
