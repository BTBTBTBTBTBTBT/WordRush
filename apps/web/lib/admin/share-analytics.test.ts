import { describe, it, expect } from 'vitest';
import {
  summarizeShares,
  summarizeShareOutcomes,
  UNLABELED,
  type ShareEventRow,
  type ReferralRow,
  type LandingVisitRow,
} from './share-analytics';

const ev = (platform: string, kind: string, game_mode = '', surface = ''): ShareEventRow =>
  ({ platform, kind, game_mode, surface });

const SHARES: ShareEventRow[] = [
  ev('ios', 'image', 'Six', 'post_game'),
  ev('ios', 'image', 'Six', 'post_game'),
  ev('ios', 'image', 'Seven', 'post_game'),
  ev('web', 'text', 'Six', 'post_game'),
  ev('android', 'link_invite', '', 'referral'),
  ev('ios', 'link_invite', 'QuadWord', 'vs_invite'),
  ev('web', 'other', 'DailySweep', 'leaderboard'),
  ev('web', 'image', 'Six', 'leaderboard'),
];

describe('summarizeShares', () => {
  it('returns zeros and empty tables for no rows (no divide-by-zero)', () => {
    const s = summarizeShares([]);
    expect(s.total).toBe(0);
    expect(s.byKind).toEqual([]);
    expect(s.byPlatformKind).toEqual([]);
    expect(s.byMode).toEqual([]);
    expect(s.bySurface).toEqual([]);
  });

  it('tallies platform × kind with share-of-total, count desc then label asc', () => {
    const s = summarizeShares(SHARES);
    expect(s.total).toBe(8);
    expect(s.byPlatformKind[0]).toEqual({ platform: 'ios', kind: 'image', label: 'ios · image', count: 3, pct: 37.5 });
    // Six singles tie on count → alphabetical by label.
    const singles = s.byPlatformKind.slice(1).map((r) => r.label);
    expect(singles).toEqual([
      'android · link_invite', 'ios · link_invite', 'web · image', 'web · other', 'web · text',
    ]);
    // Percentages are of the window total and sum to ~100.
    expect(s.byPlatformKind.reduce((a, r) => a + r.pct, 0)).toBeCloseTo(100, 0);
  });

  it('tallies by game mode and surface, folding empty strings into one bucket', () => {
    const s = summarizeShares(SHARES);
    expect(s.byMode[0]).toEqual({ label: 'Six', count: 4, pct: 50 });
    expect(s.byMode.find((r) => r.label === UNLABELED)?.count).toBe(1);
    expect(s.bySurface.map((r) => [r.label, r.count])).toEqual([
      ['post_game', 4], ['leaderboard', 2], ['referral', 1], ['vs_invite', 1],
    ]);
  });

  it('treats null and whitespace-only labels as unlabeled', () => {
    const s = summarizeShares([
      { platform: 'web', kind: 'text', game_mode: null, surface: '   ' },
    ]);
    expect(s.byMode).toEqual([{ label: UNLABELED, count: 1, pct: 100 }]);
    expect(s.bySurface).toEqual([{ label: UNLABELED, count: 1, pct: 100 }]);
  });

  it('kind totals match the platform × kind rollup', () => {
    const s = summarizeShares(SHARES);
    const fromPK = s.byPlatformKind.filter((r) => r.kind === 'image').reduce((a, r) => a + r.count, 0);
    expect(s.byKind.find((r) => r.label === 'image')?.count).toBe(fromPK);
    expect(s.byKind.find((r) => r.label === 'link_invite')?.count).toBe(2);
  });
});

const SINCE = new Date('2026-08-24T00:00:00Z');
const inside = '2026-09-10T12:00:00Z';
const before = '2026-07-01T12:00:00Z';

const REFERRALS: ReferralRow[] = [
  // Created and redeemed in the window, then converted in the window.
  { code: 'AAAA', status: 'converted', created_at: inside, redeemed_at: inside, converted_at: inside },
  // Created before the window, redeemed inside it — counts as a redemption, not a creation.
  { code: 'BBBB', status: 'redeemed', created_at: before, redeemed_at: inside, converted_at: null },
  // Old redemption that converted this window — counts as a conversion only.
  { code: 'CCCC', status: 'converted', created_at: before, redeemed_at: before, converted_at: inside },
  // Created in the window, still pending.
  { code: 'DDDD', status: 'pending', created_at: inside, redeemed_at: null, converted_at: null },
  // Revoked rows never count as redeemed even if a timestamp exists.
  { code: 'EEEE', status: 'revoked', created_at: inside, redeemed_at: inside, converted_at: null },
];

const VISITS: LandingVisitRow[] = [
  { page: 'join', ref: 'AAAA', created_at: inside },
  { page: 'join', ref: 'AAAA', created_at: inside },
  { page: 'join', ref: 'DDDD', created_at: inside },
  { page: 'join', ref: 'ZZZZ', created_at: before }, // outside the window
  { page: 'share', ref: 'Six', created_at: inside },
  { page: 'share', ref: 'Six', created_at: inside },
  { page: 'share', ref: 'Seven', created_at: inside },
  { page: 'share', ref: '', created_at: inside },
  { page: 'share', ref: 'Six', created_at: before }, // outside the window
];

describe('summarizeShareOutcomes', () => {
  it('windows each referral outcome by its own timestamp and ignores revoked rows', () => {
    const o = summarizeShareOutcomes({
      shares: SHARES, referrals: REFERRALS, visits: VISITS, shareSignups: 2, since: SINCE,
    });
    expect(o.invites.shared).toBe(2);
    expect(o.invites.sharedReferral).toBe(1);
    expect(o.invites.created).toBe(3);   // AAAA, DDDD, EEEE
    expect(o.invites.redeemed).toBe(2);  // AAAA, BBBB (CCCC redeemed before; EEEE revoked)
    expect(o.invites.converted).toBe(2); // AAAA, CCCC
  });

  it('counts /join opens and distinct codes inside the window', () => {
    const o = summarizeShareOutcomes({
      shares: SHARES, referrals: REFERRALS, visits: VISITS, shareSignups: 2, since: SINCE,
    });
    expect(o.invites.opens).toBe(3);
    expect(o.invites.codesOpened).toBe(2);
  });

  it('counts /s/ share-page visits by mode and passes signups through', () => {
    const o = summarizeShareOutcomes({
      shares: SHARES, referrals: REFERRALS, visits: VISITS, shareSignups: 2, since: SINCE,
    });
    expect(o.results.shared).toBe(5); // 4 image + 1 text
    expect(o.results.landingVisits).toBe(4);
    expect(o.results.landingVisitsByMode).toEqual([
      { label: 'Six', count: 2, pct: 50 },
      { label: UNLABELED, count: 1, pct: 25 },
      { label: 'Seven', count: 1, pct: 25 },
    ]);
    expect(o.results.signups).toBe(2);
  });

  it('reports null (not 0) for visit-derived numbers when landing_visits is unavailable', () => {
    const o = summarizeShareOutcomes({
      shares: SHARES, referrals: REFERRALS, visits: null, shareSignups: null, since: SINCE,
    });
    expect(o.invites.opens).toBeNull();
    expect(o.invites.codesOpened).toBeNull();
    expect(o.results.landingVisits).toBeNull();
    expect(o.results.landingVisitsByMode).toEqual([]);
    expect(o.results.signups).toBeNull();
    // Referral-derived numbers still work without the visits table.
    expect(o.invites.redeemed).toBe(2);
  });
});
