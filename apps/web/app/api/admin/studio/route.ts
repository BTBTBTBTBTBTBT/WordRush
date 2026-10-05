import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import {
  loadAccountStatus, loadPaused, loadStudioReviewers, mediaUrls, POST_COLUMNS, REVIEW_COLUMNS, studioFixtureMode, TARGET_COLUMNS,
} from '@/lib/admin/studio-db';
import { studioFixture } from '@/lib/admin/studio-fixture';
import type { SocialMedia, SocialPost, SocialReview, SocialTarget } from '@/lib/admin/studio';
import type { StudioPayload } from '@/lib/admin/studio-types';

export const dynamic = 'force-dynamic';

/**
 * admin > Social Studio: every post from 60 days back on, their per-platform targets, both approvers' reviews,
 * the pause switch, account connection STATUS (never tokens), media URLs, per-post tracked-link results and open
 * feedback.
 */
export async function GET(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;
  if (studioFixtureMode()) return NextResponse.json(studioFixture(request.nextUrl.searchParams.get('empty') === '1'));

  const admin = getAdminSupabase();
  const since = new Date(Date.now() - 60 * 86400_000).toISOString();
  const { data: postRows, error: postErr } = await admin.from('social_posts').select(POST_COLUMNS).gte('scheduled_at', since).order('scheduled_at');
  if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 });
  const posts = (postRows ?? []) as unknown as SocialPost[];
  const ids = posts.map((p) => p.id);

  const [targetsQ, reviewsQ, reviewers, paused, accounts, feedbackQ] = await Promise.all([
    ids.length ? admin.from('social_post_targets').select(TARGET_COLUMNS).in('post_id', ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? admin.from('social_reviews').select(REVIEW_COLUMNS).in('post_id', ids) : Promise.resolve({ data: [], error: null }),
    loadStudioReviewers(admin),
    loadPaused(admin),
    loadAccountStatus(admin),
    admin.from('social_open_feedback').select('id, post_id, author, body, created_at').limit(200),
  ]);
  if (targetsQ.error || reviewsQ.error) return NextResponse.json({ error: (targetsQ.error ?? reviewsQ.error)!.message }, { status: 500 });
  if ('error' in reviewers) return NextResponse.json({ error: reviewers.error }, { status: 500 });
  const targets = (targetsQ.data ?? []) as unknown as SocialTarget[];

  // Tracked links: clicks from marketing_links, signups from profiles.signup_source (the /go cookie = the slug).
  const slugs = targets.map((t) => t.link_slug).filter((s): s is string => !!s);
  const links: StudioPayload['links'] = {};
  if (slugs.length) {
    const [clicksQ, signupsQ] = await Promise.all([
      admin.from('marketing_links').select('slug, clicks').in('slug', slugs),
      admin.from('profiles').select('signup_source').in('signup_source', slugs).limit(10000),
    ]);
    for (const s of slugs) links[s] = { clicks: 0, signups: 0 };
    for (const r of (clicksQ.data ?? []) as Array<{ slug: string; clicks: number }>) links[r.slug].clicks = r.clicks ?? 0;
    for (const r of (signupsQ.data ?? []) as Array<{ signup_source: string }>) if (links[r.signup_source]) links[r.signup_source].signups += 1;
  }

  const media: SocialMedia[] = posts.flatMap((p) => p.media ?? []);
  const urls = await mediaUrls(admin, media, null);
  const feedback = ((feedbackQ.data ?? []) as StudioPayload['feedback']).filter((f) => !f.post_id || ids.includes(f.post_id));

  const payload: StudioPayload = {
    posts,
    targets,
    reviews: (reviewsQ.data ?? []) as unknown as SocialReview[],
    reviewers,
    me: auth.admin.id,
    paused,
    accounts,
    urls,
    links,
    feedback,
  };
  return NextResponse.json(payload);
}
