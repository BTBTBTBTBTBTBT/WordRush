import { describe, it, expect } from 'vitest';
import {
  approvedByAll, filterByReview, indexReviews, matchesReview, parseFeedbackBody, parseFeedbackQuery, parseResolveBody,
  BATCH_MAX, parseBatchReviewBody, parseReviewBody, pendingReviewers, reviewChips, reviewStatus, scopeLabel, type ArtReview, type ArtReviewer,
  type ReviewContext, type ReviewDecision,
} from './art-review';
import type { ArtStatus } from './art-library';

const BMT = 'aaaaaaaa-0000-0000-0000-000000000001';
const JP = 'aaaaaaaa-0000-0000-0000-000000000002';
const OTHER = 'aaaaaaaa-0000-0000-0000-000000000003';
const IDS = [BMT, JP];
const REVIEWERS: ArtReviewer[] = [
  { profile_id: JP, short_name: 'JP', sort: 2 },
  { profile_id: BMT, short_name: 'BMT', sort: 1 },
];

const r = (asset_id: string, reviewer_id: string, decision: ReviewDecision): ArtReview => ({
  asset_id, reviewer_id, decision, note: null, created_at: '2026-10-05T00:00:00Z', updated_at: '2026-10-05T00:00:00Z',
});

describe('reviewStatus', () => {
  const rows = (...d: Array<[string, ReviewDecision]>) => d.map(([who, dec]) => r('a', who, dec));

  it('approves only when every reviewer approves', () => {
    expect(reviewStatus('draft', rows([BMT, 'approve']), IDS)).toBe('draft');
    expect(reviewStatus('draft', rows([JP, 'approve']), IDS)).toBe('draft');
    expect(reviewStatus('draft', rows([BMT, 'approve'], [JP, 'approve']), IDS)).toBe('approved');
  });
  it('any reject rejects, even after the other approved', () => {
    expect(reviewStatus('draft', rows([BMT, 'reject']), IDS)).toBe('rejected');
    expect(reviewStatus('approved', rows([BMT, 'approve'], [JP, 'reject']), IDS)).toBe('rejected');
    expect(reviewStatus('draft', rows([BMT, 'changes'], [JP, 'reject']), IDS)).toBe('rejected');
  });
  it('any request for changes keeps or sets draft', () => {
    expect(reviewStatus('approved', rows([BMT, 'approve'], [JP, 'changes']), IDS)).toBe('draft');
    expect(reviewStatus('rejected', rows([BMT, 'changes']), IDS)).toBe('draft');
  });
  it('a changed mind recomputes: rejected -> approved once both approve', () => {
    expect(reviewStatus('rejected', rows([BMT, 'approve'], [JP, 'approve']), IDS)).toBe('approved');
  });
  it('never touches shipped art', () => {
    for (const d of ['approve', 'reject', 'changes'] as const) {
      expect(reviewStatus('shipped', rows([BMT, d], [JP, d]), IDS)).toBe('shipped');
    }
  });
  it('ignores reviews from people who are not reviewers', () => {
    expect(reviewStatus('draft', rows([OTHER, 'reject'], [BMT, 'approve'], [JP, 'approve']), IDS)).toBe('approved');
    expect(reviewStatus('draft', rows([OTHER, 'approve']), [])).toBe('draft');
  });
  it('with no reviewers listed nothing is ever auto-approved', () => {
    for (const s of ['draft', 'approved', 'rejected'] as ArtStatus[]) expect(reviewStatus(s, [], [])).toBe('draft');
  });
});

describe('review filters', () => {
  const assets = [
    { id: 'none', status: 'draft' as ArtStatus },
    { id: 'bmt-ok', status: 'draft' as ArtStatus },
    { id: 'jp-ok', status: 'draft' as ArtStatus },
    { id: 'both', status: 'approved' as ArtStatus },
    { id: 'rejected', status: 'rejected' as ArtStatus },
    { id: 'shipped', status: 'shipped' as ArtStatus },
    { id: 'jp-changes', status: 'draft' as ArtStatus },
  ];
  const index = indexReviews([
    r('bmt-ok', BMT, 'approve'),
    r('jp-ok', JP, 'approve'),
    r('both', BMT, 'approve'), r('both', JP, 'approve'),
    r('rejected', JP, 'reject'),
    r('jp-changes', JP, 'changes'),
  ]);
  const ctx: ReviewContext = { index, reviewers: REVIEWERS, me: BMT };
  const ids = (xs: Array<{ id: string }>) => xs.map((x) => x.id);

  it('pendingReviewers: open art only, reviewers without a row', () => {
    expect(pendingReviewers(assets[0], index, REVIEWERS).sort()).toEqual([BMT, JP].sort());
    expect(pendingReviewers(assets[1], index, REVIEWERS)).toEqual([JP]);
    expect(pendingReviewers(assets[4], index, REVIEWERS)).toEqual([]);
    expect(pendingReviewers(assets[5], index, REVIEWERS)).toEqual([]);
  });
  it('Needs my review = open art I have not reviewed', () => {
    expect(ids(filterByReview(assets, 'mine', ctx))).toEqual(['none', 'jp-ok', 'jp-changes']);
    expect(filterByReview(assets, 'mine', { ...ctx, me: null })).toEqual([]);
  });
  it('Waiting on JP / Waiting on BMT', () => {
    expect(ids(filterByReview(assets, `waiting:${JP}`, ctx))).toEqual(['none', 'bmt-ok']);
    expect(ids(filterByReview(assets, `waiting:${BMT}`, ctx))).toEqual(['none', 'jp-ok', 'jp-changes']);
  });
  it('Approved by both', () => {
    expect(ids(filterByReview(assets, 'all', ctx))).toEqual(['both']);
    expect(approvedByAll({ id: 'bmt-ok' }, index, REVIEWERS)).toBe(false);
    expect(approvedByAll({ id: 'both' }, index, [])).toBe(false);
  });
  it('no filter passes everything', () => {
    expect(filterByReview(assets, null, ctx)).toHaveLength(assets.length);
    expect(matchesReview(assets[0], 'waiting:', ctx)).toBe(false);
  });
  it('chips: mine first for a reviewer, then the others in order, then approved by both, with counts', () => {
    expect(reviewChips(assets, ctx)).toEqual([
      { value: 'mine', label: 'Needs my review', count: 3 },
      { value: `waiting:${JP}`, label: 'Waiting on JP', count: 2 },
      { value: 'all', label: 'Approved by both', count: 1 },
    ]);
  });
  it('chips: a non-reviewer sees waiting on each reviewer, no "mine"', () => {
    expect(reviewChips(assets, { ...ctx, me: OTHER }).map((c) => c.label)).toEqual(['Waiting on BMT', 'Waiting on JP', 'Approved by both']);
    expect(reviewChips(assets, { ...ctx, reviewers: [] })).toEqual([]);
  });
});

describe('request parsing', () => {
  it('parseReviewBody', () => {
    expect(parseReviewBody({ asset_id: 'x', decision: 'approve' })).toEqual({ asset_id: 'x', decision: 'approve', note: null, feedback: false });
    expect(parseReviewBody({ asset_id: 'x', decision: 'changes', note: '  warmer  ' })).toEqual({ asset_id: 'x', decision: 'changes', note: 'warmer', feedback: false });
    expect(parseReviewBody({ asset_id: 'x', decision: 'reject', note: 'too dark', feedback: true })).toEqual({ asset_id: 'x', decision: 'reject', note: 'too dark', feedback: true });
    expect(parseReviewBody({ asset_id: 'x', decision: 'changes', note: '  ', feedback: true })).toHaveProperty('error');
    expect(parseReviewBody({ asset_id: 'x', decision: 'changes', note: 'a', feedback: 'yes' })).toHaveProperty('error');
    expect(parseReviewBody({ asset_id: 'x', decision: 'approved' })).toHaveProperty('error');
    expect(parseReviewBody({ decision: 'approve' })).toHaveProperty('error');
    expect(parseReviewBody({ asset_id: 'x', decision: 'reject', note: 3 })).toHaveProperty('error');
    expect(parseReviewBody(null)).toHaveProperty('error');
  });
  it('parseBatchReviewBody', () => {
    expect(parseBatchReviewBody({ asset_ids: ['a', 'b', 'a'], decision: 'approve' })).toEqual({ asset_ids: ['a', 'b'], decision: 'approve' });
    expect(parseBatchReviewBody({ asset_ids: [], decision: 'approve' })).toHaveProperty('error');
    expect(parseBatchReviewBody({ asset_ids: ['a', 3], decision: 'approve' })).toHaveProperty('error');
    expect(parseBatchReviewBody({ asset_ids: ['a'], decision: 'reject' })).toHaveProperty('error');
    expect(parseBatchReviewBody({ asset_ids: Array.from({ length: BATCH_MAX + 1 }, (_, i) => `a${i}`), decision: 'approve' })).toHaveProperty('error');
    expect(parseBatchReviewBody(null)).toHaveProperty('error');
  });
  it('parseFeedbackQuery', () => {
    expect(parseFeedbackQuery(new URLSearchParams('asset_id=a/b'))).toEqual({ asset_id: 'a/b' });
    expect(parseFeedbackQuery(new URLSearchParams('scope=season:halloween'))).toEqual({ scope: 'season:halloween' });
    expect(parseFeedbackQuery(new URLSearchParams('open=1'))).toEqual({ open: true });
    expect(parseFeedbackQuery(new URLSearchParams('scope=nope'))).toHaveProperty('error');
    expect(parseFeedbackQuery(new URLSearchParams(''))).toHaveProperty('error');
  });
  it('parseFeedbackBody', () => {
    expect(parseFeedbackBody({ asset_id: 'a', body: ' more glow ' })).toEqual({ asset_id: 'a', scope: null, body: 'more glow' });
    expect(parseFeedbackBody({ scope: 'surface:leaderboard', body: 'x' })).toEqual({ asset_id: null, scope: 'surface:leaderboard', body: 'x' });
    expect(parseFeedbackBody({ body: 'x' })).toHaveProperty('error');
    expect(parseFeedbackBody({ asset_id: 'a', body: '   ' })).toHaveProperty('error');
    expect(parseFeedbackBody({ scope: 'Bad Scope', body: 'x' })).toHaveProperty('error');
  });
  it('parseResolveBody', () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    expect(parseResolveBody({ id, note: ' done ' })).toEqual({ id, note: 'done' });
    expect(parseResolveBody({ id })).toEqual({ id, note: null });
    expect(parseResolveBody({ id: 'nope' })).toHaveProperty('error');
  });
  it('scopeLabel', () => {
    expect(scopeLabel('season:winter-holidays')).toBe('Winter holidays season');
    expect(scopeLabel('surface:leaderboard')).toBe('Leaderboard screen');
    expect(scopeLabel('page:home')).toBe('Home (page)');
  });
});
