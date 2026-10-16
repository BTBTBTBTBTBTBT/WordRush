import { describe, expect, it } from 'vitest';
import { bannerHeadline, headlineWidthEm, type GroupProgress } from '@wordle-duel/core';
import { HEADLINE_LINE_EM, headlineReserveHeight, headlineTextWidth, homeHeadlineLayout } from './home-headline';

// Founder 10-15: the headline row reserves TWO full-size lines, so a headline that arrives later (streaks, sweeps)
// never moves the switch, the clock or the trio. This sweeps far more slots, names and headlines than the spot checks.

const prog = (played: number, won: number, total: number): GroupProgress => ({ played, won, total } as GroupProgress);
const NAMES = ['', 'Al', 'BMT', 'Juniper', 'VowelMaven', 'UkrainianCyclone2026', 'WWWWWWWWWWWWWWWWWWWW', 'a_b_c_d_e_f_g_h_i_j_'];
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 23];
const PROGRESS: Array<[GroupProgress, GroupProgress]> = [
  [prog(0, 0, 8), prog(0, 0, 10)],
  [prog(3, 3, 8), prog(0, 0, 10)],
  [prog(8, 8, 8), prog(0, 0, 10)],
  [prog(8, 6, 8), prog(10, 10, 10)],
  [prog(8, 8, 8), prog(10, 10, 10)],
  [prog(7, 7, 8), prog(9, 9, 10)],
  [prog(1, 0, 8), prog(2, 1, 10)],
];
const STATUS = [
  'WORDOCIOUS FLAWLESS! 10 PUZZLES LEFT', 'PUZZLES FLAWLESS! 4 PUZZLES LEFT', 'WORDOCIOUS SWEPT! 1 PUZZLE LEFT',
  'ON A ROLL · 11 OF 18', 'HOME STRETCH · 12 LEFT', 'FLAWLESS + SWEEP!', 'UNLIMITED PLAY', 'A NEW STREAK STARTS NOW!',
  'W', 'GOOD MORNING!',
];
// The SE slot (285) up to a wide desktop column, every 16 px, plus the two phone references.
const WIDTHS = [...Array.from({ length: (900 - 240) / 16 + 1 }, (_, i) => 240 + i * 16), 285, 334, 358];

function* headlines(): Generator<[string, string]> {
  for (const name of NAMES) {
    for (const t of STATUS) yield [t, name];
    for (const hour of HOURS) {
      for (const [daily, puzzles] of PROGRESS) {
        for (const unlimited of [false, true]) yield [bannerHeadline(daily, puzzles, { hour, name, unlimited }), name];
      }
    }
  }
}

describe('headlineReserveHeight covers every 1–2 line headline (founder 10-15)', () => {
  it('is exactly two lines at the slot\'s full lettering size, and never shrinks as the slot widens', () => {
    let prev = 0;
    for (const w of [...WIDTHS].sort((a, b) => a - b)) {
      const one = homeHeadlineLayout(w, 'W', '');
      expect(one.lines.length, `${w}`).toBe(1);
      const reserve = headlineReserveHeight(w);
      expect(reserve, `${w}`).toBe(2 * one.lineHeight);
      expect(one.lineHeight).toBe(Math.ceil(one.size * HEADLINE_LINE_EM));
      expect(reserve, `${w}`).toBeGreaterThanOrEqual(prev);
      prev = reserve;
    }
  });

  it('every one- and two-line headline, at every width, fits inside the reserve (no size is larger than the one-letter line)', () => {
    let checked = 0, twoLines = 0;
    for (const w of WIDTHS) {
      const reserve = headlineReserveHeight(w);
      const full = homeHeadlineLayout(w, 'W', '').size;
      for (const [text, name] of headlines()) {
        const l = homeHeadlineLayout(w, text, name);
        const tag = `${w}px "${text}" / ${name}`;
        expect(l.size, tag).toBeLessThanOrEqual(full);
        if (l.lines.length <= 2) {
          expect(l.lines.length * l.lineHeight, tag).toBeLessThanOrEqual(reserve);
          if (l.lines.length === 2) twoLines += 1;
        }
        // Whatever the line count, every line fits the text column.
        for (const line of l.lines) expect(headlineWidthEm(line) * l.size, tag).toBeLessThanOrEqual(headlineTextWidth(w) + 1e-6);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(5000);
    expect(twoLines).toBeGreaterThan(100);
  });

  it('a guest greeting and a short-name greeting on a 390 phone take at most the reserve', () => {
    for (const hour of HOURS) {
      for (const name of ['', 'BMT', 'Juniper']) {
        const l = homeHeadlineLayout(334, bannerHeadline(prog(0, 0, 8), prog(0, 0, 10), { hour, name, unlimited: false }), name);
        expect(l.lines.length, `${hour} ${name}`).toBeLessThanOrEqual(2);
        expect(l.lines.length * l.lineHeight).toBeLessThanOrEqual(headlineReserveHeight(334));
      }
    }
  });
});
