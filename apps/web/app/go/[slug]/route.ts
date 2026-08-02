import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const SLUG = /^[a-z0-9-]{1,40}$/;

// Marketing short links: wordocious.com/go/tiktok goes in the TikTok bio,
// /go/x in the X bio, and so on. The redirect counts the click and drops a
// 30-day first-touch cookie that auth-context stamps onto BRAND-NEW accounts
// as profiles.signup_source — "signups by source" is the only marketing
// number that isn't vanity, and this route is where it starts existing.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const slug = params.slug.toLowerCase();
  const fallback = NextResponse.redirect(new URL('/', req.url), 302);
  if (!SLUG.test(slug)) return fallback;

  const admin = getAdminSupabase();
  const { data: link } = await admin
    .from('marketing_links')
    .select('slug, target, clicks')
    .eq('slug', slug)
    .maybeSingle();
  if (!link) return fallback; // unknown slug: land home, no cookie, no count

  // Best-effort counter (read-modify is race-tolerant enough at this scale;
  // the number is a trend line, not a ledger).
  await admin.from('marketing_links').update({ clicks: (link.clicks ?? 0) + 1 }).eq('slug', slug);

  const res = NextResponse.redirect(link.target, 302);
  // NOT httpOnly — auth-context reads it client-side at signup. First-touch:
  // an existing wr_src cookie is left alone so the first channel wins.
  if (!req.cookies.get('wr_src')) {
    res.cookies.set('wr_src', slug, {
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
      sameSite: 'lax',
    });
  }
  return res;
}
