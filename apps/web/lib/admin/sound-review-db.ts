import type { getAdminSupabase } from '@/lib/supabase-admin';
import { reviewStatus, type ReviewDecision } from './art-review';
import { siblingIds, siblingApprovesToClear, type SoundAsset, type SoundReview, type SoundStatus } from './sound-library';

type Admin = ReturnType<typeof getAdminSupabase>;

/** Server-only writes shared by the Sound Library review routes (service-role client passed in). */

export const SOUND_REVIEW_COLUMNS = 'asset_id, reviewer_id, decision, note, created_at, updated_at';
export const SOUND_FEEDBACK_COLUMNS = 'id, asset_id, scope, author_id, body, created_at, resolved_at, resolved_by, resolved_note';

export type SoundWriteResult =
  | { assets: SoundAsset[]; reviews: SoundReview[] }
  | { error: string; status: number; code?: string | null; message?: string | null };

/**
 * Record `me`'s `decision` on `ids` (latest decision wins), clear `me`'s approve on the other candidates of the same
 * events when approving (one pick per event), then recompute every touched candidate's status with the
 * two-approver rule (shipped untouched). Returns every candidate of the touched events and their reviews.
 */
export async function recordSoundReviews(
  admin: Admin,
  me: string,
  ids: readonly string[],
  decision: ReviewDecision,
  note: string | null,
  reviewerIds: readonly string[],
): Promise<SoundWriteResult> {
  const { data: found, error: findErr } = await admin.from('sound_assets').select('id').in('id', ids as string[]);
  if (findErr) return { error: findErr.message, status: 500, code: findErr.code, message: findErr.message };
  const known = ((found ?? []) as Array<{ id: string }>).map((a) => a.id);
  if (!known.length) return { error: ids.length === 1 ? 'Unknown sound' : 'Unknown sounds', status: 404 };

  const family = Array.from(new Set(known.flatMap((id) => siblingIds(id))));
  const { data: before, error: beforeErr } = await admin.from('sound_reviews').select(SOUND_REVIEW_COLUMNS).in('asset_id', family);
  if (beforeErr) return { error: beforeErr.message, status: 500 };
  const clear = decision === 'approve' ? siblingApprovesToClear(known, (before ?? []) as SoundReview[], me) : [];

  const now = new Date().toISOString();
  const { error: upErr } = await admin.from('sound_reviews').upsert(
    known.map((id) => ({ asset_id: id, reviewer_id: me, decision, note, updated_at: now })),
    { onConflict: 'asset_id,reviewer_id' },
  );
  if (upErr) return { error: upErr.message, status: 500 };
  if (clear.length) {
    const { error: delErr } = await admin.from('sound_reviews').delete()
      .eq('reviewer_id', me).eq('decision', 'approve').in('asset_id', clear);
    if (delErr) return { error: delErr.message, status: 500 };
  }

  const [{ data: rows, error: revErr }, { data: assetRows, error: assetErr }] = await Promise.all([
    admin.from('sound_reviews').select(SOUND_REVIEW_COLUMNS).in('asset_id', family),
    admin.from('sound_assets').select('*').in('id', family),
  ]);
  if (revErr) return { error: revErr.message, status: 500 };
  if (assetErr) return { error: assetErr.message, status: 500 };
  const reviews = (rows ?? []) as SoundReview[];
  const assets = (assetRows ?? []) as SoundAsset[];

  const byAsset = new Map<string, SoundReview[]>();
  for (const r of reviews) byAsset.set(r.asset_id, [...(byAsset.get(r.asset_id) ?? []), r]);
  const touched = new Set([...known, ...clear]);
  const moves = new Map<SoundStatus, string[]>();
  for (const a of assets) {
    if (!touched.has(a.id)) continue;
    const next = reviewStatus(a.status, byAsset.get(a.id) ?? [], reviewerIds) as SoundStatus;
    if (next !== a.status) moves.set(next, [...(moves.get(next) ?? []), a.id]);
  }
  const updated = new Map<string, SoundAsset>();
  for (const [status, moveIds] of Array.from(moves)) {
    const { data, error } = await admin.from('sound_assets')
      .update({ status, decided_by: me, decided_at: now, updated_at: now })
      .in('id', moveIds)
      .select();
    if (error) return { error: error.message, status: 500 };
    for (const a of (data ?? []) as SoundAsset[]) updated.set(a.id, a);
  }
  return { assets: assets.map((a) => updated.get(a.id) ?? a), reviews };
}
