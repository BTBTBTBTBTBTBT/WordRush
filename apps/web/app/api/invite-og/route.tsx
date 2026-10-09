import { ImageResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { inviteHeadline, inviteSubline, type InviteCopyInput, type InviteLinkKind } from '@wordle-duel/core';
import { renderWordociousOgImage } from '@/lib/og-image-renderer';
import { resolveInvitePreview } from '@/lib/invite-preview';

export const runtime = 'edge';

// The per-invite share preview (FRIDAY-QUEUE 9f): sender's mascot VS a "?", the game, "Johnny challenges
// you to CLASSIC", the time to beat for a race, the code small as a fallback. 1200x630, cached at the CDN
// per code (the invite never changes once sent). Unknown / expired codes fall back to the brand card.
//
// ART: the frame is code-drawn (purple/gold glossy tiles, Nunito Black, the house lettering gradient).
// The ChatGPT-designed frame + VS art slot in by dropping public/og/invite/frame-<variant>.png (1200x630)
// beside the cast PNGs: when present it is drawn behind everything.
async function loadPng(url: URL): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

const CACHE = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const kind: InviteLinkKind = sp.get('k') === 'friend' ? 'friend' : 'vs';
  const preview = await resolveInvitePreview(kind, sp.get('c') ?? '');
  if (preview.status === 'notfound') return renderWordociousOgImage();

  const origin = req.nextUrl.origin;
  const copy: InviteCopyInput = { variant: preview.variant, sender: preview.sender, game: preview.gameTitle, raceLine: preview.raceLine };
  const [font, wall, cast, frame] = await Promise.all([
    fetch(new URL('../../fonts/Nunito-Black.woff', import.meta.url)).then((r) => r.arrayBuffer()),
    loadPng(new URL('/og/og-wall.png', origin)),
    loadPng(new URL(`/og/invite/cast-${preview.castId}.png`, origin)),
    loadPng(new URL(`/og/invite/frame-${preview.variant}.png`, origin)),
  ]);

  const tile = (children: React.ReactNode, from: string, to: string) => (
    <div
      style={{
        width: 300, height: 300, borderRadius: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(160deg, ${from}, ${to})`, boxShadow: '0 18px 0 rgba(60,30,110,0.18), 0 30px 50px rgba(60,30,110,0.25)',
      }}
    >
      {children}
    </div>
  );

  const headline = inviteHeadline(copy);
  const sub = inviteSubline(copy);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', background: 'linear-gradient(135deg, #F3EEFF 0%, #FBEFFF 50%, #FFF1F7 100%)', fontFamily: 'Nunito' }}>
        {wall && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={wall as unknown as string} width={1200} height={630} style={{ position: 'absolute', top: 0, left: 0 }} alt="" />
        )}
        {frame && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={frame as unknown as string} width={1200} height={630} style={{ position: 'absolute', top: 0, left: 0 }} alt="" />
        )}

        {/* mascot  VS  ? */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 36, marginTop: -30 }}>
          {tile(
            cast
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={cast as unknown as string} width={260} height={260} alt="" />
              : <div style={{ display: 'flex', fontSize: 150, fontWeight: 900, color: '#ffffff' }}>{preview.sender.slice(0, 1).toUpperCase()}</div>,
            '#a78bfa', '#7c3aed',
          )}
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 900, color: '#f5a524', letterSpacing: -2 }}>VS</div>
          {tile(<div style={{ display: 'flex', fontSize: 190, fontWeight: 900, color: '#ffffff' }}>?</div>, '#fcd34d', '#f59e0b')}
        </div>

        <div style={{ display: 'flex', marginTop: 34, fontSize: 56, fontWeight: 900, letterSpacing: -1, backgroundImage: 'linear-gradient(135deg, #7c3aed, #ec4899)', backgroundClip: 'text', color: 'transparent', textAlign: 'center' }}>
          {headline}
        </div>
        <div style={{ display: 'flex', marginTop: 8, fontSize: 32, fontWeight: 800, color: '#3b1a78', textAlign: 'center' }}>{sub}</div>

        <div style={{ position: 'absolute', bottom: 22, right: 34, display: 'flex', fontSize: 22, fontWeight: 800, letterSpacing: 3, color: '#7c6aa8' }}>
          {preview.code}
        </div>
        <div style={{ position: 'absolute', bottom: 22, left: 34, display: 'flex', fontSize: 24, fontWeight: 900, letterSpacing: 2, color: '#7c3aed' }}>
          WORDOCIOUS
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: [{ name: 'Nunito', data: font, weight: 900, style: 'normal' }], headers: { 'Cache-Control': CACHE } },
  );
}
