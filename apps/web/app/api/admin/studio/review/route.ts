import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import { loadStudioReviewers, REVIEW_COLUMNS, studioFixtureMode } from '@/lib/admin/studio-db';
import { parseReviewBody } from '@/lib/admin/studio';

export const dynamic = 'force-dynamic';

/**
 * Record the caller's call on one post: { post_id, decision, note?, feedback?, version? } -> { reviews, item? }.
 * The review is stamped with the post's CURRENT version (an approval only counts for the version it was given
 * on). `version` (what the reviewer saw) must match, so nobody approves an edit they have not seen. With
 * feedback: true the note is also filed in social_feedback (Claude reads it in the next drafting pass).
 */
export async function POST(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;
  const me = auth.admin.id;
  if (!me) return NextResponse.json({ error: 'No reviewer identity (set ART_LIBRARY_DEV_REVIEWER for local use)' }, { status: 403 });

  const parsed = parseReviewBody(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (studioFixtureMode()) return NextResponse.json({ reviews: [], fixture: true });

  const admin = getAdminSupabase();
  const reviewers = await loadStudioReviewers(admin);
  if ('error' in reviewers) return NextResponse.json({ error: reviewers.error }, { status: 500 });
  if (!reviewers.some((r) => r.profile_id === me)) {
    return NextResponse.json({ error: `Only ${reviewers.map((r) => r.short_name).join(' and ')} approve posts` }, { status: 403 });
  }

  const { data: post, error: postErr } = await admin.from('social_posts').select('id, version, status').eq('id', parsed.post_id).maybeSingle();
  if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 });
  if (!post) return NextResponse.json({ error: 'Unknown post' }, { status: 404 });
  const version = (post as { version: number }).version;
  if (parsed.version !== null && parsed.version !== version) {
    return NextResponse.json({ error: 'This post was edited since you opened it. Reload to see the new version.' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { error: upErr } = await admin.from('social_reviews').upsert(
    { post_id: parsed.post_id, reviewer_id: me, decision: parsed.decision, version, note: parsed.note, updated_at: now },
    { onConflict: 'post_id,reviewer_id' },
  );
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  let item: unknown;
  if (parsed.feedback && parsed.note) {
    const { data, error } = await admin.from('social_feedback')
      .insert({ post_id: parsed.post_id, body: parsed.note, author_id: me })
      .select('id, post_id, body, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    item = data;
  }

  const { data: rows, error: revErr } = await admin.from('social_reviews').select(REVIEW_COLUMNS).eq('post_id', parsed.post_id);
  if (revErr) return NextResponse.json({ error: revErr.message }, { status: 500 });
  return NextResponse.json({ reviews: rows ?? [], item });
}
