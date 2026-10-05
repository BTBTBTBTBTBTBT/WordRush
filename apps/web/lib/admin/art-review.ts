/**
 * admin > Art Library: the two-approver review rule, the review filters, and the
 * feedback-thread request validation. Pure (no React, no Supabase) so the page,
 * the /api/admin/art routes and the tests all share it. Tables:
 * docs/sql/20261005-art-reviews.sql.
 */
import type { ArtAsset, ArtStatus } from './art-library';

export const REVIEW_DECISIONS = ['approve', 'reject', 'changes'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/** One row of public.art_reviews: a reviewer's latest call on one asset. */
export interface ArtReview {
  asset_id: string;
  reviewer_id: string;
  decision: ReviewDecision;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** One row of public.art_reviewers (who must approve), plus the profile's username. */
export interface ArtReviewer {
  profile_id: string;
  short_name: string;
  sort: number;
  username?: string | null;
}

/** One row of public.art_feedback, with the author's username (and the asset, for the open list). */
export interface ArtFeedback {
  id: string;
  asset_id: string | null;
  scope: string | null;
  author_id: string;
  author: string | null;
  body: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolved_note: string | null;
}

export function isReviewDecision(d: unknown): d is ReviewDecision {
  return typeof d === 'string' && (REVIEW_DECISIONS as readonly string[]).includes(d);
}

/**
 * The status an asset should carry after a review lands.
 * - 'shipped' never changes here (only the decide route sets or clears it).
 * - Any listed reviewer's 'reject' -> 'rejected'.
 * - Otherwise any 'changes' -> 'draft'.
 * - Otherwise 'approved' only when EVERY listed reviewer has 'approve'.
 * - Otherwise (someone has not reviewed yet) -> 'draft'.
 * Reviews from people who are not listed reviewers do not count.
 */
export function reviewStatus(
  current: ArtStatus,
  reviews: ReadonlyArray<Pick<ArtReview, 'reviewer_id' | 'decision'>>,
  reviewerIds: readonly string[],
): ArtStatus {
  if (current === 'shipped') return 'shipped';
  const listed = new Set(reviewerIds);
  const counted = reviews.filter((r) => listed.has(r.reviewer_id));
  if (counted.some((r) => r.decision === 'reject')) return 'rejected';
  if (counted.some((r) => r.decision === 'changes')) return 'draft';
  const approvedBy = new Set(counted.filter((r) => r.decision === 'approve').map((r) => r.reviewer_id));
  if (listed.size > 0 && reviewerIds.every((id) => approvedBy.has(id))) return 'approved';
  return 'draft';
}

/** asset id -> (reviewer id -> review). */
export type ReviewIndex = Map<string, Map<string, ArtReview>>;

export function indexReviews(reviews: readonly ArtReview[]): ReviewIndex {
  const out: ReviewIndex = new Map();
  for (const r of reviews) {
    const m = out.get(r.asset_id) ?? new Map<string, ArtReview>();
    m.set(r.reviewer_id, r);
    out.set(r.asset_id, m);
  }
  return out;
}

/**
 * Reviewers who still owe a call on this asset: open art only (draft or approved;
 * rejected and shipped art waits on nobody), and no review from them yet.
 */
export function pendingReviewers(
  asset: Pick<ArtAsset, 'id' | 'status'>,
  index: ReviewIndex,
  reviewers: readonly Pick<ArtReviewer, 'profile_id'>[],
): string[] {
  if (asset.status !== 'draft' && asset.status !== 'approved') return [];
  const mine = index.get(asset.id);
  return reviewers.map((r) => r.profile_id).filter((id) => !mine?.has(id));
}

/** True when every listed reviewer approved this asset. */
export function approvedByAll(
  asset: Pick<ArtAsset, 'id'>,
  index: ReviewIndex,
  reviewers: readonly Pick<ArtReviewer, 'profile_id'>[],
): boolean {
  const mine = index.get(asset.id);
  return reviewers.length > 0 && reviewers.every((r) => mine?.get(r.profile_id)?.decision === 'approve');
}

/** 'mine' = needs my review, 'all' = approved by every reviewer, 'waiting:<profile id>' = waiting on that reviewer. */
export type ReviewFilter = 'mine' | 'all' | `waiting:${string}`;

export interface ReviewContext {
  index: ReviewIndex;
  reviewers: readonly ArtReviewer[];
  /** The viewer's profile id (null when unknown). */
  me: string | null;
}

export function matchesReview(asset: Pick<ArtAsset, 'id' | 'status'>, filter: ReviewFilter, ctx: ReviewContext): boolean {
  if (filter === 'all') return approvedByAll(asset, ctx.index, ctx.reviewers);
  const who = filter === 'mine' ? ctx.me : filter.slice('waiting:'.length);
  if (!who) return false;
  return pendingReviewers(asset, ctx.index, ctx.reviewers).includes(who);
}

export function filterByReview<T extends Pick<ArtAsset, 'id' | 'status'>>(
  assets: readonly T[], filter: ReviewFilter | null, ctx: ReviewContext,
): T[] {
  return filter ? assets.filter((a) => matchesReview(a, filter, ctx)) : assets.slice();
}

export interface ReviewChip { value: ReviewFilter; label: string; count: number }

/**
 * The Review chip row: "Needs my review" (only when the viewer is a reviewer),
 * "Waiting on <each other reviewer>", then "Approved by both" (or "by all").
 * Counts are over the assets passed in (already narrowed by the other filters).
 */
export function reviewChips(assets: ReadonlyArray<Pick<ArtAsset, 'id' | 'status'>>, ctx: ReviewContext): ReviewChip[] {
  const sorted = ctx.reviewers.slice().sort((a, b) => a.sort - b.sort || a.short_name.localeCompare(b.short_name));
  const iAmReviewer = !!ctx.me && sorted.some((r) => r.profile_id === ctx.me);
  const chips: Array<{ value: ReviewFilter; label: string }> = [];
  if (iAmReviewer) chips.push({ value: 'mine', label: 'Needs my review' });
  for (const r of sorted) {
    if (r.profile_id === ctx.me) continue;
    chips.push({ value: `waiting:${r.profile_id}`, label: `Waiting on ${r.short_name}` });
  }
  if (sorted.length) chips.push({ value: 'all', label: sorted.length === 2 ? 'Approved by both' : 'Approved by all' });
  return chips.map((c) => ({ ...c, count: assets.filter((a) => matchesReview(a, c.value, ctx)).length }));
}

/* ------------------------------------------------------------ validation */

const NOTE_MAX = 2000;
const BODY_MAX = 4000;
/** 'season:halloween', 'surface:leaderboard', 'page:home' ... */
export const SCOPE_RE = /^[a-z][a-z0-9-]{0,31}:[A-Za-z0-9._/-]{1,120}$/;

const clean = (s: string, max: number) => (s.trim() ? s.trim().slice(0, max) : null);

/**
 * Validate a POST /api/admin/art/review body. `feedback: true` also files the note as an art_feedback row on
 * the asset (the tile's inline "What should change?" box), so it needs a note.
 */
export function parseReviewBody(body: unknown): { asset_id: string; decision: ReviewDecision; note: string | null; feedback: boolean } | { error: string } {
  const b = (body ?? {}) as { asset_id?: unknown; decision?: unknown; note?: unknown; feedback?: unknown };
  if (typeof b.asset_id !== 'string' || !b.asset_id.trim()) return { error: 'asset_id is required' };
  if (!isReviewDecision(b.decision)) return { error: "decision must be 'approve', 'reject' or 'changes'" };
  if (b.note !== undefined && b.note !== null && typeof b.note !== 'string') return { error: 'note must be a string' };
  if (b.feedback !== undefined && typeof b.feedback !== 'boolean') return { error: 'feedback must be true or false' };
  const note = typeof b.note === 'string' ? clean(b.note, NOTE_MAX) : null;
  if (b.feedback === true && !note) return { error: 'feedback needs a note' };
  return { asset_id: b.asset_id, decision: b.decision, note, feedback: b.feedback === true };
}

/** At most this many pieces per POST /api/admin/art/review/batch (the page chunks bigger sections). */
export const BATCH_MAX = 200;

/** Validate a POST /api/admin/art/review/batch body: { asset_ids: string[], decision: 'approve' }. */
export function parseBatchReviewBody(body: unknown): { asset_ids: string[]; decision: 'approve' } | { error: string } {
  const b = (body ?? {}) as { asset_ids?: unknown; decision?: unknown };
  if (!Array.isArray(b.asset_ids) || !b.asset_ids.length || !b.asset_ids.every((x) => typeof x === 'string' && x.trim())) {
    return { error: 'asset_ids must be a non-empty array of ids' };
  }
  if (b.asset_ids.length > BATCH_MAX) return { error: `at most ${BATCH_MAX} asset_ids per request` };
  if (b.decision !== 'approve') return { error: "decision must be 'approve'" };
  return { asset_ids: Array.from(new Set(b.asset_ids as string[])), decision: 'approve' };
}

export type FeedbackQuery = { asset_id: string } | { scope: string } | { open: true };

/** Validate GET /api/admin/art/feedback search params (?asset_id= | ?scope= | ?open=1). */
export function parseFeedbackQuery(params: URLSearchParams): FeedbackQuery | { error: string } {
  const assetId = params.get('asset_id');
  const scope = params.get('scope');
  const open = params.get('open');
  if (assetId && assetId.trim()) return { asset_id: assetId };
  if (scope) return SCOPE_RE.test(scope) ? { scope } : { error: "scope must look like 'season:halloween'" };
  if (open === '1' || open === 'true') return { open: true };
  return { error: 'pass asset_id, scope or open=1' };
}

/** Validate a POST /api/admin/art/feedback body: { asset_id? | scope?, body }. */
export function parseFeedbackBody(raw: unknown): { asset_id: string | null; scope: string | null; body: string } | { error: string } {
  const b = (raw ?? {}) as { asset_id?: unknown; scope?: unknown; body?: unknown };
  const assetId = typeof b.asset_id === 'string' && b.asset_id.trim() ? b.asset_id : null;
  if (b.asset_id != null && typeof b.asset_id !== 'string') return { error: 'asset_id must be a string' };
  if (b.scope != null && (typeof b.scope !== 'string' || !SCOPE_RE.test(b.scope))) return { error: "scope must look like 'season:halloween'" };
  const scope = typeof b.scope === 'string' ? b.scope : null;
  if (!assetId && !scope) return { error: 'asset_id or scope is required' };
  if (typeof b.body !== 'string' || !b.body.trim()) return { error: 'body is required' };
  return { asset_id: assetId, scope, body: b.body.trim().slice(0, BODY_MAX) };
}

/** Validate a POST /api/admin/art/feedback/resolve body: { id, note? }. */
export function parseResolveBody(raw: unknown): { id: string; note: string | null } | { error: string } {
  const b = (raw ?? {}) as { id?: unknown; note?: unknown };
  if (typeof b.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.id)) return { error: 'id must be a feedback uuid' };
  if (b.note != null && typeof b.note !== 'string') return { error: 'note must be a string' };
  return { id: b.id, note: typeof b.note === 'string' ? clean(b.note, NOTE_MAX) : null };
}

/** Label for a feedback scope: 'season:winter-holidays' -> 'Winter holidays season'. */
export function scopeLabel(scope: string): string {
  const i = scope.indexOf(':');
  if (i < 0) return scope;
  const kind = scope.slice(0, i);
  const raw = scope.slice(i + 1).replace(/[-_/]+/g, ' ');
  const name = raw.charAt(0).toUpperCase() + raw.slice(1);
  return kind === 'season' ? `${name} season` : kind === 'surface' ? `${name} screen` : `${name} (${kind})`;
}
