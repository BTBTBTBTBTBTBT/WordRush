import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import { loadPost, studioFixtureMode } from '@/lib/admin/studio-db';
import { applyEdit, parseEditBody } from '@/lib/admin/studio';

export const dynamic = 'force-dynamic';

/**
 * Edit a post's content: { post_id, caption?: { platform, text }, hashtags?, media? } -> { post, targets, changed }.
 * Any real change bumps the post's version, so BOTH approvals reset ("Edited, needs re-approval") and what posts
 * is exactly what both people approved. Posted posts cannot be edited.
 */
export async function POST(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;

  const parsed = parseEditBody(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (studioFixtureMode()) return NextResponse.json({ changed: true, fixture: true });

  const admin = getAdminSupabase();
  const loaded = await loadPost(admin, parsed.post_id);
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status ?? 500 });
  if (loaded.post.status !== 'draft' || loaded.targets.some((t) => t.status === 'posted' || t.status === 'posting')) {
    return NextResponse.json({ error: 'Already posted (or posting): it can no longer be edited' }, { status: 409 });
  }
  if (parsed.edit.caption && !loaded.targets.some((t) => t.platform === parsed.edit.caption!.platform)) {
    return NextResponse.json({ error: 'That platform is not on this post' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const next = applyEdit(loaded.post, loaded.targets, parsed.edit, auth.admin.id, now);
  if (!next.changed) return NextResponse.json({ post: loaded.post, targets: loaded.targets, changed: false });

  // Optimistic concurrency: only bump from the version we read.
  const { data: updated, error: upErr } = await admin.from('social_posts')
    .update({ hashtags: next.post.hashtags, media: next.post.media, version: next.post.version, edited_at: now, edited_by: auth.admin.id, updated_at: now })
    .eq('id', parsed.post_id)
    .eq('version', loaded.post.version)
    .select('id')
    .maybeSingle();
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: 'Someone else just edited this post. Reload and try again.' }, { status: 409 });

  if (parsed.edit.caption) {
    const { error } = await admin.from('social_post_targets')
      .update({ caption: parsed.edit.caption.text, updated_at: now })
      .eq('post_id', parsed.post_id)
      .eq('platform', parsed.edit.caption.platform);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ post: next.post, targets: next.targets, changed: true });
}
