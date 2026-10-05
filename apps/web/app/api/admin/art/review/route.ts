import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import { loadReviewers } from '@/lib/admin/art-review-db';
import { parseReviewBody, reviewStatus, type ArtReview } from '@/lib/admin/art-review';
import type { ArtStatus } from '@/lib/admin/art-library';

export const dynamic = 'force-dynamic';

/**
 * Record the caller's review of one asset: { asset_id, decision: 'approve'|'reject'|'changes', note? }
 * -> { asset, reviews }. Upserts the caller's art_reviews row (latest decision wins), then recomputes
 * art_assets.status with reviewStatus (approved only when every art_reviewers row approves; shipped is
 * left alone). Only listed reviewers may review.
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
    return NextResponse.json({ error: `Only ${reviewers.list.map((r) => r.short_name).join(' and ')} review art` }, { status: 403 });
  }

  const { data: asset, error: assetErr } = await admin.from('art_assets').select('*').eq('id', parsed.asset_id).maybeSingle();
  if (assetErr) return NextResponse.json({ error: assetErr.message }, { status: 500 });
  if (!asset) return NextResponse.json({ error: 'Unknown asset' }, { status: 404 });

  const now = new Date().toISOString();
  const { error: upErr } = await admin.from('art_reviews').upsert(
    { asset_id: parsed.asset_id, reviewer_id: me, decision: parsed.decision, note: parsed.note, updated_at: now },
    { onConflict: 'asset_id,reviewer_id' },
  );
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: rows, error: revErr } = await admin
    .from('art_reviews')
    .select('asset_id, reviewer_id, decision, note, created_at, updated_at')
    .eq('asset_id', parsed.asset_id);
  if (revErr) return NextResponse.json({ error: revErr.message }, { status: 500 });
  const reviews = (rows ?? []) as ArtReview[];

  const current = (asset as { status: ArtStatus }).status;
  const next = reviewStatus(current, reviews, reviewerIds);
  if (next === current) return NextResponse.json({ asset, reviews });

  const { data: updated, error: updErr } = await admin
    .from('art_assets')
    .update({ status: next, decided_by: me, decided_at: now, updated_at: now })
    .eq('id', parsed.asset_id)
    .select()
    .maybeSingle();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ asset: updated ?? asset, reviews });
}
