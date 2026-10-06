import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import { loadReviewers } from '@/lib/admin/art-review-db';
import { SOUND_REVIEW_COLUMNS } from '@/lib/admin/sound-review-db';
import { isMissingTable, SOUND_SETUP_NOTE } from '@/lib/admin/sound-library';

export const dynamic = 'force-dynamic';

const PAGE = 1000; // PostgREST caps a response at 1,000 rows

/**
 * The Sound Library's review state (admin > Design > Sound Library; the sounds themselves come from the
 * catalog the page imports): { assets (sound_assets: id + status), reviews (every sound_reviews row),
 * reviewers (the Art Library's approvers: BMT + JP), me }. Before docs/sql/20261010-sound-library.sql is applied
 * it answers { setup } with empty lists, so the page still lists and plays every sound.
 */
export async function GET(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const reviewers = await loadReviewers(admin);
  const reviewerList = 'error' in reviewers ? [] : reviewers.list;

  const assets: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.from('sound_assets').select('id, status, live, decided_at')
      .order('sort', { ascending: true }).range(from, from + PAGE - 1);
    if (error) {
      if (isMissingTable(error)) return NextResponse.json({ assets: [], reviews: [], reviewers: reviewerList, me: auth.admin.id, setup: SOUND_SETUP_NOTE });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    assets.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  const reviews: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.from('sound_reviews').select(SOUND_REVIEW_COLUMNS)
      .order('asset_id', { ascending: true }).order('reviewer_id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    reviews.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  if ('error' in reviewers) return NextResponse.json({ error: reviewers.error }, { status: 500 });

  return NextResponse.json({ assets, reviews, reviewers: reviewerList, me: auth.admin.id });
}
