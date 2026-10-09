import { ImageResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { inviteHeadline, inviteSubline, type InviteCopyInput, type InviteLinkKind, type InviteVariant } from '@wordle-duel/core';
import { renderWordociousOgImage } from '@/lib/og-image-renderer';
import { resolveInvitePreview } from '@/lib/invite-preview';

export const runtime = 'edge';

// The per-invite share preview (FRIDAY-QUEUE 9f): sender's mascot VS a "?" slot, the type badge, the game
// on the title plaque, "Johnny challenges you", the time to beat for a race, the code small. 1200x630,
// cached at the CDN per code (an invite never changes once sent). Unknown codes fall back to the brand card.
//
// ART: composed from the ChatGPT-designed pieces in public/og/invite/ (badge-live|race|friend|pocket,
// slot = the "?" avatar frame, plaque = the title ribbon; docs/design/brand/2.8/invites). The cast mascots are
// the canonical hero poses (cast-<id>.png, never redrawn). PNG only: Satori cannot decode WebP.
async function loadPng(url: URL): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

const CACHE = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';
const BADGE: Record<InviteVariant, string> = { live: 'badge-live', race: 'badge-race', friend: 'badge-friend' };
const KICKER: Record<InviteVariant, string> = { live: 'LIVE MATCH', race: 'RACE MY RUN', friend: 'NEW FRIEND' };

const src = (b: ArrayBuffer | null) => b as unknown as string;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const kind: InviteLinkKind = sp.get('k') === 'friend' ? 'friend' : 'vs';
  const preview = await resolveInvitePreview(kind, sp.get('c') ?? '');
  if (preview.status === 'notfound') return renderWordociousOgImage();

  const origin = req.nextUrl.origin;
  const copy: InviteCopyInput = { variant: preview.variant, sender: preview.sender, game: preview.gameTitle, raceLine: preview.raceLine };
  const png = (name: string) => loadPng(new URL(`/og/invite/${name}.png`, origin));
  const [font, cast, badge, slot, plaque] = await Promise.all([
    fetch(new URL('../../fonts/Nunito-Black.woff', import.meta.url)).then((r) => r.arrayBuffer()),
    png(`cast-${preview.castId}`),
    png(BADGE[preview.variant]),
    png('slot'),
    png('plaque'),
  ]);

  const friend = preview.variant === 'friend';
  const plaqueText = friend ? 'WORDOCIOUS' : (preview.gameTitle ?? 'VS').toUpperCase();
  const centerLine = friend ? inviteHeadline(copy) : `${preview.sender} challenges you`;
  const sub = friend ? inviteSubline(copy) : preview.variant === 'race' ? (preview.raceLine ? `Beat: ${preview.raceLine}` : 'Beat their run') : '';

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: 'linear-gradient(180deg, #D6C3F5 0%, #E9D2F2 55%, #F9D3E4 100%)', fontFamily: 'Nunito' }}>
        {/* type badge */}
        {badge && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src(badge)} width={132} height={132} alt="" style={{ position: 'absolute', left: 534, top: 18, objectFit: 'contain' }} />
        )}

        {/* sender's mascot */}
        {cast ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src(cast)} width={330} height={330} alt="" style={{ position: 'absolute', left: 120, top: 70 }} />
        ) : (
          <div style={{ position: 'absolute', left: 150, top: 110, width: 260, height: 260, borderRadius: 60, background: '#7c3aed', color: '#fff', fontSize: 150, fontWeight: 900, alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
            {preview.sender.slice(0, 1).toUpperCase()}
          </div>
        )}

        {/* the "?" slot (the receiver's) */}
        <div style={{ position: 'absolute', left: 770, top: 92, width: 290, height: 314, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {slot && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src(slot)} width={290} height={314} alt="" style={{ position: 'absolute', left: 0, top: 0 }} />
          )}
          <div style={{ display: 'flex', marginTop: -26, fontSize: 150, fontWeight: 900, color: '#8b5cf6' }}>?</div>
          <div style={{ position: 'absolute', bottom: 22, display: 'flex', fontSize: 30, fontWeight: 900, letterSpacing: 2, color: '#5b21b6' }}>YOU</div>
        </div>

        {/* centre column: who, VS, the run to beat */}
        <div style={{ position: 'absolute', left: 430, top: 160, width: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 900, letterSpacing: 2, color: '#5b21b6' }}>{KICKER[preview.variant]}</div>
          <div style={{ display: 'flex', fontSize: friend ? 34 : 30, fontWeight: 900, color: '#3b1a78', marginTop: 6, lineHeight: 1.1 }}>{centerLine}</div>
          {!friend && <div style={{ display: 'flex', fontSize: 104, fontWeight: 900, color: '#f59e0b', letterSpacing: -3, marginTop: 4 }}>VS</div>}
          {sub && <div style={{ display: 'flex', fontSize: 26, fontWeight: 800, color: '#4c1d95', marginTop: 4, lineHeight: 1.15 }}>{sub}</div>}
        </div>

        {/* the title plaque */}
        <div style={{ position: 'absolute', left: 360, top: 400, width: 480, height: 232, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {plaque && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src(plaque)} width={480} height={232} alt="" style={{ position: 'absolute', left: 0, top: 0 }} />
          )}
          <div style={{ display: 'flex', marginTop: -14, fontSize: plaqueText.length > 11 ? 40 : 52, fontWeight: 900, letterSpacing: 1, color: '#4c1d95' }}>{plaqueText}</div>
        </div>

        <div style={{ position: 'absolute', bottom: 20, right: 32, display: 'flex', fontSize: 22, fontWeight: 800, letterSpacing: 3, color: '#6d4fb0' }}>{preview.code}</div>
        <div style={{ position: 'absolute', bottom: 20, left: 32, display: 'flex', fontSize: 24, fontWeight: 900, letterSpacing: 2, color: '#7c3aed' }}>WORDOCIOUS</div>
      </div>
    ),
    { width: 1200, height: 630, fonts: [{ name: 'Nunito', data: font, weight: 900, style: 'normal' }], headers: { 'Cache-Control': CACHE } },
  );
}
