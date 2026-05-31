'use client';

/**
 * Global error boundary — the last line of defense. Catches errors thrown in
 * the ROOT layout itself (which a normal error.tsx can't, because it renders
 * inside the layout). It must provide its own <html>/<body> because it
 * replaces the entire document when the layout fails.
 *
 * Kept dependency-free (no imported UI components, no fonts) so it can render
 * even when the app shell is broken.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 0,
          padding: '24px',
          textAlign: 'center',
          background: '#fafafa',
          color: '#111',
        }}
      >
        <div style={{ maxWidth: 360 }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: '#666', marginTop: 8 }}>
            The app ran into an unexpected problem. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#639922',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
