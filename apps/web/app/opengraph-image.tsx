import { ImageResponse } from 'next/server';

export const runtime = 'edge';

export const alt = 'SpellStrike - Epic Word Battles';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
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
        }}
      >
        {/* Decorative top accent */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '8px',
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
            padding: '60px 80px',
            background: '#ffffff',
            borderRadius: '32px',
            border: '3px solid #ede9f6',
            boxShadow: '0 20px 60px rgba(124, 58, 237, 0.15)',
          }}
        >
          {/* Logo */}
          <div
            style={{
              fontSize: '96px',
              fontWeight: 900,
              background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
              backgroundClip: 'text',
              color: 'transparent',
              letterSpacing: '-2px',
              lineHeight: 1,
              display: 'flex',
            }}
          >
            SPELLSTRIKE
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: '32px',
              fontWeight: 800,
              color: '#6b7280',
              marginTop: '20px',
              display: 'flex',
            }}
          >
            Epic Word Battles
          </div>

          {/* Game mode pills */}
          <div
            style={{
              display: 'flex',
              gap: '16px',
              marginTop: '36px',
            }}
          >
            {['Classic', 'QuadWord', 'OctoWord', 'Gauntlet'].map((mode) => (
              <div
                key={mode}
                style={{
                  padding: '10px 24px',
                  background: '#f3f0ff',
                  border: '2px solid #c4b5fd',
                  borderRadius: '20px',
                  fontSize: '20px',
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

        {/* URL at bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            fontSize: '22px',
            fontWeight: 700,
            color: '#9ca3af',
            display: 'flex',
          }}
        >
          spellstrike.vercel.app
        </div>
      </div>
    ),
    { ...size }
  );
}
