import { ImageResponse } from 'next/server';
import { MODES } from './modes.generated';

// Shared renderer for both the Open Graph image and Twitter card image.
// Lives outside `app/` (in lib/) so it doesn't accidentally register as a
// route. Both `app/opengraph-image.tsx` and `app/twitter-image.tsx` import
// and call this function; that lets them each declare the Next.js
// metadata exports (`runtime`, `size`, etc.) as literal values — which
// Next.js requires — while sharing the actual visual definition.

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = 'Wordocious — Daily Word Games';
export const OG_CONTENT_TYPE = 'image/png';

/**
 * Render the Wordocious brand card as a 1200×630 PNG. Uses the Nunito
 * weight-900 static font bundled under `app/fonts/` so the "WORDOCIOUS"
 * wordmark renders in the same black Nunito as the in-app header. Without
 * a bundled font, Satori would fall back to a generic system font and the
 * logo would look nothing like the brand.
 *
 * Note: must be a STATIC weight font file. Variable TTFs (with an `fvar`
 * table) crash the Satori version bundled with Next 13.5 at parse time —
 * hence the `@fontsource`-sourced weight-900 WOFF instead of Google's
 * variable-axis TTF.
 */

// §235: the pills carry the modes' REAL iconography (the founder: "logos,
// not abbreviations") — the same vectors the app tiles use. Classic's grid
// board and the Six/Seven hands are the app's custom SVGs; Succession,
// Deliverance, Gauntlet, ProperNoundle use their lucide glyphs; QuadWord and
// OctoWord's roman numerals ARE their logos. Satori can't render SVG <text>,
// so the hands' digit badges are positioned HTML overlays.
function modeBadgeIcon(id: string, accent: string): React.ReactNode {
  const stroke = { stroke: accent, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  switch (id) {
    case 'practice':
      return (
        <svg width="26" height="30" viewBox="0 0 20 24">
          {[0, 1, 2, 3, 4, 5].map((row) =>
            [0, 1, 2, 3, 4].map((col) => (
              <rect key={`${row}-${col}`} x={col * 4} y={row * 4} width="3.2" height="3.2" rx="0.6" fill={accent} opacity={0.85} />
            )),
          )}
        </svg>
      );
    case 'sequence':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24">
          <path d="M22 7 L13.5 15.5 L8.5 10.5 L2 17" {...stroke} />
          <path d="M16 7 L22 7 L22 13" {...stroke} />
        </svg>
      );
    case 'rescue':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24">
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" {...stroke} />
        </svg>
      );
    case 'gauntlet':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24">
          <path d="m12.5 17-.5-1-.5 1h1z" {...stroke} />
          <path d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z" {...stroke} />
          <circle cx="9" cy="12" r="1" fill={accent} />
          <circle cx="15" cy="12" r="1" fill={accent} />
        </svg>
      );
    case 'propernoundle':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24">
          <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.735H5.81a1 1 0 0 1-.957-.735L2.02 6.02a.5.5 0 0 1 .798-.52l4.276 3.664a1 1 0 0 0 1.516-.294z" {...stroke} />
          <path d="M5 21h14" {...stroke} />
        </svg>
      );
    case 'six':
      return (
        <svg width="28" height="30" viewBox="0 0 24 26">
          <path d="M16 13V6C16 5.17 15.33 4.5 14.5 4.5S13 5.17 13 6V11" stroke="#0e7490" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M13 5V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V11" stroke="#0e7490" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M10 4V3C10 2.17 9.33 1.5 8.5 1.5S7 2.17 7 3V11" stroke="#0e7490" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M7 4.5V4C7 3.17 6.33 2.5 5.5 2.5S4 3.17 4 4V14C4 19.52 8.48 24 14 24C16.76 24 19 21.76 19 19V13C19 12.17 18.33 11.5 17.5 11.5S16 12.17 16 13" stroke="#0e7490" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="11.5" cy="17" r="5.5" fill="#06b6d426" />
        </svg>
      );
    case 'seven':
      return (
        <svg width="28" height="30" viewBox="0 0 24 26">
          <path d="M8 13V6C8 5.17 8.67 4.5 9.5 4.5S11 5.17 11 6V11" stroke="#4d7c0f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M11 5V3.5C11 2.67 11.67 2 12.5 2S14 2.67 14 3.5V11" stroke="#4d7c0f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M14 4V3C14 2.17 14.67 1.5 15.5 1.5S17 2.17 17 3V11" stroke="#4d7c0f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M17 4.5V4C17 3.17 17.67 2.5 18.5 2.5S20 3.17 20 4V14C20 19.52 15.52 24 10 24C7.24 24 5 21.76 5 19V13C5 12.17 5.67 11.5 6.5 11.5S8 12.17 8 13" stroke="#4d7c0f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="12.5" cy="17" r="5.5" fill="#84cc1626" />
        </svg>
      );
    default:
      return null;
  }
}

/** Loads a bundled PNG for Satori (it can't decode WebP); null when it can't, so the card still renders. */
async function loadOgPng(url: URL): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/**
 * The finishing look (FINISH_SPEC E1): the home wallpaper behind everything,
 * the ten-character cast across the top (they spell WORDOCIOUS), the gradient
 * wordmark, and the daily games as tinted pills (never white). Both PNGs ship
 * in the bundle (public/og/), and a missing one only drops that layer.
 */
export async function renderWordociousOgImage(): Promise<ImageResponse> {
  const [nunitoData, wallData, castData] = await Promise.all([
    fetch(new URL('../app/fonts/Nunito-Black.woff', import.meta.url)).then((res) => res.arrayBuffer()),
    loadOgPng(new URL('../public/og/og-wall.png', import.meta.url)),
    loadOgPng(new URL('../public/og/og-cast.png', import.meta.url)),
  ]);

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
          background: 'linear-gradient(135deg, #F3EEFF 0%, #FBEFFF 50%, #FFF1F7 100%)',
          position: 'relative',
          fontFamily: 'Nunito',
        }}
      >
        {wallData && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={wallData as unknown as string}
            width={1200}
            height={630}
            style={{ position: 'absolute', top: 0, left: 0 }}
            alt=""
          />
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* The cast: ten characters spelling WORDOCIOUS (the brand mark now). */}
          {castData && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={castData as unknown as string} width={1000} height={136} alt="" />
          )}
          <div
            style={{
              fontSize: castData ? '100px' : '118px',
              fontWeight: 900,
              background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
              backgroundClip: 'text',
              color: 'transparent',
              letterSpacing: '-4px',
              lineHeight: 1,
              marginTop: castData ? '6px' : '0px',
              display: 'flex',
            }}
          >
            WORDOCIOUS
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: '40px',
              fontWeight: 800,
              color: '#3b1a78',
              marginTop: '10px',
              letterSpacing: '-0.5px',
              display: 'flex',
            }}
          >
            Daily Word Games
          </div>

          {/* Game mode pills — every daily mode with its REAL tile icon
              (§235), each pill tinted in its game's accent (A1: no white). */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '14px',
              marginTop: '28px',
              maxWidth: '1100px',
            }}
          >
            {MODES.filter((m) => m.sweep).map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 22px 8px 10px',
                  background: `${m.accentHex}1f`,
                  border: `2px solid ${m.accentHex}66`,
                  borderRadius: '999px',
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: `${m.accentHex}26`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  {m.romanNumeral ? (
                    <div style={{ fontSize: '16px', fontWeight: 900, color: m.accentHex, display: 'flex' }}>
                      {m.romanNumeral}
                    </div>
                  ) : (
                    modeBadgeIcon(m.id, m.accentHex)
                  )}
                  {/* Satori can't draw SVG <text>: the hands' digits overlay. */}
                  {m.id === 'six' && (
                    <div style={{ position: 'absolute', left: '15px', top: '20px', fontSize: '12px', fontWeight: 900, color: '#0e7490', display: 'flex' }}>6</div>
                  )}
                  {m.id === 'seven' && (
                    <div style={{ position: 'absolute', left: '17px', top: '20px', fontSize: '12px', fontWeight: 900, color: '#4d7c0f', display: 'flex' }}>7</div>
                  )}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#3b1a78', display: 'flex' }}>
                  {m.title}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer line */}
        <div
          style={{
            position: 'absolute',
            bottom: '26px',
            fontSize: '24px',
            fontWeight: 800,
            color: '#6d28d9',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span>Daily puzzles  ·  every game mode  ·  wordocious.com</span>
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
