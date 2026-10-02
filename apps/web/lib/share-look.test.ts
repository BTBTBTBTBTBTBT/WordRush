import { describe, it, expect } from 'vitest';
import {
  LEADERBOARD_SHARE_ART, SHARE_SITE, TILE_GLOSS,
  fallbackSharePoints, gameShareArt, glossFrom, shareClock, shareDateLine, shareDayKey,
  shareDetailBits, shareInfoLine, shareModeMeta, shareShortDate, shareStatWindows, shareSweepInfo,
} from './share-look';
import { ART_SIZE, type ArtName } from './art';
import { GAME_HOSTS } from './mascots';
import { MODES } from './modes.generated';
import type { ShareImageInput, ShareMode } from './share-image';

const hasArt = (name: string) => name in ART_SIZE;

describe('compact info line (S2)', () => {
  const d = new Date(2026, 9, 2); // Friday, Oct 2 2026 (local)
  const single: ShareImageInput = {
    layout: 'single', mode: 'Classic', won: true, guesses: 4, maxGuesses: 6, timeSeconds: 48, grid: [],
  };

  it('reads date · guesses · time with a W badge', () => {
    expect(shareShortDate(d)).toBe('FRI, OCT 2');
    expect(shareInfoLine(single, d)).toEqual({ text: 'FRI, OCT 2 · 4/6 GUESSES · 0:48', badge: 'W' });
  });

  it('a loss gets the L badge and X', () => {
    expect(shareInfoLine({ ...single, won: false }, d)).toEqual({ text: 'FRI, OCT 2 · X/6 GUESSES · 0:48', badge: 'L' });
  });

  it('names the puzzle and uses the game measure for More Games', () => {
    const sudoku: ShareImageInput = {
      layout: 'sudoku', mode: 'Sudocious', won: true, guesses: 1, maxGuesses: 4, timeSeconds: 238,
      givens: '', board: '', hintMask: '', mistakes: 0, difficulty: 'Hard', puzzleNumber: 12,
    };
    expect(shareInfoLine(sudoku, d).text).toBe('FRI, OCT 2 · #12 · HARD · 0 MISTAKES · 3:58');
    const multi: ShareImageInput = {
      layout: 'multi', mode: 'QuadWord', won: true, guesses: 8, maxGuesses: 9, timeSeconds: 125,
      boards: [], boardsSolved: 4, totalBoards: 4,
    };
    expect(shareInfoLine(multi, d).text).toBe('FRI, OCT 2 · 4/4 BOARDS · 8/9 GUESSES · 2:05');
  });

  it('the Sweep line counts wins and only badges a flawless sweep', () => {
    const sweep = {
      layout: 'daily-sweep' as const, mode: 'Classic' as ShareMode, flawless: false, games: [],
      total: 9, won: 8, totalGuesses: 30, totalTimeSeconds: 900, totalScore: 15000,
    };
    expect(shareSweepInfo(sweep, d)).toEqual({ text: 'FRI, OCT 2 · 8/9 WON · 15:00', badge: null });
    expect(shareSweepInfo({ ...sweep, won: 9, title: 'More Games Sweep' }, d))
      .toEqual({ text: 'FRI, OCT 2 · MORE GAMES SWEEP · 9/9 WON · 15:00', badge: 'W' });
    expect(shareInfoLine(sweep, d)).toEqual(shareSweepInfo(sweep, d));
  });

  it('the site line under the cast wordmark', () => {
    expect(SHARE_SITE).toBe('wordocious.com');
  });
});

describe('card art', () => {
  it('every sweep game has a wallpaper + title art that ship, and its host', () => {
    for (const m of MODES.filter((x) => x.dbKey && x.sweep)) {
      const art = gameShareArt(m.title as ShareMode);
      expect(hasArt(art.wall)).toBe(true);
      expect(art.title === null || hasArt(art.title)).toBe(true);
      expect(art.host).toBe(GAME_HOSTS[m.dbKey as string]);
    }
    expect(gameShareArt('Classic')).toEqual({ wall: 'art-wall-game-practice', title: 'art-game-practice', host: 'w' });
  });

  it('non-game modes fall back to the home wallpaper with no title art', () => {
    expect(gameShareArt('DailySweep')).toEqual({ wall: 'art-wall-home', title: null, host: null });
    expect(shareModeMeta('WeeklyRace')).toBeNull();
  });

  it('every leaderboard variant has shipped page art and a page-name fallback (never WORDOCIOUS)', () => {
    for (const v of Object.values(LEADERBOARD_SHARE_ART)) {
      expect(hasArt(`art-wall-${v.wall}` as ArtName)).toBe(true);
      expect(hasArt(v.title)).toBe(true);
      expect(v.label.length).toBeGreaterThan(0);
      expect(v.label).not.toMatch(/wordocious/i);
    }
  });
});

describe('glossy tiles', () => {
  it('matches the game kit tile colors', () => {
    expect(TILE_GLOSS.CORRECT).toEqual({ light: '#a66bff', base: '#7c3aed', bot: '#6a2bd6', edge: '#4c1d95' });
    expect(TILE_GLOSS.PRESENT.base).toBe('#f5a524');
    expect(TILE_GLOSS.ABSENT.base).toBe('#6b7891');
  });

  it('derives a lighter top and darker lip from any accent', () => {
    const g = glossFrom('#7c3aed');
    expect(g.base).toBe('#7c3aed');
    const lum = (h: string) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
    expect(lum(g.light)).toBeGreaterThan(lum(g.base));
    expect(lum(g.bot)).toBeLessThan(lum(g.base));
    expect(lum(g.edge)).toBeLessThan(lum(g.bot));
  });
});

describe('date line + stat windows', () => {
  const d = new Date(2026, 9, 2); // Friday, Oct 2 2026 (local)

  it('formats the letterspaced date line', () => {
    expect(shareDateLine(d)).toBe('FRIDAY, OCT 2');
    expect(shareDateLine(d, ['#217', null, '', 'Hard'])).toBe('FRIDAY, OCT 2 · #217 · HARD');
    expect(shareDayKey(d)).toBe('2026-10-02');
  });

  it('clock reads m:ss', () => {
    expect(shareClock(48)).toBe('0:48');
    expect(shareClock(252)).toBe('4:12');
  });

  const single: ShareImageInput = {
    layout: 'single', mode: 'Classic', won: true, guesses: 4, maxGuesses: 6, timeSeconds: 48,
    grid: [['ABSENT', 'ABSENT', 'ABSENT', 'PRESENT', 'ABSENT'], ['CORRECT', 'CORRECT', 'CORRECT', 'CORRECT', 'CORRECT']],
  };

  it('purple guesses · blue time · gold points', () => {
    const [a, b, c] = shareStatWindows(single, 2005.4);
    expect(a).toEqual({ value: '4/6', label: 'GUESSES', tone: 'purple' });
    expect(b).toEqual({ value: '0:48', label: 'TIME', tone: 'blue' });
    expect(c).toEqual({ value: '2,005', label: 'POINTS', tone: 'gold' });
  });

  it('a loss reads X/6, and unknown points fall back to the result', () => {
    const [a, , c] = shareStatWindows({ ...single, won: false }, null);
    expect(a.value).toBe('X/6');
    expect(c).toEqual({ value: 'Loss', label: 'RESULT', tone: 'gold' });
  });

  it('More Games use their own measure in the purple window', () => {
    const sudoku: ShareImageInput = {
      layout: 'sudoku', mode: 'Sudocious', won: true, guesses: 1, maxGuesses: 4, timeSeconds: 238,
      givens: '0'.repeat(81), board: '0'.repeat(81), hintMask: '0'.repeat(81), mistakes: 1, difficulty: 'Hard', puzzleNumber: 12,
    };
    expect(shareStatWindows(sudoku, 1500)[0]).toEqual({ value: '1', label: 'MISTAKE', tone: 'purple' });
    expect(shareDetailBits(sudoku)).toEqual(['#12', 'Hard']);
    const hub: ShareImageInput = {
      layout: 'hub', mode: 'Hubbub', won: true, guesses: 1, maxGuesses: 5, timeSeconds: 0,
      rankName: 'Uproar', pct: 72, wordsFound: 18, wordCount: 40, pangramsFound: 1,
    };
    const [h1, h2] = shareStatWindows(hub, undefined);
    expect(h1).toEqual({ value: '18', label: 'WORDS', tone: 'purple' });
    expect(h2).toEqual({ value: '72%', label: 'OF MAX', tone: 'blue' });
  });

  it('recomputes points for hint-free word modes only', () => {
    const pts = fallbackSharePoints(single, '2026-10-02');
    expect(typeof pts).toBe('number');
    expect(pts!).toBeGreaterThan(1000);
    // Classic Six carries hints the card doesn't know about → no guess.
    expect(fallbackSharePoints({ ...single, mode: 'Six', maxGuesses: 7 }, '2026-10-02')).toBeNull();
  });
});
