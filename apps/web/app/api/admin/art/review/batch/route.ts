import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireArtAdmin } from '@/lib/admin/art-auth';
import { loadReviewers } from '@/lib/admin/art-review-db';
import { parseBatchReviewBody, reviewStatus, type ArtReview } from '@/lib/admin/art-review';
import type { ArtAsset, ArtStatus } from '@/lib/admin/art-library';

export const dynamic = 'force-dynamic';

/**
 * "Approve all" on a section: { asset_ids (at most BATCH_MAX), decision: 'approve' } -> { assets, reviews }.
 * Upserts the caller's art_reviews row for every listed piece in one write, then recomputes each piece's
 * status with reviewStatus (approved only once every reviewer approves; shipped untouched), one update per
 * resulting status. The page decides which pieces to send (never ones the caller rejected or commented on).
 * Unknown ids are skipped. Only listed reviewers may review.
 */
export async function POST(request: NextRequest) {
  const auth = await requireArtAdmin(request);
  if ('error' in auth) return auth.error;
  const me = auth.admin.id;
  if (!me) return NextResponse.json({ error: 'No reviewer identity (set ART_LIBRARY_DEV_REVIEWER for local use)' }, { status: 403 });

  const parsed = parseBatchReviewBody(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const admin = getAdminSupabase();
  const reviewers = await loadReviewers(admin);
  if ('error' in reviewers) return NextResponse.json({ error: reviewers.error }, { status: 500 });
  const reviewerIds = reviewers.list.map((r) => r.profile_id);
  if (!reviewerIds.includes(me)) {
    return NextResponse.json({ error: `Only ${reviewers.list.map((r) => r.short_name).join(' and ')} review art` }, { status: 403 });
  }

  const { data: found, error: assetErr } = await admin.from('art_assets').select('*').in('id', parsed.asset_ids);
  if (assetErr) return NextResponse.json({ error: assetErr.message }, { status: 500 });
  const assets = (found ?? []) as ArtAsset[];
  const ids = assets.map((a) => a.id);
  if (!ids.length) return NextResponse.json({ error: 'Unknown assets' }, { status: 404 });

  const now = new Date().toISOString();
  const { error: upErr } = await admin.from('art_reviews').upsert(
    ids.map((id) => ({ asset_id: id, reviewer_id: me, decision: parsed.decision, note: null, updated_at: now })),
    { onConflict: 'asset_id,reviewer_id' },
  );
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: rows, error: revErr } = await admin
    .from('art_reviews')
    .select('asset_id, reviewer_id, decision, note, created_at, updated_at')
    .in('asset_id', ids);
  if (revErr) return NextResponse.json({ error: revErr.message }, { status: 500 });
  const reviews = (rows ?? []) as ArtReview[];

  const byAsset = new Map<string, ArtReview[]>();
  for (const r of reviews) byAsset.set(r.asset_id, [...(byAsset.get(r.asset_id) ?? []), r]);
  const moves = new Map<ArtStatus, string[]>();
  for (const a of assets) {
    const next = reviewStatus(a.status, byAsset.get(a.id) ?? [], reviewerIds);
    if (next !== a.status) moves.set(next, [...(moves.get(next) ?? []), a.id]);
  }
  const updated = new Map<string, ArtAsset>();
  for (const [status, moveIds] of Array.from(moves)) {
    const { data, error } = await admin
      .from('art_assets')
      .update({ status, decided_by: me, decided_at: now, updated_at: now })
      .in('id', moveIds)
      .select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const a of (data ?? []) as ArtAsset[]) updated.set(a.id, a);
  }
  return NextResponse.json({ assets: assets.map((a) => updated.get(a.id) ?? a), reviews });
}
