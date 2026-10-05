import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { stampHeartbeat } from '@/lib/heartbeat';
import { loadPaused, loadStudioReviewers, mediaUrls, POST_COLUMNS, REVIEW_COLUMNS, TARGET_COLUMNS } from '@/lib/admin/studio-db';
import {
  CLAIM_STALE_MS, finalText, MAX_ATTEMPTS, PLATFORM_INFO, publishEligibility, retryDelayMs, reviewState, rollupStatus, trackedUrl,
  type Platform, type SocialPost, type SocialReview, type SocialTarget,
} from '@/lib/admin/studio';
import { PUBLISHERS, providerEnv, scrub, type AccountRow } from '@/lib/social/adapters';

export const maxDuration = 60;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://wordocious.com').replace(/\/$/, '');

/**
 * Social Studio publisher (Vercel cron, every 15 minutes; run by hand with the CRON_SECRET bearer token).
 * Posts each target that is due, approved by BOTH reviewers on the current version, not paused (post or global)
 * and on a connected account. With nothing connected it is a no-op.
 *
 * Never double-posts: a target is claimed (pending -> posting) with a conditional update before any API call, a
 * posted target is never touched again, and a claim that died mid-post is marked failed for a human to check
 * instead of being retried. Every attempt is logged in social_publish_log. Failures retry with backoff; after
 * MAX_ATTEMPTS the target is failed (red in the Studio).
 */
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const admin = getAdminSupabase();
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Claims that died mid-post: we cannot know whether the platform got it, so never retry blindly.
  const stale = new Date(now.getTime() - CLAIM_STALE_MS).toISOString();
  await admin.from('social_post_targets')
    .update({ status: 'failed', last_error: 'Interrupted while posting. Check the platform before retrying.', claimed_at: null, updated_at: nowIso })
    .eq('status', 'posting')
    .lt('claimed_at', stale);

  if (await loadPaused(admin)) {
    await stampHeartbeat('social-publish', true, 'paused');
    return NextResponse.json({ ok: true, paused: true, posted: 0 });
  }

  const { data: acctRows } = await admin.from('social_accounts').select('platform, account_id, handle, access_token, refresh_token, expires_at, scopes, meta');
  const accounts = new Map(((acctRows ?? []) as AccountRow[]).filter((a) => a.access_token).map((a) => [a.platform, a]));
  if (!accounts.size) {
    await stampHeartbeat('social-publish', true, 'no accounts connected');
    return NextResponse.json({ ok: true, connected: 0, posted: 0 });
  }

  const { data: postRows } = await admin.from('social_posts').select(POST_COLUMNS)
    .in('status', ['draft', 'partial']).eq('paused', false).lte('scheduled_at', nowIso).limit(50);
  const posts = (postRows ?? []) as unknown as SocialPost[];
  if (!posts.length) {
    await stampHeartbeat('social-publish', true, 'nothing due');
    return NextResponse.json({ ok: true, posted: 0 });
  }
  const ids = posts.map((p) => p.id);
  const [targetsQ, reviewsQ, reviewers] = await Promise.all([
    admin.from('social_post_targets').select(TARGET_COLUMNS).in('post_id', ids),
    admin.from('social_reviews').select(REVIEW_COLUMNS).in('post_id', ids),
    loadStudioReviewers(admin),
  ]);
  if ('error' in reviewers || targetsQ.error || reviewsQ.error) {
    await stampHeartbeat('social-publish', false, 'could not load reviews');
    return NextResponse.json({ error: 'load failed' }, { status: 500 });
  }
  const targets = (targetsQ.data ?? []) as unknown as SocialTarget[];
  const reviews = (reviewsQ.data ?? []) as unknown as SocialReview[];
  const connected = new Set<Platform>(Array.from(accounts.keys()));

  let posted = 0;
  const errors: string[] = [];
  for (const post of posts) {
    const approved = reviewState(post, reviews, reviewers).approved;
    const mine = targets.filter((t) => t.post_id === post.id);
    for (const target of mine) {
      const ok = publishEligibility({ post, target, approved, globalPause: false, connected, now });
      if (!ok.ok) continue;

      // Claim it: only one run can move pending -> posting.
      const { data: claimed } = await admin.from('social_post_targets')
        .update({ status: 'posting', claimed_at: nowIso, updated_at: nowIso })
        .eq('id', target.id).eq('status', 'pending').is('remote_id', null)
        .select('id').maybeSingle();
      if (!claimed) continue;

      const attempt = target.attempts + 1;
      let acct = accounts.get(target.platform)!;
      const publisher = PUBLISHERS[target.platform];
      try {
        const env = providerEnv(PLATFORM_INFO[target.platform].provider);
        if (!env) throw new Error('App keys are not set in Vercel');
        if (publisher.refresh) {
          const fresh = await publisher.refresh(acct, env);
          if (fresh) {
            acct = { ...acct, ...fresh };
            accounts.set(target.platform, acct);
            await admin.from('social_accounts').update({ ...fresh, updated_at: new Date().toISOString() }).eq('platform', target.platform);
          }
        }
        const size = PLATFORM_INFO[target.platform].size;
        const media = post.media.filter((m) => m.size === size);
        const pick = media.length ? media : post.media.filter((m) => m.size === 'portrait');
        const urls = await mediaUrls(admin, pick, SITE, 3 * 3600);
        const imageUrls = pick.map((m) => urls[m.path]).filter(Boolean);
        if (!imageUrls.length) throw new Error('No image for this platform');
        const link = trackedUrl(target.link_slug, SITE) ?? post.link_target;
        const result = await publisher.publish(acct, {
          text: finalText(target.platform, target.caption, post.hashtags, link),
          imageUrls,
          link,
          title: post.title,
        });
        await admin.from('social_post_targets').update({
          status: 'posted', attempts: attempt, remote_id: result.remoteId, remote_url: result.url, posted_at: new Date().toISOString(),
          last_error: result.note ?? null, claimed_at: null, next_attempt_at: null, updated_at: new Date().toISOString(),
        }).eq('id', target.id);
        await admin.from('social_publish_log').insert({ post_id: post.id, target_id: target.id, platform: target.platform, attempt, ok: true, remote_id: result.remoteId, remote_url: result.url });
        target.status = 'posted';
        posted += 1;
      } catch (e) {
        const msg = scrub(e instanceof Error ? e.message : String(e), [acct.access_token, acct.refresh_token]);
        const failed = attempt >= MAX_ATTEMPTS;
        await admin.from('social_post_targets').update({
          status: failed ? 'failed' : 'pending', attempts: attempt, last_error: msg, claimed_at: null,
          next_attempt_at: failed ? null : new Date(Date.now() + retryDelayMs(attempt)).toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', target.id);
        await admin.from('social_publish_log').insert({ post_id: post.id, target_id: target.id, platform: target.platform, attempt, ok: false, error: msg });
        target.status = failed ? 'failed' : 'pending';
        errors.push(`${target.platform}: ${msg}`);
      }
    }
    const next = rollupStatus(mine);
    if (next !== post.status) await admin.from('social_posts').update({ status: next, updated_at: new Date().toISOString() }).eq('id', post.id);
  }

  await stampHeartbeat('social-publish', errors.length === 0, errors.length ? errors.slice(0, 5).join(' | ') : `posted ${posted}`);
  return NextResponse.json({ ok: errors.length === 0, posted, errors: errors.length });
}
