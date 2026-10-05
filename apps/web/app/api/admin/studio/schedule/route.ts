import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import { loadPost, studioFixtureMode } from '@/lib/admin/studio-db';
import { parseScheduleBody, targetSlug, type Platform } from '@/lib/admin/studio';

export const dynamic = 'force-dynamic';

/**
 * Schedule / hold / platforms for one post: { post_id, scheduled_at?, paused?, platforms? }.
 * - Rescheduling (the calendar drag) does NOT reset approvals.
 * - Removing a platform skips it (no reset). Adding one adds a caption nobody has approved yet, so it bumps the
 *   version (both re-approve) and creates that platform's tracked link.
 */
export async function POST(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;

  const parsed = parseScheduleBody(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (studioFixtureMode()) return NextResponse.json({ ok: true, fixture: true });

  const admin = getAdminSupabase();
  const loaded = await loadPost(admin, parsed.post_id);
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status ?? 500 });
  if (loaded.post.status !== 'draft') return NextResponse.json({ error: 'Already posted: it can no longer be changed' }, { status: 409 });

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (parsed.scheduled_at) patch.scheduled_at = parsed.scheduled_at;
  if (parsed.paused !== undefined) patch.paused = parsed.paused;

  if (parsed.platforms) {
    const want = new Set<Platform>(parsed.platforms);
    const have = new Map(loaded.targets.map((t) => [t.platform, t]));
    const added = parsed.platforms.filter((p) => !have.has(p) || have.get(p)!.status === 'skipped');
    for (const t of loaded.targets) {
      if (!want.has(t.platform) && t.status === 'pending') {
        await admin.from('social_post_targets').update({ status: 'skipped', updated_at: now }).eq('id', t.id);
      }
    }
    const seedCaption = loaded.targets.find((t) => t.platform === 'instagram')?.caption ?? loaded.targets[0]?.caption ?? '';
    for (const p of added) {
      const slug = targetSlug(loaded.post.id, p);
      await admin.from('marketing_links').upsert({ slug, target: loaded.post.link_target, channel: p }, { onConflict: 'slug', ignoreDuplicates: true });
      if (have.has(p)) await admin.from('social_post_targets').update({ status: 'pending', updated_at: now }).eq('id', have.get(p)!.id);
      else await admin.from('social_post_targets').insert({ post_id: loaded.post.id, platform: p, caption: seedCaption, link_slug: slug });
    }
    if (added.length) {
      patch.version = loaded.post.version + 1;
      patch.edited_at = now;
      patch.edited_by = auth.admin.id;
    }
  }

  const { error } = await admin.from('social_posts').update(patch).eq('id', parsed.post_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const fresh = await loadPost(admin, parsed.post_id);
  if ('error' in fresh) return NextResponse.json({ error: fresh.error }, { status: 500 });
  return NextResponse.json({ post: fresh.post, targets: fresh.targets });
}
