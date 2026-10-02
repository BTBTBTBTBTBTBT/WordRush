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

  // G5: the same tinted card + candy button as app/error.tsx, drawn inline
  // (no app CSS here): a lavender wash with the brand top bar, never white.
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
          fontFamily: "'Nunito', ui-rounded, system-ui, sans-serif",
          backgroundColor: '#f4effe',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 360,
            textAlign: 'center',
            background: '#efe6fd',
            border: '1.5px solid #d8c6fa',
            borderRadius: 24,
            overflow: 'hidden',
            boxShadow: '0 14px 36px rgba(124, 58, 237, 0.18)',
          }}
        >
          <div aria-hidden="true" style={{ height: 10, background: 'linear-gradient(90deg, #a78bfa, #ec4899, #fbbf24)' }} />
          <div style={{ padding: '1.25rem 1.5rem' }}>
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
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: '0 0 0.5rem', color: '#2e1065' }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: '0.875rem', fontWeight: 700, margin: '0 0 1.25rem', color: '#6f5f8f' }}>
              Don&apos;t worry, your streak is safe.
            </p>
            {/* The candy button (A8), inline. */}
            <button
              onClick={reset}
              style={{
                height: 40,
                padding: '0 18px',
                marginBottom: 4,
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                color: '#fff',
                fontFamily: 'inherit',
                fontWeight: 900,
                fontSize: 14,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                background: 'linear-gradient(#a66bff, #6d28d9)',
                boxShadow: 'inset 0 0 0 2px #f5c542, 0 4px 0 #471a8d, 0 9px 14px rgba(59, 26, 120, 0.28)',
                textShadow: '1.5px 0 0 #3b1a78, -1.5px 0 0 #3b1a78, 0 1.5px 0 #3b1a78, 0 -1.5px 0 #3b1a78, 0 3px 4px rgba(40, 10, 80, 0.35)',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
