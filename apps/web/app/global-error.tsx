'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// Catches errors thrown in the root layout itself (the regular error.tsx
// boundary can't). Renders without the app's layout/CSS, so it must supply its
// own <html>/<body> and inline styles.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 0,
          padding: '1rem',
          fontFamily: 'system-ui, sans-serif',
          backgroundColor: '#f8f7ff',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          {/* R, unplugged (docs/ART_SPEC.md §7). A plain <img>: this screen
              renders without the app's layout, CSS or image pipeline. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/art/art-scene-r-unplugged.webp"
            alt=""
            aria-hidden="true"
            width={169}
            height={140}
            style={{ display: 'block', margin: '0 auto 1rem', width: 169, maxWidth: '60%', height: 'auto' }}
          />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: '0 0 0.5rem', color: '#1f2937' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '0.875rem', fontWeight: 700, margin: '0 0 1.5rem', color: '#6b7280' }}>
            Don&apos;t worry, your streak is safe.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '0.625rem 1.5rem',
              borderRadius: '0.75rem',
              border: 'none',
              cursor: 'pointer',
              color: '#fff',
              fontWeight: 900,
              fontSize: '0.875rem',
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              boxShadow: '0 4px 0 #4c1d95',
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
