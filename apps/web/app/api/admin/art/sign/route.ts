import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import { basename, isRaster, parseSignBody } from '@/lib/admin/art-library';

export const dynamic = 'force-dynamic';

const BUCKET = 'art-library';
const TTL = 3600; // seconds; the page refreshes cached URLs after 50 minutes

/**
 * Signed URLs for up to 120 art_assets ids: { ids, variant } -> { urls: { [id]: url } }.
 * thumb = a 360px contain-resized render for raster images (plain URL otherwise,
 * or when the transform sign fails); full = plain; download = attachment named
 * after the file. Unknown ids are skipped.
 */
export async function POST(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;

  const parsed = parseSignBody(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { ids, variant } = parsed;
  if (!ids.length) return NextResponse.json({ urls: {} });

  const admin = getAdminSupabase();
  const { data: rows, error } = await admin.from('art_assets').select('id, path, mime').in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const assets = (rows ?? []) as Array<{ id: string; path: string; mime: string }>;
  const bucket = admin.storage.from(BUCKET);
  const urls: Record<string, string> = {};

  if (variant === 'full') {
    if (assets.length) {
      const { data, error: signError } = await bucket.createSignedUrls(assets.map((a) => a.path), TTL);
      if (signError) return NextResponse.json({ error: signError.message }, { status: 500 });
      const byPath = new Map(assets.map((a) => [a.path, a.id]));
      for (const s of data ?? []) {
        const id = s.path ? byPath.get(s.path) : undefined;
        if (id && s.signedUrl && !s.error) urls[id] = s.signedUrl;
      }
    }
    return NextResponse.json({ urls });
  }

  await Promise.all(
    assets.map(async (a) => {
      if (variant === 'download') {
        const { data } = await bucket.createSignedUrl(a.path, TTL, { download: basename(a.path) });
        if (data?.signedUrl) urls[a.id] = data.signedUrl;
        return;
      }
      if (isRaster(a.mime)) {
        const { data } = await bucket.createSignedUrl(a.path, TTL, {
          transform: { width: 360, height: 360, resize: 'contain' },
        });
        if (data?.signedUrl) { urls[a.id] = data.signedUrl; return; }
      }
      const { data } = await bucket.createSignedUrl(a.path, TTL);
      if (data?.signedUrl) urls[a.id] = data.signedUrl;
    }),
  );
  return NextResponse.json({ urls });
}
