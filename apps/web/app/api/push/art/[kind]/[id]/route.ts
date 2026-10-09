import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { resolveRowAvatar } from '@/lib/avatar-cast';
import { avatarInitial, mascotSvg, withAvatarId } from '@/lib/avatar-render';
import { artSrc, badgeSrc } from '@/lib/art';

// Rich push images (FRIDAY-QUEUE item 34). Notification attachments must be PNG/JPEG (iOS refuses WebP) and
// reachable without a session, so the sender's mascot and the game's art are rendered here as small PNGs:
//   /api/push/art/avatar/<userId>   the sender's resolved avatar (their photo, else their mascot), 256 px
//   /api/push/art/game/<gameId>     the game's art, 512 px (pocket games: 'pocket-rps' ...)
// Public + cached a day: nothing here is private (avatars already show on leaderboards).

export const runtime = 'nodejs';

const HEADERS = { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400, s-maxage=86400' };
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

async function fallbackMascot(size: number): Promise<Buffer> {
  const file = await readFile(path.join(process.cwd(), 'public', 'mascots', 'w.png'));
  return sharp(file).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

async function avatarPng(userId: string): Promise<Buffer> {
  const sb = getAdminSupabase();
  let row: Record<string, unknown> | null = null;
  const full = await sb.from('profiles').select('username, avatar_url, avatar_config, avatar_cast_id, avatar_frame').eq('id', userId).maybeSingle();
  if (!full.error) row = full.data as Record<string, unknown> | null;
  else {
    const plain = await sb.from('profiles').select('username, avatar_url').eq('id', userId).maybeSingle();
    row = plain.data as Record<string, unknown> | null;
  }
  if (!row) return fallbackMascot(256);
  const username = typeof row.username === 'string' ? row.username : '';
  const resolved = resolveRowAvatar(row, username);
  if (resolved.photoUrl) {
    try {
      const res = await fetch(resolved.photoUrl);
      if (res.ok) {
        return await sharp(Buffer.from(await res.arrayBuffer())).resize(256, 256, { fit: 'cover' }).png().toBuffer();
      }
    } catch { /* fall through to the mascot */ }
  }
  const svg = withAvatarId(
    mascotSvg({ config: { ...resolved.config, display: 'mascot' }, initial: avatarInitial(username), size: 256, frame: resolved.config.frame, crownSrc: badgeSrc('pro-crown-sprite'), artSrc }),
    'push-av',
  ).replace('width="100%" height="100%"', 'width="256" height="256"');
  try {
    return await sharp(Buffer.from(svg), { density: 144 }).resize(256, 256).png().toBuffer();
  } catch {
    return fallbackMascot(256);
  }
}

async function gamePng(gameId: string): Promise<Buffer> {
  const dir = path.join(process.cwd(), 'public', 'art');
  for (const name of [`art-game-${gameId}.webp`, `art-game-${gameId.toLowerCase()}.webp`]) {
    try {
      const file = await readFile(path.join(dir, name));
      return await sharp(file).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    } catch { /* try the next name */ }
  }
  return fallbackMascot(512);
}

export async function GET(_req: NextRequest, { params }: { params: { kind: string; id: string } }) {
  const id = params.id.replace(/\.png$/i, '');
  if (!SAFE_ID.test(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  try {
    const png = params.kind === 'avatar' ? await avatarPng(id) : params.kind === 'game' ? await gamePng(id) : null;
    if (!png) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return new NextResponse(png, { headers: HEADERS });
  } catch {
    return new NextResponse(await fallbackMascot(256), { headers: { ...HEADERS, 'Cache-Control': 'public, max-age=300' } });
  }
}
