import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import { loadReviewers } from '@/lib/admin/art-review-db';

export const dynamic = 'force-dynamic';

const PAGE = 1000; // PostgREST caps a response at 1,000 rows

/**
 * The whole Art Library (admin > Content & Ops > Art Library):
 * { assets (newest first), reviews (every art_reviews row), reviewers (who must approve), me (caller's profile id) }.
 */
export async function GET(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const assets: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('art_assets')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    assets.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  const reviews: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('art_reviews')
      .select('asset_id, reviewer_id, decision, note, created_at, updated_at')
      .order('asset_id', { ascending: true })
      .order('reviewer_id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    reviews.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  const reviewers = await loadReviewers(admin);
  if ('error' in reviewers) return NextResponse.json({ error: reviewers.error }, { status: 500 });

  return NextResponse.json({ assets, reviews, reviewers: reviewers.list, me: auth.admin.id });
}
