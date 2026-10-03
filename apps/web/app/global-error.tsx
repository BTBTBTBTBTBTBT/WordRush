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

  // BI24: the same look as app/error.tsx, drawn inline (no app CSS here): R
  // unplugged on a lavender wash (never white), the gradient caps headline,
  // one warm line and the candy button. No bordered box.
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
          }}
        >
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
            {/* The brand gradient caps headline (PAGE_TITLE_GRADIENTS.brand), inline. */}
            <h1
              style={{
                fontSize: '1.375rem',
                fontWeight: 900,
                margin: '0 0 0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                lineHeight: 1.15,
                background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
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
