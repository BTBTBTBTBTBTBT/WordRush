import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import { loadReviewers } from '@/lib/admin/art-review-db';
import { parseBatchReviewBody } from '@/lib/admin/art-review';
import { recordSoundReviews } from '@/lib/admin/sound-review-db';

export const dynamic = 'force-dynamic';

/**
 * "Approve all" on a section: { asset_ids (at most BATCH_MAX), decision: 'approve' } -> { assets, reviews }.
 * The page sends the LIVE candidate of every event the caller hasn't picked in yet (soundApproveAllPlan); each
 * becomes the caller's pick for its event. Unknown ids are skipped. Only listed reviewers may review.
 */
export async function POST(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;
  const me = auth.admin.id;
  if (!me) return NextResponse.json({ error: 'No reviewer identity (set ART_LIBRARY_DEV_REVIEWER for local use)' }, { status: 403 });

  const parsed = parseBatchReviewBody(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const admin = getAdminSupabase();
  const reviewers = await loadReviewers(admin);
  if ('error' in reviewers) return NextResponse.json({ error: reviewers.error }, { status: 500 });
  const reviewerIds = reviewers.list.map((r) => r.profile_id);
  if (!reviewerIds.includes(me)) {
    return NextResponse.json({ error: `Only ${reviewers.list.map((r) => r.short_name).join(' and ')} review sounds` }, { status: 403 });
  }

  const out = await recordSoundReviews(admin, me, parsed.asset_ids, 'approve', null, reviewerIds);
  if ('error' in out) return NextResponse.json({ error: out.error }, { status: out.status });
  return NextResponse.json(out);
}
