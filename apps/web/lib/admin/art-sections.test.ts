import { describe, it, expect } from 'vitest';
import type { ArtAsset, ArtStatus } from './art-library';
import { indexReviews, type ArtReview, type ArtReviewer, type ReviewContext, type ReviewDecision } from './art-review';
import {
  applyReviews, approveAllPlan, daysUntilSeason, groupSections, matchesTab, sectionKeyOf, sectionLabel, sectionSummary,
} from './art-sections';

const BMT = 'aaaaaaaa-0000-0000-0000-000000000001';
const JP = 'aaaaaaaa-0000-0000-0000-000000000002';
const REVIEWERS: ArtReviewer[] = [
  { profile_id: BMT, short_name: 'BMT', sort: 1 },
  { profile_id: JP, short_name: 'JP', sort: 2 },
];
const OCT_5 = new Date(2026, 9, 5);

function asset(id: string, p: Partial<ArtAsset> = {}): ArtAsset {
  return {
    id, path: `${id}.webp`, type: 'seasons', kind: 'cast', season: 'halloween', character: null, status: 'draft', stage: 'final',
    title: id, caption: null, width: null, height: null, mime: 'image/webp', bytes: 1, sha256: null,
    created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', decided_by: null, decided_at: null, note: null, ...p,
  };
}
const review = (asset_id: string, reviewer_id: string, decision: ReviewDecision): ArtReview => ({
  asset_id, reviewer_id, decision, note: null, created_at: '2026-10-05T00:00:00Z', updated_at: '2026-10-05T00:00:00Z',
});
const ctx = (reviews: ArtReview[], me: string | null = BMT): ReviewContext => ({ index: indexReviews(reviews), reviewers: REVIEWERS, me });

describe('section keys and labels', () => {
  it('groups by season (else type) then kind; dated kinds fold into the area', () => {
    expect(sectionKeyOf(asset('a'))).toBe('halloween/cast');
    expect(sectionKeyOf(asset('b', { type: 'mascot-maker', kind: 'new', season: null }))).toBe('mascot-maker/new');
    expect(sectionKeyOf(asset('c', { type: 'widgets', kind: '2026-10-02', season: null }))).toBe('widgets/');
    expect(sectionLabel('halloween', 'cast')).toBe('Halloween · Costumes');
    expect(sectionLabel('thanksgiving', 'titles')).toBe('Thanksgiving · Titles');
    expect(sectionLabel('mascot-maker', 'new')).toBe('Mascot maker · New items');
    expect(sectionLabel('buttons', 'family')).toBe('Buttons · Family');
    expect(sectionLabel('widgets', null)).toBe('Widgets');
    expect(sectionLabel('ui', 'menus')).toBe('UI · Menus');
    expect(sectionLabel('social', 'tiktok')).toBe('Social · TikTok');
    expect(sectionLabel('social', 'pinterest')).toBe('Social · Pinterest');
  });

  it('counts days to the next season day, wrapping into next year', () => {
    expect(daysUntilSeason('halloween', OCT_5)).toBe(26);
    expect(daysUntilSeason('thanksgiving', OCT_5)).toBeGreaterThan(26);
    expect(daysUntilSeason('back-to-school', OCT_5)).toBeGreaterThan(300);
    expect(daysUntilSeason('halloween', new Date(2026, 10, 1))).toBeGreaterThan(360);
    expect(daysUntilSeason('mystery', OCT_5)).toBe(9999);
  });
});

describe('groupSections', () => {
  const assets = [
    asset('tg/cast/w', { season: 'thanksgiving' }),
    asset('hw/titles/home', { kind: 'titles' }),
    asset('hw/cast/w'),
    asset('hw/cast/r'),
    asset('badges/a', { type: 'badges', kind: 'achievements', season: null, status: 'shipped' }),
    asset('btn/fam/a', { type: 'buttons', kind: 'family', season: null }),
    asset('mm/new/a', { type: 'mascot-maker', kind: 'new', season: null }),
    asset('wd/a', { type: 'widgets', kind: '2026-10-02', season: null }),
  ];

  it('opens sections that need my review first: next season first, cast before titles, then other areas', () => {
    const s = groupSections(assets, ctx([]), OCT_5);
    expect(s.map((x) => x.label)).toEqual([
      'Halloween · Costumes', 'Halloween · Titles', 'Thanksgiving · Costumes',
      'Mascot maker · New items', 'Buttons · Family', 'Widgets',
      'Badges · Achievements',
    ]);
    expect(s.map((x) => x.done)).toEqual([false, false, false, false, false, false, true]);
    expect(s[0].assets.map((a) => a.id)).toEqual(['hw/cast/w', 'hw/cast/r']);
    const mixed = groupSections([asset('x1', { status: 'shipped' }), asset('x2'), asset('x3', { status: 'shipped' }), asset('x4', { status: 'approved' })], ctx([]), OCT_5);
    expect(mixed[0].assets.map((a) => a.id)).toEqual(['x2', 'x4', 'x1', 'x3']);
    expect(s[0].counts).toMatchObject({ total: 2, toReview: 2, approved: 0, rejected: 0 });
  });

  it('a section I have fully reviewed drops below the open ones and is done', () => {
    const s = groupSections(assets, ctx([review('hw/cast/w', BMT, 'approve'), review('hw/cast/r', BMT, 'reject')]), OCT_5);
    const hw = s.find((x) => x.key === 'halloween/cast')!;
    expect(hw.done).toBe(true);
    expect(hw.counts).toMatchObject({ toReview: 0, flaggedByMe: 1 });
    expect(s.indexOf(hw)).toBeGreaterThan(s.findIndex((x) => x.key === 'widgets/'));
  });

  it('for someone who does not review, open = waiting on anyone', () => {
    const s = groupSections(assets, ctx([], null), OCT_5);
    expect(s.find((x) => x.key === 'halloween/cast')!.done).toBe(false);
    expect(s.find((x) => x.key === 'badges/achievements')!.done).toBe(true);
  });
});

describe('tabs', () => {
  it('mine / all / approved / rejected', () => {
    const c = ctx([review('b', BMT, 'approve')]);
    const draft = asset('a');
    const mineDone = asset('b');
    const approved = asset('c', { status: 'approved' });
    const shipped = asset('d', { status: 'shipped' });
    const rejected = asset('e', { status: 'rejected' });
    expect(matchesTab(draft, 'mine', c)).toBe(true);
    expect(matchesTab(mineDone, 'mine', c)).toBe(false);
    expect(matchesTab(shipped, 'mine', c)).toBe(false);
    expect(matchesTab(rejected, 'mine', c)).toBe(false);
    expect([draft, mineDone, approved, shipped, rejected].filter((a) => matchesTab(a, 'all', c))).toHaveLength(5);
    expect([draft, approved, shipped, rejected].filter((a) => matchesTab(a, 'approved', c)).map((a) => a.id)).toEqual(['c', 'd']);
    expect([draft, approved, shipped, rejected].filter((a) => matchesTab(a, 'rejected', c)).map((a) => a.id)).toEqual(['e']);
  });
});

describe('approve all', () => {
  const list = [asset('a'), asset('b'), asset('c'), asset('d'), asset('e', { status: 'shipped' }), asset('f', { status: 'rejected' })];

  it('approves only what I have not called yet; my flags stay, shipped is skipped', () => {
    const c = ctx([review('b', BMT, 'reject'), review('c', BMT, 'changes'), review('d', BMT, 'approve'), review('a', JP, 'approve'), review('f', JP, 'reject')]);
    expect(approveAllPlan(list, c)).toEqual({ ids: ['a', 'f'], flagged: 2 });
  });

  it('is empty for someone who does not review', () => {
    expect(approveAllPlan(list, ctx([], null))).toEqual({ ids: [], flagged: 0 });
    expect(approveAllPlan(list, { ...ctx([]), me: 'someone-else' })).toEqual({ ids: [], flagged: 0 });
  });
});

describe('sectionSummary', () => {
  const sec = (assets: ArtAsset[], c: ReviewContext) => groupSections(assets, c, OCT_5)[0];

  it('All approved by you, waiting on JP', () => {
    const assets = [asset('a'), asset('b')];
    const c = ctx([review('a', BMT, 'approve'), review('b', BMT, 'approve')]);
    expect(sectionSummary(sec(assets, c), c)).toBe('All approved by you · waiting on JP');
  });
  it('Approved by both / All shipped', () => {
    const c = ctx([]);
    expect(sectionSummary(sec([asset('a', { status: 'approved' }), asset('b', { status: 'shipped' })], c), c)).toBe('Approved by both');
    expect(sectionSummary(sec([asset('a', { status: 'shipped' })], c), c)).toBe('All shipped');
  });
  it('flags by me are named', () => {
    const c = ctx([review('a', BMT, 'reject'), review('b', BMT, 'approve')]);
    expect(sectionSummary(sec([asset('a', { status: 'rejected' }), asset('b')], c), c)).toBe('1 flagged by you · waiting on JP');
  });
});

describe('applyReviews (optimistic)', () => {
  it('replaces my rows and recomputes status like the server', () => {
    const assets = [asset('a'), asset('b'), asset('c', { status: 'shipped' })];
    const reviews = [review('a', JP, 'approve'), review('b', BMT, 'reject')];
    const out = applyReviews(assets, reviews, ['a', 'b', 'c'], BMT, 'approve', null, REVIEWERS, '2026-10-05T12:00:00Z');
    const status = (id: string): ArtStatus => out.assets.find((a) => a.id === id)!.status;
    expect(status('a')).toBe('approved');
    expect(status('b')).toBe('draft');
    expect(status('c')).toBe('shipped');
    expect(out.reviews.filter((r) => r.reviewer_id === BMT).map((r) => [r.asset_id, r.decision])).toEqual([['a', 'approve'], ['b', 'approve'], ['c', 'approve']]);
    expect(out.reviews.find((r) => r.reviewer_id === JP)).toBeTruthy();
    const rej = applyReviews(assets, reviews, ['a'], BMT, 'reject', 'too dark', REVIEWERS);
    expect(rej.assets[0].status).toBe('rejected');
    expect(rej.reviews.find((r) => r.asset_id === 'a' && r.reviewer_id === BMT)?.note).toBe('too dark');
  });
});
