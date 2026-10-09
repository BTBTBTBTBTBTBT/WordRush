import { describe, expect, it } from 'vitest';
import { dayHash, streakHeadline, STREAK_MILESTONES } from './streak-headline';
import { bannerHeadline, type GroupProgress } from './home-banner';
import { bubbleFit, bubbleWidthEm } from './bubble-text';
import { homeHeadlineFit } from './bubble-text';

const KINDS = ['flawless', 'sweep'] as const;
const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}`;

describe('streak headlines (2.8 items 7 + 48)', () => {
  it('speaks to the streak with the number as the hero (3-peat, week, month)', () => {
    expect(['FLAWLESS 3-PEAT!', 'THREE FLAWLESS DAYS!', 'FLAWLESS · 3 IN A ROW!']).toContain(streakHeadline({ kind: 'flawless', days: 3, dateKey: day(9) }));
    expect(['A WHOLE WEEK FLAWLESS!', 'FLAWLESS WEEK!', '7 DAYS, ZERO MISSES!']).toContain(streakHeadline({ kind: 'flawless', days: 7, dateKey: day(9) }));
    expect(['A FLAWLESS MONTH!', '30 PERFECT DAYS!', 'LEGENDARY · 30 FLAWLESS DAYS!']).toContain(streakHeadline({ kind: 'flawless', days: 30, dateKey: day(9) }));
  });

  it('has curated lines at every milestone, for flawless and sweep', () => {
    for (const kind of KINDS) for (const n of STREAK_MILESTONES) {
      const l = streakHeadline({ kind, days: n, dateKey: day(9) });
      expect(l, `${kind} ${n}`).toBeTruthy();
    }
  });

  it('shows NEW BEST! on a record run that is not a milestone, and the milestone wins on a milestone day', () => {
    expect(streakHeadline({ kind: 'flawless', days: 8, best: 8, dateKey: day(9) })).toMatch(/NEW (BEST|RECORD)|A NEW RECORD/);
    expect(streakHeadline({ kind: 'flawless', days: 8, best: 20, dateKey: day(9) })).not.toMatch(/NEW BEST|NEW RECORD/);
    expect(streakHeadline({ kind: 'flawless', days: 7, best: 7, dateKey: day(9) })).not.toMatch(/NEW BEST|NEW RECORD/);
  });

  it('is kind after a break: a fresh-start line only when a real run (best >= 3) just ended; null otherwise', () => {
    expect(streakHeadline({ kind: 'flawless', days: 1, best: 9, dateKey: day(9) })).toMatch(/FRESH START|BACK ON TRACK|NEW STREAK/);
    expect(streakHeadline({ kind: 'flawless', days: 1, best: 1, dateKey: day(9) })).toBeNull();
    expect(streakHeadline({ kind: 'sweep', days: 0, dateKey: day(9) })).toBeNull();
  });

  it('puts the streak number in every line (so the bubble renderer can pop it) except restarts', () => {
    for (const kind of KINDS) for (let n = 2; n <= 60; n++) {
      for (const d of [9, 10, 11]) {
        const l = streakHeadline({ kind, days: n, best: n, dateKey: day(d) })!;
        const spelled = ['TWICE', 'BACK-TO-BACK', 'THREE', 'FOUR', 'FIVE', 'SIX', 'TEN', 'WEEK', 'FORTNIGHT', 'MONTH', 'TWO', 'DIGITS'];
        expect(/\d/.test(l) || spelled.some((w) => l.includes(w)), `${kind} ${n}: ${l}`).toBe(true);
      }
    }
  });

  it('varies by day (deterministic by date) so it never repeats flatly', () => {
    for (const kind of KINDS) for (const n of [3, 5, 7, 12]) {
      const lines = new Set([9, 10, 11, 12, 13, 14, 15, 16].map((d) => streakHeadline({ kind, days: n, dateKey: day(d) })));
      expect(lines.size, `${kind} ${n}`).toBeGreaterThan(1);
      expect(streakHeadline({ kind, days: n, dateKey: day(9) })).toBe(streakHeadline({ kind, days: n, dateKey: day(9) }));
    }
    expect(dayHash('2026-10-09')).toBe(dayHash('2026-10-09'));
  });

  it('is American spelling, upper case, and fits in full at the narrowest and widest slots (no "FLAWLES…")', () => {
    for (const kind of KINDS) for (let n = 0; n <= 60; n++) for (const d of [9, 10, 11]) {
      const l = streakHeadline({ kind, days: n, best: n, dateKey: day(d) });
      if (!l) continue;
      expect(l).toBe(l.toUpperCase());
      expect(l).not.toMatch(/COLOUR|NEIGHBOUR|FAVOUR|GREY|CENTRE|…/);
      for (const slot of [220, 285, 334, 520, 760]) {
        const f = bubbleFit(l, slot, { maxSize: 38 });
        expect(f.lines.join('').replace(/ /g, ''), l).toBe(l.replace(/ /g, ''));
        for (const line of f.lines) expect(bubbleWidthEm(line) * f.size, `${l} @${slot}`).toBeLessThanOrEqual(slot + 1e-6);
        const h = homeHeadlineFit(l, 'BMT', slot);
        for (const line of h.lines) expect(bubbleWidthEm(line) * h.size, `${l} home @${slot}`).toBeLessThanOrEqual(slot + 1e-6);
      }
    }
  });

  it('feeds the Home banner headline: streak line when there is news, the plain line otherwise', () => {
    const g = (played: number, won: number, total: number): GroupProgress => ({ played, won, total });
    const streaks = { word: { sweep: 5, flawless: 3, bestFlawless: 9 }, puzzles: { sweep: 0, flawless: 0 } };
    const l = bannerHeadline(g(8, 8, 8), g(2, 2, 10), { hour: 14, name: 'BMT', streaks, dateKey: day(9) });
    expect(l).toBe(streakHeadline({ kind: 'flawless', days: 3, best: 9, dateKey: day(9) }));
    // no streaks passed = exactly the old line
    expect(bannerHeadline(g(8, 8, 8), g(2, 2, 10), { hour: 14, name: 'BMT' })).toBe('WORDOCIOUS FLAWLESS! 8 PUZZLES LEFT');
    // first flawless day with no past run: plain line
    const first = { word: { sweep: 1, flawless: 1, bestFlawless: 1 }, puzzles: { sweep: 0, flawless: 0 } };
    expect(bannerHeadline(g(8, 8, 8), g(2, 2, 10), { hour: 14, name: 'BMT', streaks: first, dateKey: day(9) })).toBe('WORDOCIOUS FLAWLESS! 8 PUZZLES LEFT');
    // unlimited / before play unaffected
    expect(bannerHeadline(g(0, 0, 8), g(0, 0, 10), { hour: 14, name: 'BMT', streaks, dateKey: day(9) })).toBe('GOOD AFTERNOON, BMT!');
  });
});
