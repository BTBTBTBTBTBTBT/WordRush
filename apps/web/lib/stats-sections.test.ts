import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STATS, VIEW_SWEEP, VIEW_ALL, gameSwipeNeighbor, gameSwipeOrder, isPageSwipe, openStatsGame, parseStatsParams,
  pickStatsGame, statsSections, statsUrl, viewUrl,
} from './stats-view';
import { SWEEP_KEY } from './game-picker';

// FINISH_SPEC BJ1: no Today | All-time toggle — every view is ONE scroll, Today first, All-time beneath.

const isGame = (k: string) => ['DUEL', 'QUORDLE', 'HUB'].includes(k);

describe('Stats: Today then All-time, one scroll per game', () => {
  it('opens on Overview with both sections', () => {
    expect(DEFAULT_STATS).toEqual({ game: null });
    expect(statsSections(DEFAULT_STATS)).toEqual(['today-overview', 'all-overview']);
  });
  it('a game shows its own Today then its own All-time — always both, Today first', () => {
    expect(statsSections({ game: 'QUORDLE' })).toEqual(['today-game', 'all-game']);
    expect(statsSections({ game: VIEW_SWEEP })).toEqual(['today-sweep', 'all-sweep']);
    for (const g of [null, 'DUEL', VIEW_SWEEP]) {
      const [a, b] = statsSections({ game: g });
      expect(a.startsWith('today-')).toBe(true);
      expect(b.startsWith('all-')).toBe(true);
    }
  });
  it('the state has no scope — only the game', () => {
    expect(Object.keys(pickStatsGame(DEFAULT_STATS, 'HUB'))).toEqual(['game']);
  });
  it('picking a game swaps it; re-tapping the picked game returns to Overview', () => {
    const a = pickStatsGame(DEFAULT_STATS, 'HUB');
    expect(a).toEqual({ game: 'HUB' });
    expect(pickStatsGame(a, 'DUEL')).toEqual({ game: 'DUEL' });
    expect(pickStatsGame(a, 'HUB')).toEqual({ game: null });
    expect(openStatsGame(a, 'HUB')).toBe(a); // a jump never toggles off
  });
  it('round-trips through the URL; the legacy ?scope= / ?view=all-time links land on Overview', () => {
    for (const s of [DEFAULT_STATS, { game: 'QUORDLE' }, { game: VIEW_SWEEP }]) {
      const u = new URL(statsUrl(s), 'https://x.test');
      expect(parseStatsParams(u.searchParams.get('view'), isGame)).toEqual(s);
    }
    expect(statsUrl(DEFAULT_STATS)).toBe('/stats');
    expect(parseStatsParams('all-time', isGame)).toEqual(DEFAULT_STATS);
    expect(parseStatsParams('vs', isGame)).toEqual(DEFAULT_STATS);
    expect(parseStatsParams('NOPE', isGame)).toEqual(DEFAULT_STATS);
    const legacy = new URL(viewUrl(VIEW_ALL), 'https://x.test');
    expect(parseStatsParams(legacy.searchParams.get('view'), isGame)).toEqual(DEFAULT_STATS);
  });
  it('the swipe walks the games (Overview first) and keeps the diagonal-scroll guard', () => {
    const order = gameSwipeOrder({ wordocious: [{ key: 'DUEL' }, { key: SWEEP_KEY }] as any, puzzles: [{ key: 'HUB' }] as any });
    expect(order).toEqual([null, 'DUEL', VIEW_SWEEP, 'HUB']);
    expect(gameSwipeNeighbor(order, null, 1)).toBe('DUEL');
    expect(gameSwipeNeighbor(order, 'DUEL', -1)).toBeNull();
    expect(gameSwipeNeighbor(order, null, -1)).toBeUndefined();
    expect(gameSwipeNeighbor(order, 'HUB', 1)).toBeUndefined();
    expect(isPageSwipe(70, 35)).toBe(true);
    expect(isPageSwipe(69, 0)).toBe(false);
    expect(isPageSwipe(100, 51)).toBe(false);
  });
});
