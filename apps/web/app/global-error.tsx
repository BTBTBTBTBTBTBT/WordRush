'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { headingBox, headingSrc } from '@/components/ui/heading-art';
import { castArt } from '@/lib/season';
import { CAST } from '@/lib/mascots';

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

  // 2.8 look: the same screen as app/error.tsx, drawn inline (no app CSS, providers or image pipeline here): the
  // page wall, the WORDOCIOUS cast row (the ten heroes, static), then a soft card with R unplugged, the OOPS!
  // lettering, one warm line and the family purple button. Plain <img>s throughout.
  const heading = headingBox('oops', 40);
  return (
    <html lang="en">
      <head>
        <style>{`
          .ge-body { min-height: 100vh; margin: 0; padding: 12px 20px 32px; font-family: 'Nunito', ui-rounded, system-ui, sans-serif;
            background: #efe6ff url(/art/art-wall-home.webp) center / cover no-repeat fixed; display: flex; flex-direction: column; align-items: center; }
          @media (min-aspect-ratio: 1/1), (min-width: 1024px) { .ge-body { background-image: url(/art/art-wall-home-wide.webp); } }
          .ge-col { width: 100%; max-width: 384px; display: flex; flex-direction: column; flex: 1; }
          .ge-cast { display: flex; align-items: flex-end; width: 100%; padding-top: 4px; }
          .ge-cast > span { position: relative; min-width: 0; width: 0; margin-right: -2.2%; }
          .ge-cast > span:nth-child(even) { margin-bottom: 7px; }
          .ge-cast > span:last-child { margin-right: 0; }
          .ge-cast img { position: absolute; max-width: none; filter: drop-shadow(0 3px 4px rgba(60, 30, 110, 0.18)); }
          .ge-main { flex: 1; display: flex; align-items: center; justify-content: center; padding-top: 12px; }
          .ge-card { width: 100%; text-align: center; border-radius: 24px; padding: 20px 24px 22px; box-sizing: border-box;
            background: linear-gradient(#7c3aed20, #7c3aed20), #ffffff; border: 1.5px solid #7c3aed45;
            box-shadow: inset 0 10px 0 #7c3aed, 0 14px 36px #7c3aed2e; color: #3b1a78; }
          .ge-card p { color: #5b4a7d; }
          @media (prefers-color-scheme: dark) {
            .ge-body { background-color: #120d1f; }
            .ge-card { background: linear-gradient(#7c3aed20, #7c3aed20), #261d3f; color: #f1e9ff; }
            .ge-card p { color: #cdbfe8; }
          }
        `}</style>
      </head>
      <body className="ge-body">
        <div className="ge-col">
          {/* The cast row: the ten heroes spelling WORDOCIOUS (lib/season castArt, each cut to its measured box). */}
          <div className="ge-cast" aria-hidden="true">
            {CAST.map((id) => {
              const art = castArt(id, null);
              return (
                <span key={id} style={{ flex: `${art.aspect.toFixed(3)} 1 0`, aspectRatio: `${art.aspect.toFixed(4)}` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={art.src} alt="" width={art.artSize} height={art.artSize} draggable={false} style={{ width: art.layout.width, height: 'auto', left: art.layout.left, top: art.layout.top }} />
                </span>
              );
            })}
          </div>
          <div className="ge-main">
            <div className="ge-card" role="alert">
              {/* R, unplugged (docs/ART_SPEC.md §7). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/art/art-scene-r-unplugged.webp"
                alt=""
                aria-hidden="true"
                width={169}
                height={140}
                style={{ display: 'block', margin: '0 auto 8px', width: 169, maxWidth: '60%', height: 'auto' }}
              />
              <h1 style={{ margin: '4px 0 8px', lineHeight: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={headingSrc('oops')} alt="Something went wrong" width={heading.w} height={heading.h} style={{ display: 'block', margin: '0 auto', width: '100%', maxWidth: heading.w, height: 'auto' }} />
              </h1>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, margin: '0 0 1.25rem' }}>
                Don&apos;t worry, your streak is safe.
              </p>
              {/* The family purple button, inline (the app's button CSS is not loaded here). */}
              <button
                onClick={reset}
                style={{
                  width: '100%',
                  height: 52,
                  padding: '0 18px',
                  marginBottom: 4,
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontWeight: 900,
                  fontSize: 16,
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
        </div>
      </body>
    </html>
  );
}
