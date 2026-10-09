import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import { loadReviewers, withAuthors } from '@/lib/admin/art-review-db';
import { parseReviewBody, type ArtFeedback } from '@/lib/admin/art-review';
import { recordSoundReviews, SOUND_FEEDBACK_COLUMNS } from '@/lib/admin/sound-review-db';

export const dynamic = 'force-dynamic';

/**
 * Record the caller's review of one sound candidate: { asset_id, decision: 'approve'|'reject'|'changes', note?,
 * feedback? } -> { assets, reviews, item? } (every candidate of that event, so the page sees a sibling's approve
 * cleared). An approve is the caller's ONE pick for the event: their approve on the other candidates is removed.
 * With feedback: true the note is also filed as a sound_feedback row (the inline "What should change?" box).
 * Statuses follow the two-approver rule (approved only when every art_reviewers row approves). Only listed
 * reviewers may review.
 */
export async function POST(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;
  const me = auth.admin.id;
  if (!me) return NextResponse.json({ error: 'No reviewer identity (set ART_LIBRARY_DEV_REVIEWER for local use)' }, { status: 403 });

  const parsed = parseReviewBody(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const admin = getAdminSupabase();
  const reviewers = await loadReviewers(admin);
  if ('error' in reviewers) return NextResponse.json({ error: reviewers.error }, { status: 500 });
  const reviewerIds = reviewers.list.map((r) => r.profile_id);
  if (!reviewerIds.includes(me)) {
    return NextResponse.json({ error: `Only ${reviewers.list.map((r) => r.short_name).join(' and ')} review sounds` }, { status: 403 });
  }

  const out = await recordSoundReviews(admin, me, [parsed.asset_id], parsed.decision, parsed.note, reviewerIds);
  if ('error' in out) return NextResponse.json({ error: out.error }, { status: out.status });

  let item: ArtFeedback | undefined;
  if (parsed.feedback && parsed.note) {
    const { data: fb, error: fbErr } = await admin
      .from('sound_feedback')
      .insert({ asset_id: parsed.asset_id, scope: null, body: parsed.note, author_id: me })
      .select(SOUND_FEEDBACK_COLUMNS)
      .single();
    if (fbErr) return NextResponse.json({ error: fbErr.message }, { status: 500 });
    [item] = await withAuthors(admin, [fb as Omit<ArtFeedback, 'author'>]);
  }
  return NextResponse.json({ ...out, item });
}
