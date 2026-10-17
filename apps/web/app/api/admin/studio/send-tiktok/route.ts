import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import { loadPost, POST_COLUMNS, studioFixtureMode, TARGET_COLUMNS } from '@/lib/admin/studio-db';
import { isUuid, rollupStatus, type SocialPost, type SocialTarget } from '@/lib/admin/studio';
import type { AccountRow } from '@/lib/social/adapters';
import { publishClaimedTarget } from '@/lib/social/publish-target';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://wordocious.com').replace(/\/$/, '');

/**
 * "Send to TikTok drafts": { post_id } -> { post, targets }. Sends the post's TikTok target to the connected account's
 * TikTok INBOX now (MEDIA_UPLOAD: a private draft a person finishes in the TikTok app; nothing is public). Because it is
 * a draft, it skips the schedule, the two approvals and the global pause, which gate PUBLIC posts only. The target is
 * then marked posted, so the publisher never sends it again.
 */
export async function POST(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => null) as { post_id?: unknown } | null;
  if (!isUuid(body?.post_id)) return NextResponse.json({ error: 'post_id is required' }, { status: 400 });
  if (studioFixtureMode()) return NextResponse.json({ fixture: true });

  const admin = getAdminSupabase();
  const loaded = await loadPost(admin, body!.post_id as string);
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status ?? 500 });
  const target = loaded.targets.find((t) => t.platform === 'tiktok');
  if (!target || target.status !== 'pending') return NextResponse.json({ error: 'This post has no unsent TikTok version' }, { status: 409 });

  const { data: acct } = await admin.from('social_accounts')
    .select('platform, account_id, handle, access_token, refresh_token, expires_at, scopes, meta').eq('platform', 'tiktok').maybeSingle();
  if (!acct?.access_token) return NextResponse.json({ error: 'TikTok is not connected' }, { status: 409 });

  const now = new Date().toISOString();
  const { data: claimed } = await admin.from('social_post_targets')
    .update({ status: 'posting', claimed_at: now, updated_at: now })
    .eq('id', target.id).eq('status', 'pending').is('remote_id', null).select('id').maybeSingle();
  if (!claimed) return NextResponse.json({ error: 'Already being sent' }, { status: 409 });

  const out = await publishClaimedTarget(admin, loaded.post, target, acct as AccountRow, SITE);

  const [p, t] = await Promise.all([
    admin.from('social_posts').select(POST_COLUMNS).eq('id', loaded.post.id).maybeSingle(),
    admin.from('social_post_targets').select(TARGET_COLUMNS).eq('post_id', loaded.post.id),
  ]);
  const post = p.data as unknown as SocialPost;
  const targets = (t.data ?? []) as unknown as SocialTarget[];
  const next = rollupStatus(targets);
  if (post && next !== post.status) {
    await admin.from('social_posts').update({ status: next, updated_at: new Date().toISOString() }).eq('id', post.id);
    post.status = next;
  }
  if (out.error) return NextResponse.json({ error: out.error, post, targets }, { status: 502 });
  return NextResponse.json({ post, targets });
}
