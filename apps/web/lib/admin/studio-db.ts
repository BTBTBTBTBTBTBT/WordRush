import type { getAdminSupabase } from '@/lib/supabase-admin';
import { artDevBypass } from './art-auth';
import {
  PLATFORMS, PROVIDERS, type Platform, type Provider, type Reviewer, type SocialMedia, type SocialPost, type SocialReview, type SocialTarget,
} from './studio';

type Admin = ReturnType<typeof getAdminSupabase>;

/** Server-only reads shared by the Social Studio routes and the publisher (service-role client passed in). */

export const POST_COLUMNS = 'id, title, kind, scheduled_at, hashtags, media, link_slug, link_target, version, edited_at, edited_by, paused, status, created_at, updated_at';
export const TARGET_COLUMNS = 'id, post_id, platform, caption, status, attempts, next_attempt_at, remote_id, remote_url, last_error, posted_at, link_slug';
export const REVIEW_COLUMNS = 'post_id, reviewer_id, decision, version, note, updated_at';

/**
 * Dev-only fixture mode for local screenshots without a service key: `next dev` with ART_LIBRARY_DEV_ADMIN=1 and
 * SOCIAL_STUDIO_FIXTURE=1. Compiled out of production builds (literal NODE_ENV check inside artDevBypass).
 */
export function studioFixtureMode(): boolean {
  return artDevBypass() && process.env.SOCIAL_STUDIO_FIXTURE === '1';
}

export async function loadStudioReviewers(admin: Admin): Promise<Reviewer[] | { error: string }> {
  const { data, error } = await admin.from('art_reviewers').select('profile_id, short_name, sort').order('sort', { ascending: true });
  if (error) return { error: error.message };
  return (data ?? []) as Reviewer[];
}

export async function loadPaused(admin: Admin): Promise<boolean> {
  const { data } = await admin.from('social_settings').select('paused').eq('id', 1).maybeSingle();
  // Fail safe: when the settings row cannot be read, treat posting as paused.
  return data ? !!(data as { paused: boolean }).paused : true;
}

/** Connection status only (never tokens). `configured` = the provider's env vars are set. */
export interface AccountStatus {
  platform: Platform;
  provider: Provider;
  connected: boolean;
  configured: boolean;
  handle: string | null;
  connected_at: string | null;
  last_error: string | null;
}

export async function loadAccountStatus(admin: Admin): Promise<AccountStatus[]> {
  const { data } = await admin.from('social_accounts').select('platform, handle, connected_at, last_error, access_token');
  const rows = (data ?? []) as Array<{ platform: Platform; handle: string | null; connected_at: string | null; last_error: string | null; access_token: string | null }>;
  return PLATFORMS.map((platform) => {
    const provider = (Object.keys(PROVIDERS) as Provider[]).find((p) => PROVIDERS[p].platforms.includes(platform))!;
    const row = rows.find((r) => r.platform === platform);
    return {
      platform,
      provider,
      connected: !!row?.access_token,
      configured: PROVIDERS[provider].env.every((v) => !!(process.env[v] ?? '').trim()),
      handle: row?.handle ?? null,
      connected_at: row?.connected_at ?? null,
      last_error: row?.last_error ?? null,
    };
  });
}

/** A browser-usable URL for each media item: public paths as-is, bucket objects signed for an hour. */
export async function mediaUrls(admin: Admin, media: readonly SocialMedia[], origin: string | null, seconds = 3600): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const bucket = media.filter((m) => m.src === 'bucket').map((m) => m.path);
  if (bucket.length) {
    const { data } = await admin.storage.from('social-media').createSignedUrls(Array.from(new Set(bucket)), seconds);
    for (const row of data ?? []) if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  }
  for (const m of media) if (m.src === 'public') out[m.path] = origin ? `${origin.replace(/\/$/, '')}${m.path}` : m.path;
  return out;
}

export async function loadPost(admin: Admin, postId: string) {
  const [p, t, r] = await Promise.all([
    admin.from('social_posts').select(POST_COLUMNS).eq('id', postId).maybeSingle(),
    admin.from('social_post_targets').select(TARGET_COLUMNS).eq('post_id', postId),
    admin.from('social_reviews').select(REVIEW_COLUMNS).eq('post_id', postId),
  ]);
  if (p.error || t.error || r.error) return { error: (p.error ?? t.error ?? r.error)!.message };
  if (!p.data) return { error: 'Unknown post', status: 404 };
  return { post: p.data as unknown as SocialPost, targets: (t.data ?? []) as unknown as SocialTarget[], reviews: (r.data ?? []) as unknown as SocialReview[] };
}
