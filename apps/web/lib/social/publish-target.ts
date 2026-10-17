import type { getAdminSupabase } from '@/lib/supabase-admin';
import { mediaUrls } from '@/lib/admin/studio-db';
import { finalText, MAX_ATTEMPTS, PLATFORM_INFO, publishableImages, retryDelayMs, trackedUrl, type SocialPost, type SocialTarget } from '@/lib/admin/studio';
import { PUBLISHERS, providerEnv, scrub, type AccountRow } from './adapters';
import { signedMediaLink } from './media-link';

type Admin = ReturnType<typeof getAdminSupabase>;

/**
 * Publish ONE claimed target (status already moved pending -> posting by the caller) and record the outcome: the
 * target row, social_publish_log, and a refreshed token on social_accounts. Shared by the cron publisher and the
 * Studio's "Send to TikTok drafts". Returns the (possibly refreshed) account and the error message, if any.
 */
export async function publishClaimedTarget(admin: Admin, post: SocialPost, target: SocialTarget, account: AccountRow, site: string): Promise<{ account: AccountRow; error: string | null; status: SocialTarget['status'] }> {
  const attempt = target.attempts + 1;
  let acct = account;
  const publisher = PUBLISHERS[target.platform];
  try {
    const env = providerEnv(PLATFORM_INFO[target.platform].provider);
    if (!env) throw new Error('App keys are not set in Vercel');
    if (publisher.refresh) {
      const fresh = await publisher.refresh(acct, env);
      if (fresh) {
        acct = { ...acct, ...fresh };
        await admin.from('social_accounts').update({ ...fresh, updated_at: new Date().toISOString() }).eq('platform', target.platform);
      }
    }
    const size = PLATFORM_INFO[target.platform].size;
    // Images only: a 'video' entry is never sent (video posting is not built; those posts stay paused).
    const pick = publishableImages(post.media, size);
    // TikTok pulls from a URL on a domain verified with it (wordocious.com), so bucket images go through our signed link.
    const urls = target.platform === 'tiktok'
      ? Object.fromEntries(pick.map((m) => [m.path, m.src === 'bucket' ? signedMediaLink(site, m.path) : `${site}${m.path}`]))
      : await mediaUrls(admin, pick, site, 3 * 3600);
    const imageUrls = pick.map((m) => urls[m.path]).filter(Boolean);
    if (!imageUrls.length) throw new Error('No image for this platform');
    const link = trackedUrl(target.link_slug, site) ?? post.link_target;
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
    return { account: acct, error: null, status: 'posted' };
  } catch (e) {
    const msg = scrub(e instanceof Error ? e.message : String(e), [acct.access_token, acct.refresh_token]);
    const failed = attempt >= MAX_ATTEMPTS;
    await admin.from('social_post_targets').update({
      status: failed ? 'failed' : 'pending', attempts: attempt, last_error: msg, claimed_at: null,
      next_attempt_at: failed ? null : new Date(Date.now() + retryDelayMs(attempt)).toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', target.id);
    await admin.from('social_publish_log').insert({ post_id: post.id, target_id: target.id, platform: target.platform, attempt, ok: false, error: msg });
    return { account: acct, error: msg, status: failed ? 'failed' : 'pending' };
  }
}
