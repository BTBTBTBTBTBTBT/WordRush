import { randomBytes } from 'crypto';
import sharp from 'sharp';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import { isUuid, MEDIA_SIZES, type MediaSize, type SocialMedia } from '@/lib/admin/studio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Replace a post's image: multipart { post_id, file } -> { media } (one JPEG per platform size, cropped to fill,
 * stored in the private 'social-media' bucket). The page then saves it through /edit, which bumps the version so
 * both approvals reset.
 */
export async function POST(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;

  const fd = await request.formData().catch(() => null);
  const postId = fd?.get('post_id');
  const file = fd?.get('file');
  if (!isUuid(postId)) return NextResponse.json({ error: 'post_id is required' }, { status: 400 });
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'file is required' }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'Image is over 15 MB' }, { status: 400 });

  let input: Buffer;
  try {
    input = Buffer.from(await file.arrayBuffer());
    await sharp(input).metadata();
  } catch {
    return NextResponse.json({ error: 'That file is not an image' }, { status: 400 });
  }

  const admin = getAdminSupabase();
  const tag = randomBytes(4).toString('hex');
  const media: SocialMedia[] = [];
  for (const size of Object.keys(MEDIA_SIZES) as MediaSize[]) {
    const { width, height } = MEDIA_SIZES[size];
    const out = await sharp(input).rotate().resize(width, height, { fit: 'cover', position: 'attention' }).flatten({ background: '#ffffff' }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
    const path = `posts/${postId}/${tag}-${size}.jpg`;
    const { error } = await admin.storage.from('social-media').upload(path, out, { contentType: 'image/jpeg', upsert: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    media.push({ size, src: 'bucket', path, width, height });
  }
  const { data } = await admin.storage.from('social-media').createSignedUrls(media.map((m) => m.path), 3600);
  const urls = Object.fromEntries((data ?? []).filter((r) => r.path && r.signedUrl).map((r) => [r.path!, r.signedUrl]));
  return NextResponse.json({ media, urls });
}
