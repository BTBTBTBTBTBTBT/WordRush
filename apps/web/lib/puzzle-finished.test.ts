import { describe, expect, it } from 'vitest';
import { MIN_PHONE_HEIGHT } from './finished-layout';
import { MORE_PEEK, clockTime, finishedBoardRoom, guessStatParts } from './puzzle-finished';

describe('guessStatParts', () => {
  it('splits "N word" stats into value + label', () => {
    expect(guessStatParts('mistakes', 1, 3)).toEqual({ value: '2', label: 'mistakes' });
    expect(guessStatParts('mistakes', 1, 2)).toEqual({ value: '1', label: 'mistake' });
    expect(guessStatParts('checks', 5, 7)).toEqual({ value: '7', label: 'checks' });
    expect(guessStatParts('misses', 10, 13)).toEqual({ value: '3', label: 'misses' });
    expect(guessStatParts('guesses', 1, 4)).toEqual({ value: '4', label: 'guesses' });
  });
  it('keeps one-word stats whole with a short label', () => {
    expect(guessStatParts('overPar', 1, 1)).toEqual({ value: 'Par', label: 'par' });
    expect(guessStatParts('overPar', 1, 3)).toEqual({ value: '+2', label: 'par' });
    expect(guessStatParts('rank', 1, 4)).toEqual({ value: 'Hubbub', label: 'rank' });
  });
});

describe('clockTime', () => {
  it('formats m:ss', () => {
    expect(clockTime(0)).toBe('0:00');
    expect(clockTime(48)).toBe('0:48');
    expect(clockTime(65)).toBe('1:05');
    expect(clockTime(750.7)).toBe('12:30');
  });
});

// The 667 px arithmetic (FINISH_SPEC R2: buttons visible without scrolling on
// an iPhone SE, the tab bar included). Measured from the CSS:
//   header  = 52 (6 pad + 44 corner row + 2) + title art (343 px wide × the
//             art's ratio, capped 84 under 700 tall) + status line (4 + 16)
//             + 6 bottom; Crosswordocious / Spyglass add the puzzle title
//             line (2 + 20); Muddle's compact status line is 2 + 11.
//   strip   = 26 (pills) + 6 + 2 = 34.
//   dock    = 8 + 44 (share glyph / md candy 40 + 4 lip) + 6 = 58; Pro adds
//             8 + the Unlimited card (~80) = 146.
//   tab bar = 8 + 2 + 30 icon + 2 + 16.5 label + 2 + 3 pill + 2 + 6 + 1 ≈ 72.
//   peek    = the More row, 40.
const TAB_BAR = 72;
const STRIP = 34;
const DOCK = { free: 58, pro: 146 };
const HEADERS: Record<string, number> = {
  Sudocious: 52 + 84 + 20 + 6,          // art 343 × 234/617 = 130 → 84
  Muddle: 52 + 84 + 13 + 6,             // 343 × 211/817 = 89 → 84
  Hubbub: 52 + 84 + 20 + 6,             // 343 × 231/898 = 88 → 84
  Crosswordocious: 52 + 84 + 22 + 18 + 6, // 343 × 220/900 = 84
  Kindred: 52 + 84 + 20 + 6,            // 343 × 231/895 = 89 → 84
  'Letter Ladder': 52 + 64 + 20 + 6,    // 343 × 168/900 = 64
  Codebreaker: 52 + 69 + 20 + 6,        // 343 × 181/900 = 69
  Spyglass: 52 + 84 + 22 + 20 + 6,      // 343 × 226/846 = 92 → 84
  Starsweep: 52 + 82 + 20 + 6,          // 343 × 214/900 = 82
};

describe('finishedBoardRoom at 667 px', () => {
  for (const [game, header] of Object.entries(HEADERS)) {
    it(`${game}: the board keeps a usable room, free and Pro`, () => {
      const free = finishedBoardRoom({ viewport: MIN_PHONE_HEIGHT, header, strip: STRIP, dock: DOCK.free, tabBar: TAB_BAR, peek: MORE_PEEK });
      const pro = finishedBoardRoom({ viewport: MIN_PHONE_HEIGHT, header, strip: STRIP, dock: DOCK.pro, tabBar: TAB_BAR, peek: MORE_PEEK });
      expect(free).toBeGreaterThanOrEqual(270);
      // Pro: still ≥ 0.5 of a 370 px square board (the FitBox floor is 0.4).
      expect(pro).toBeGreaterThanOrEqual(185);
      expect(free - pro).toBe(DOCK.pro - DOCK.free);
    });
  }
});
