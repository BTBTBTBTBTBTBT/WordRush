import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyMediaLink } from '@/lib/social/media-link';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** A Social Studio image by signed link (see lib/social/media-link.ts): what TikTok pulls for an inbox draft. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const path = verifyMediaLink(sp.get('p'), sp.get('e'), sp.get('s'));
  if (!path) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data, error } = await getAdminSupabase().storage.from('social-media').download(path);
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(Buffer.from(await data.arrayBuffer()), {
    headers: { 'Content-Type': /\.png$/i.test(path) ? 'image/png' : 'image/jpeg', 'Cache-Control': 'private, max-age=3600' },
  });
}
