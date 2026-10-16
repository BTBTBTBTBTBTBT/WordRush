import { describe, expect, it } from 'vitest';
import {
  HEADLINE_BANK, HEADLINE_PACKS, LAST_GAME_FRESH_MINUTES, SURPRISE_RATE, fillHeadline, headlineFitsSlot, headlinePack,
  selectHomeHeadline, timeBucket, weekdayOf, type HeadlineContext,
} from './home-headline-pool';
import { bubbleWidthEm, homeHeadlineFit } from './bubble-text';
import { headlineFontSize } from './headline-tokens';

const g = (played: number, won: number, total: number) => ({ played, won, total });
const base = (over: Partial<HeadlineContext> = {}): HeadlineContext => ({
  name: 'BMT', hour: 9, dateKey: '2026-10-16', word: g(0, 0, 8), puzzles: g(0, 0, 10), nextGame: 'Muddle', userSeed: 'u1', ...over,
});
const ALL_LINES = Object.entries(HEADLINE_BANK).flatMap(([tag, pool]) => pool.map((line) => ({ tag, line })));

describe('time buckets and calendar', () => {
  it('maps every hour to a bucket', () => {
    expect([0, 4, 5, 7, 8, 11, 12, 13, 14, 16, 17, 20, 21, 23].map(timeBucket)).toEqual([
      'lateNight', 'lateNight', 'earlyMorning', 'earlyMorning', 'morning', 'morning', 'midday', 'midday',
      'afternoon', 'afternoon', 'evening', 'evening', 'night', 'night',
    ]);
  });
  it('finds the pack for a date (wrapping New Year)', () => {
    expect(headlinePack('2026-10-16')).toBe('halloween');
    expect(headlinePack('2026-11-20')).toBe('thanksgiving');
    expect(headlinePack('2026-12-25')).toBe('winter');
    expect(headlinePack('2026-12-31')).toBe('newyear');
    expect(headlinePack('2027-01-03')).toBe('newyear');
    expect(headlinePack('2026-08-10')).toBeNull();
    expect(HEADLINE_PACKS.map((p) => p.id)).toContain('winter');
  });
  it('knows the weekday', () => {
    expect(weekdayOf('2026-10-16')).toBe(5); // Friday
    expect(weekdayOf('2026-10-18')).toBe(0);
  });
});

describe('the bank', () => {
  it('has 250+ tagged lines, American spelling, no emoji, no shaming words', () => {
    expect(ALL_LINES.length).toBeGreaterThanOrEqual(250);
    for (const { line } of ALL_LINES) {
      expect(line).not.toMatch(/colour|centre|grey|neighbour|favourite|realise|organise/i);
      expect(line).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
      expect(line).not.toMatch(/\b(fail|loser|lazy|bad|shame|stupid)\b/i);
      expect(line).toBe(line.trim());
    }
    expect(new Set(ALL_LINES.map((l) => l.line)).size).toBe(ALL_LINES.length);
  });

  it('fills slots and refuses a line whose slot is empty', () => {
    expect(fillHeadline('NEXT UP: {next}', { next: 'Muddle' })).toBe('NEXT UP: MUDDLE');
    expect(fillHeadline('NEXT UP: {next}', {})).toBeNull();
    expect(fillHeadline('{left} LEFT, {name}', { left: '3', name: 'bmt' })).toBe('3 LEFT, BMT');
  });

  for (const slot of [285, 334, 358]) {
    it(`every line keeps two full-size bubble lines in a ${slot}px slot (sample slots, short + long names)`, () => {
      const sample = { next: 'Succession', last: 'Deliverance', n: '14', left: '10', played: '5', total: '18' };
      for (const { tag, line } of ALL_LINES) {
        for (const name of ['', 'BMT', 'Maximillian_The_Great']) {
          const text = fillHeadline(line, { ...sample, name: name || undefined });
          if (text === null) continue; // a {name} line is skipped for guests
          expect(headlineFitsSlot(text, name, slot), `${tag} "${text}" / ${name} @${slot}`).toBe(true);
          const f = homeHeadlineFit(text, name, slot);
          for (const l of f.lines) expect(bubbleWidthEm(l) * f.size).toBeLessThanOrEqual(slot + 1e-6);
        }
      }
    });
  }

  it('skips a line the device cannot fit instead of shrinking it', () => {
    // Crosswordocious alone is wider than a 220px slot at full size: a {next} line is dropped there, never clipped.
    const c = selectHomeHeadline(base({ word: g(2, 2, 8), nextGame: 'Crosswordocious', slotWidth: 220 }));
    const f = homeHeadlineFit(c.text, 'BMT', 220);
    expect(f.size).toBeGreaterThanOrEqual(Math.floor(headlineFontSize(220) * 0.72));
    expect(c.text).not.toContain('…');
    if (c.context !== 'legacy') expect(headlineFitsSlot(c.text, 'BMT', 220)).toBe(true);
  });
});

describe('selection', () => {
  it('is deterministic for (user, date, bucket, state) and varies by user and bucket', () => {
    const ctx = base();
    expect(selectHomeHeadline(ctx)).toEqual(selectHomeHeadline({ ...ctx }));
    const users = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'].map((userSeed) => selectHomeHeadline(base({ userSeed })).id);
    expect(new Set(users).size).toBeGreaterThan(1);
    const byHour = [6, 9, 12, 15, 18, 22, 2].map((hour) => selectHomeHeadline(base({ hour })));
    expect(new Set(byHour.map((c) => c.bucket)).size).toBe(7);
    // Inside a bucket the pick never moves (no per-minute churn).
    expect(selectHomeHeadline(base({ hour: 8 }))).toEqual(selectHomeHeadline(base({ hour: 11 })));
  });

  it('never repeats a line in the injected history while the pool has fresh lines', () => {
    const history: string[] = [];
    const seen = new Set<string>();
    for (let day = 1; day <= 8; day++) {
      const c = selectHomeHeadline(base({ dateKey: `2026-08-${String(day).padStart(2, '0')}`, history }));
      expect(c.context).not.toBe('legacy');
      expect(seen.has(c.id), `day ${day} repeated "${c.id}"`).toBe(false);
      seen.add(c.id);
      history.push(c.id);
    }
    // History exhausted → still a line (falls back to the fitted pool), never empty.
    const everything = ALL_LINES.map((l) => l.line);
    expect(selectHomeHeadline(base({ history: everything })).text.length).toBeGreaterThan(0);
  });

  it('ranks the contexts: double flawless > record > streak > flawless row > all done > row done > last > next > greeting', () => {
    const last = { title: 'Muddle', won: true, minutesAgo: 3, record: true };
    const streaks = { word: { sweep: 3, flawless: 3, bestFlawless: 3, bestSweep: 3 }, puzzles: { sweep: 1, flawless: 1 } };
    // The streak line leads two buckets in three; find seeds for both turns.
    const seeds = Array.from({ length: 30 }, (_, i) => `s${i}`);
    const kinds = (ctx: HeadlineContext) => new Set(seeds.map((userSeed) => selectHomeHeadline({ ...ctx, userSeed }).context));
    expect(kinds(base({ word: g(8, 8, 8), puzzles: g(10, 10, 10), streaks, lastGame: last }))).toEqual(new Set(['doubleFlawless', 'streak']));
    expect(kinds(base({ word: g(8, 8, 8), puzzles: g(10, 9, 10), streaks, lastGame: last }))).toEqual(new Set(['newRecord']));
    expect(kinds(base({ word: g(8, 8, 8), puzzles: g(10, 9, 10), streaks }))).toEqual(new Set(['streak', 'allDone']));
    expect(kinds(base({ word: g(8, 8, 8), puzzles: g(4, 4, 10), streaks }))).toEqual(new Set(['streak', 'flawlessRow']));
    expect(kinds(base({ word: g(8, 8, 8), puzzles: g(4, 4, 10), lastGame: { ...last, record: false } }))).toEqual(new Set(['flawlessRow']));
    expect(kinds(base({ word: g(3, 3, 8), puzzles: g(4, 4, 10), lastGame: last }))).toEqual(new Set(['newRecord']));
    expect(kinds(base({ word: g(8, 7, 8), puzzles: g(10, 9, 10) }))).toEqual(new Set(['allDone']));
    expect(kinds(base({ word: g(8, 7, 8), puzzles: g(4, 4, 10) }))).toEqual(new Set(['rowDone']));
    const noSurprise = (ctx: HeadlineContext) => {
      // Pick a user seed that doesn't roll the surprise for this day/bucket.
      for (let i = 0; i < SURPRISE_RATE * 3; i++) {
        const c = selectHomeHeadline({ ...ctx, userSeed: `s${i}` });
        if (c.context !== 'surprise') return c;
      }
      throw new Error('every seed rolled a surprise');
    };
    expect(noSurprise(base({ word: g(3, 3, 8), lastGame: { ...last, record: false } })).context).toBe('lastPlayed');
    expect(noSurprise(base({ word: g(3, 3, 8), lastGame: { ...last, record: false, minutesAgo: LAST_GAME_FRESH_MINUTES + 1 } })).context).toBe('nextUp');
    expect(noSurprise(base({ word: g(3, 3, 8) })).context).toBe('nextUp');
    expect(noSurprise(base({ holiday: 'halloween', dateKey: '2026-10-31' })).context).toBe('holiday');
    expect(['pack', 'weekday', 'timeOfDay']).toContain(noSurprise(base({ dateKey: '2026-10-16' })).context);
    expect(['weekday', 'timeOfDay']).toContain(noSurprise(base({ dateKey: '2026-08-12' })).context);
    expect(selectHomeHeadline(base({ unlimited: true })).context).toBe('unlimited');
  });

  it('uses the slots: the next game, the last game, the count left, the name', () => {
    const c = selectHomeHeadline(base({ word: g(3, 3, 8), nextGame: 'Spyglass', history: [], userSeed: 'x' }));
    expect(c.text).toBe(c.text.toUpperCase());
    expect(c.text).not.toMatch(/\{\w+\}/);
    const rec = selectHomeHeadline(base({ word: g(3, 3, 8), lastGame: { title: 'Kindred', won: true, minutesAgo: 1, record: true } }));
    expect(rec.context).toBe('newRecord');
    expect(rec.text).not.toMatch(/\{\w+\}/);
  });

  it('surprises rarely (about 1 in 12 greeting-state picks) and never on a celebration', () => {
    let n = 0;
    const N = 240;
    for (let i = 0; i < N; i++) if (selectHomeHeadline(base({ userSeed: `u${i}` })).context === 'surprise') n++;
    expect(n).toBeGreaterThan(N / SURPRISE_RATE / 3);
    expect(n).toBeLessThan((N / SURPRISE_RATE) * 3);
    for (let i = 0; i < 60; i++) {
      expect(selectHomeHeadline(base({ userSeed: `u${i}`, word: g(8, 8, 8), puzzles: g(10, 10, 10) })).context).toBe('doubleFlawless');
    }
  });

  it('greets guests without a name line and mixes seasons at the set rate', () => {
    for (let i = 0; i < 40; i++) {
      const c = selectHomeHeadline(base({ name: '', userSeed: `g${i}` }));
      expect(c.text).not.toContain('{');
      expect(c.text).not.toContain('BMT');
    }
    let seasonal = 0;
    for (let i = 0; i < 90; i++) if (selectHomeHeadline(base({ dateKey: '2026-12-20', userSeed: `w${i}` })).context === 'pack') seasonal++;
    expect(seasonal).toBeGreaterThan(30);
    expect(seasonal).toBeLessThan(80);
  });
});
