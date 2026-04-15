import { ImageResponse } from 'next/server';

// Shared renderer for both the Open Graph image and Twitter card image.
// Lives outside `app/` (in lib/) so it doesn't accidentally register as a
// route. Both `app/opengraph-image.tsx` and `app/twitter-image.tsx` import
// and call this function; that lets them each declare the Next.js
// metadata exports (`runtime`, `size`, etc.) as literal values — which
// Next.js requires — while sharing the actual visual definition.

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = 'SpellStrike — Epic Word Battles';
export const OG_CONTENT_TYPE = 'image/png';

/**
 * Render the SpellStrike brand card as a 1200×630 PNG. Uses the Nunito
 * weight-900 static font bundled under `app/fonts/` so the "SPELLSTRIKE"
 * wordmark renders in the same black Nunito as the in-app header. Without
 * a bundled font, Satori would fall back to a generic system font and the
 * logo would look nothing like the brand.
 *
 * Note: must be a STATIC weight font file. Variable TTFs (with an `fvar`
 * table) crash the Satori version bundled with Next 13.5 at parse time —
 * hence the `@fontsource`-sourced weight-900 WOFF instead of Google's
 * variable-axis TTF.
 */
export async function renderSpellstrikeOgImage(): Promise<ImageResponse> {
  const nunitoData = await fetch(
    new URL('../app/fonts/Nunito-Black.woff', import.meta.url),
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f8f7ff 0%, #ede5ff 50%, #f3f0ff 100%)',
          position: 'relative',
          fontFamily: 'Nunito',
        }}
      >
        {/* Decorative top accent — brand gradient bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '12px',
            background: 'linear-gradient(90deg, #a78bfa, #ec4899, #7c3aed)',
            display: 'flex',
          }}
        />

        {/* Main card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '72px 96px',
            background: '#ffffff',
            borderRadius: '36px',
            border: '3px solid #ede9f6',
            boxShadow: '0 20px 60px rgba(124, 58, 237, 0.18)',
          }}
        >
          {/* Logo — SPELLSTRIKE in Nunito 900 with the brand gradient */}
          <div
            style={{
              fontSize: '128px',
              fontWeight: 900,
              background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
              backgroundClip: 'text',
              color: 'transparent',
              letterSpacing: '-4px',
              lineHeight: 1,
              display: 'flex',
            }}
          >
            SPELLSTRIKE
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: '36px',
              fontWeight: 800,
              color: '#6b7280',
              marginTop: '24px',
              letterSpacing: '-0.5px',
              display: 'flex',
            }}
          >
            Epic Word Battles
          </div>

          {/* Game mode pills */}
          <div
            style={{
              display: 'flex',
              gap: '18px',
              marginTop: '44px',
            }}
          >
            {['Classic', 'QuadWord', 'OctoWord', 'Gauntlet'].map((mode) => (
              <div
                key={mode}
                style={{
                  padding: '12px 28px',
                  background: '#f3f0ff',
                  border: '2px solid #c4b5fd',
                  borderRadius: '999px',
                  fontSize: '22px',
                  fontWeight: 800,
                  color: '#5b21b6',
                  display: 'flex',
                }}
              >
                {mode}
              </div>
            ))}
          </div>
        </div>

        {/* Footer tagline */}
        <div
          style={{
            position: 'absolute',
            bottom: '36px',
            fontSize: '24px',
            fontWeight: 700,
            color: '#7c3aed',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span>Daily puzzles  ·  7 game modes  ·  spellstrike.vercel.app</span>
        </div>
      </div>
    ),
    {
      width: OG_SIZE.width,
      height: OG_SIZE.height,
      fonts: [
        {
          name: 'Nunito',
          data: nunitoData,
          style: 'normal',
          weight: 900,
        },
      ],
    },
  );
}
