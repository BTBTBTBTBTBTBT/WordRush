import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STATS, VIEW_SWEEP, gameSwipeNeighbor, gameSwipeOrder, openStatsGame, parseStatsParams, pickStatsGame,
  setStatsScope, statsCell, statsUrl, viewUrl, VIEW_ALL,
} from './stats-view';
import { SWEEP_KEY } from './game-picker';

// FINISH_SPEC BG: Today | All-time and the game picker work TOGETHER.

const isGame = (k: string) => ['DUEL', 'QUORDLE', 'HUB'].includes(k);

describe('scope × game', () => {
  it('opens on Today + Overview', () => {
    expect(DEFAULT_STATS).toEqual({ scope: 'today', game: null });
    expect(statsCell(DEFAULT_STATS)).toBe('today-overview');
  });
  it('resolves each of the four cells', () => {
    expect(statsCell({ scope: 'today', game: null })).toBe('today-overview');
    expect(statsCell({ scope: 'today', game: 'QUORDLE' })).toBe('today-game');
    expect(statsCell({ scope: 'all', game: null })).toBe('all-overview');
    expect(statsCell({ scope: 'all', game: 'QUORDLE' })).toBe('all-game');
  });
  it('toggling keeps the game (Today/QuadWord → All-time/QuadWord)', () => {
    expect(setStatsScope({ scope: 'today', game: 'QUORDLE' }, 'all')).toEqual({ scope: 'all', game: 'QUORDLE' });
    expect(setStatsScope({ scope: 'all', game: null }, 'today')).toEqual({ scope: 'today', game: null });
  });
  it('picking keeps the scope; re-tapping the picked game returns to Overview', () => {
    const a = pickStatsGame({ scope: 'all', game: null }, 'HUB');
    expect(a).toEqual({ scope: 'all', game: 'HUB' });
    expect(pickStatsGame(a, 'DUEL')).toEqual({ scope: 'all', game: 'DUEL' });
    expect(pickStatsGame(a, 'HUB')).toEqual({ scope: 'all', game: null });
    expect(openStatsGame(a, 'HUB')).toBe(a); // a jump never toggles off
  });
  it('round-trips through the URL, and reads the legacy ?view= links', () => {
    for (const s of [DEFAULT_STATS, { scope: 'all' as const, game: null }, { scope: 'today' as const, game: 'QUORDLE' }, { scope: 'all' as const, game: VIEW_SWEEP }]) {
      const u = new URL(statsUrl(s), 'https://x.test');
      expect(parseStatsParams(u.searchParams.get('scope'), u.searchParams.get('view'), isGame)).toEqual(s);
    }
    expect(statsUrl(DEFAULT_STATS)).toBe('/stats');
    expect(parseStatsParams(null, 'all-time', isGame)).toEqual({ scope: 'all', game: null });
    expect(parseStatsParams(null, 'vs', isGame)).toEqual({ scope: 'all', game: null });
    expect(parseStatsParams(null, 'NOPE', isGame)).toEqual(DEFAULT_STATS);
    const legacy = new URL(viewUrl(VIEW_ALL), 'https://x.test');
    expect(parseStatsParams(legacy.searchParams.get('scope'), legacy.searchParams.get('view'), isGame)).toEqual({ scope: 'all', game: null });
  });
  it('swipe changes the game only', () => {
    const order = gameSwipeOrder({ wordocious: [{ key: 'DUEL' }, { key: SWEEP_KEY }] as any, puzzles: [{ key: 'HUB' }] as any });
    expect(order).toEqual([null, 'DUEL', VIEW_SWEEP, 'HUB']);
    expect(gameSwipeNeighbor(order, null, 1)).toBe('DUEL');
    expect(gameSwipeNeighbor(order, 'DUEL', -1)).toBeNull();
    expect(gameSwipeNeighbor(order, null, -1)).toBeUndefined();
    expect(gameSwipeNeighbor(order, 'HUB', 1)).toBeUndefined();
  });
});
