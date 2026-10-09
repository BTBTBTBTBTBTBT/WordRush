import { describe, expect, it } from 'vitest';
import { bannerHeadline, headlineWidthEm, type GroupProgress } from '@wordle-duel/core';
import { HEADLINE_LINE_EM, headlineRowHeight, headlineTextWidth, homeHeadlineLayout } from './home-headline';
import { BANNER_SLOT, homeBannerSlots } from './stationary-layout';

const none: GroupProgress = { played: 0, won: 0, total: 8 } as GroupProgress;
const greet = (name: string, hour = 14) => bannerHeadline(none, { ...none, total: 10 }, { hour, name, unlimited: false });

// A 390 phone's slot (358 card − 2 × 12), the SE (320 phone → 285 here), a desktop column.
const PHONE = 334;
const SE = 285;
const WIDE = 560;

describe('BJ6 round 4: the personal Home headline (web mapping of core headlineLayout)', () => {
  it('a short name stays on one line when the slot is wide', () => {
    const l = homeHeadlineLayout(WIDE, greet('BMT'), 'BMT');
    expect(l.lines).toEqual([greet('BMT')]);
    expect(l.nameLines).toEqual([]);
    expect(l.size).toBeLessThanOrEqual(38);
  });

  it('stacks the name on its own gold line at the SE width, at the same size', () => {
    const l = homeHeadlineLayout(SE, greet('BMT'), 'BMT');
    expect(l.lines.length).toBe(2);
    expect(l.lines[0]).toBe('GOOD AFTERNOON,');
    expect(l.lines[1]).toBe('BMT!');
    expect(l.nameLines).toEqual([1]);
    expect(l.lineHeight).toBe(Math.ceil(l.size * HEADLINE_LINE_EM));
  });

  it('the longest allowed (20-char) names never exceed the width — no shrink, no clip', () => {
    const names = ['UkrainianCyclone2026', 'WWWWWWWWWWWWWWWWWWWW', 'MMMMMMMMMMMMMMMMMMMM', 'a_b_c_d_e_f_g_h_i_j_', 'QuadWordQueenOfTheNt'];
    for (const w of [SE, PHONE, WIDE]) {
      for (const n of names) {
        for (const hour of [2, 9, 14, 20]) {
          const text = greet(n, hour);
          const l = homeHeadlineLayout(w, text, n);
          const maxEm = headlineTextWidth(w) / l.size;
          for (const line of l.lines) expect(headlineWidthEm(line), `${w} ${n} ${line}`).toBeLessThanOrEqual(maxEm + 1e-9);
          // Every letter of the name is still there (never clipped).
          expect(l.lines.join('').replace(/[^A-Z0-9_]/g, '')).toContain(n.toUpperCase().replace(/[^A-Z0-9_]/g, ''));
        }
      }
    }
  });

  it('the row grows exactly by the extra lines (the taller mode) and the card follows', () => {
    const one = homeHeadlineLayout(WIDE, greet('BMT'), 'BMT');
    const two = homeHeadlineLayout(SE, greet('BMT'), 'BMT');
    expect(headlineRowHeight([one])).toBe(one.lineHeight);
    expect(headlineRowHeight([one, two])).toBe(2 * two.lineHeight);
    const input = { dailyTier: 'none' as const, puzzleTier: 'none' as const, playedAny: true };
    const base = homeBannerSlots('daily', input).height;
    const grown = homeBannerSlots('daily', { ...input, headlineHeight: 2 * two.lineHeight }).height;
    expect(grown - base).toBe(2 * two.lineHeight - BANNER_SLOT.headline);
    // The switch never moves anything: both modes get the same slots.
    expect(homeBannerSlots('unlimited', { ...input, headlineHeight: 80 })).toEqual(homeBannerSlots('daily', { ...input, headlineHeight: 80 }));
  });

  it('a guest greeting is one line on a phone', () => {
    const l = homeHeadlineLayout(PHONE, greet(''), '');
    expect(l.lines.length).toBe(1);
  });
});

describe('2.8 item 6: nameless long headlines wrap instead of truncating (no clip at any width)', () => {
  const texts = [
    'WORDOCIOUS FLAWLESS! 10 PUZZLES LEFT', 'PUZZLES FLAWLESS! 4 PUZZLES LEFT', 'WORDOCIOUS SWEPT! 1 PUZZLE LEFT',
    'ON A ROLL \u00b7 11 OF 18', 'HOME STRETCH \u00b7 12 LEFT', 'FLAWLESS + SWEEP!', 'UNLIMITED PLAY',
  ];
  // 360 px web column (card 360 - 24 padding - sparkles) up to a wide desktop column.
  for (const w of [296, SE, PHONE, 400, WIDE, 760]) {
    it(`every status headline fits a ${w}px slot in full`, () => {
      for (const t of texts) {
        for (const name of ['', 'BMT']) {
          const l = homeHeadlineLayout(w, t, name);
          const strip = (s: string) => s.replace(/[^A-Z0-9!+\u00b7]/g, '');
          expect(strip(l.lines.join('')), t).toBe(strip(t));
          for (const line of l.lines) {
            expect(line).not.toContain('\u2026');
            expect(headlineWidthEm(line) * l.size, `${w} ${t} "${line}"`).toBeLessThanOrEqual(l.textWidth + 1e-6);
          }
        }
      }
    });
  }

  it('the long flawless line is two balanced lines on a phone', () => {
    const l = homeHeadlineLayout(PHONE, 'WORDOCIOUS FLAWLESS! 3 PUZZLES LEFT', '');
    expect(l.lines).toEqual(['WORDOCIOUS FLAWLESS!', '3 PUZZLES LEFT']);
  });
});
