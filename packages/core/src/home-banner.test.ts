import { describe, expect, it } from 'vitest';
import { bannerHeadline, bannerClockLine, dayStreaks, greetingWord, groupStatus, groupTier, groupStreak, shiftDay } from './home-banner';

const g = (played: number, won: number, total: number) => ({ played, won, total });
const at = (hour: number, name = 'BMT') => ({ hour, name });

describe('home banner headline', () => {
  it('greets by the time of day before the first puzzle', () => {
    expect(bannerHeadline(g(0, 0, 8), g(0, 0, 10), at(8))).toBe('GOOD MORNING, BMT!');
    expect(bannerHeadline(g(0, 0, 8), g(0, 0, 10), at(12))).toBe('GOOD AFTERNOON, BMT!');
    expect(bannerHeadline(g(0, 0, 8), g(0, 0, 10), at(17))).toBe('GOOD EVENING, BMT!');
    // After 8 pm it stays the evening greeting (founder, 2026-10-01).
    expect(bannerHeadline(g(0, 0, 8), g(0, 0, 10), at(22))).toBe('GOOD EVENING, BMT!');
    expect(bannerHeadline(g(0, 0, 8), g(0, 0, 10), at(9, ''))).toBe('GOOD MORNING!');
    expect(bannerHeadline(g(0, 0, 8), g(0, 0, 10), at(9, 'doug'))).toBe('GOOD MORNING, DOUG!');
  });

  it('climbs the progress ladder while neither row is finished', () => {
    expect(bannerHeadline(g(2, 2, 8), g(1, 1, 10), at(10))).toBe('WARMING UP · 3 DOWN');
    expect(bannerHeadline(g(3, 3, 8), g(4, 4, 10), at(10))).toBe('ON A ROLL · 7 OF 18');
    expect(bannerHeadline(g(6, 5, 8), g(8, 8, 10), at(10))).toBe('HOME STRETCH · 4 LEFT');
  });

  it('names the finished row and counts what is left', () => {
    expect(bannerHeadline(g(8, 8, 8), g(6, 5, 10), at(10))).toBe('WORDOCIOUS FLAWLESS! 4 PUZZLES LEFT');
    expect(bannerHeadline(g(7, 7, 8), g(10, 9, 10), at(10))).toBe('PUZZLES SWEPT! 1 PUZZLE LEFT');
    expect(bannerHeadline(g(8, 7, 8), g(0, 0, 10), at(10))).toBe('WORDOCIOUS SWEPT! 10 PUZZLES LEFT');
  });

  it('reads both results in banner order once everything is done', () => {
    expect(bannerHeadline(g(8, 8, 8), g(10, 8, 10), at(10))).toBe('FLAWLESS + SWEEP!');
    expect(bannerHeadline(g(8, 7, 8), g(10, 10, 10), at(10))).toBe('SWEEP + FLAWLESS!');
    expect(bannerHeadline(g(8, 7, 8), g(10, 8, 10), at(10))).toBe('DOUBLE SWEEP!');
    expect(bannerHeadline(g(8, 8, 8), g(10, 10, 10), at(10))).toBe('DOUBLE FLAWLESS!');
  });

  it('reads UNLIMITED PLAY in Unlimited mode', () => {
    expect(bannerHeadline(g(8, 8, 8), g(10, 10, 10), { ...at(10), unlimited: true })).toBe('UNLIMITED PLAY');
  });
});

describe('home banner rows and clock', () => {
  it('tiers and status', () => {
    expect(groupTier(g(7, 7, 8))).toBe('none');
    expect(groupTier(g(8, 7, 8))).toBe('sweep');
    expect(groupTier(g(8, 8, 8))).toBe('flawless');
    expect(groupTier(g(0, 0, 0))).toBe('none');
    expect(groupStatus(g(3, 2, 8))).toBe('3/8');
    expect(groupStatus(g(10, 8, 10))).toBe('SWEEP · 8/10 WON');
    expect(groupStatus(g(8, 8, 8))).toBe('FLAWLESS · 8/8 WON');
    expect(groupStreak('flawless', { sweep: 9, flawless: 4 })).toBe(4);
    expect(groupStreak('sweep', { sweep: 9, flawless: 4 })).toBe(9);
    expect(groupStreak('none', { sweep: 9, flawless: 4 })).toBe(9);
  });

  it('clock line', () => {
    expect(bannerClockLine(g(0, 0, 8), g(0, 0, 10), '16:48:10')).toBe('18 FRESH PUZZLES · RESETS IN 16:48:10');
    expect(bannerClockLine(g(3, 3, 8), g(4, 4, 10), '07:12:40')).toBe('RESETS IN 07:12:40');
    expect(bannerClockLine(g(8, 8, 8), g(10, 9, 10), '01:02:44')).toBe('NEW PUZZLES IN 01:02:44');
    expect(bannerClockLine(g(0, 0, 8), g(0, 0, 10), 'x', true)).toBe('FRESH PUZZLE EVERY TAP · ALL STATS COUNT');
  });

  it('greeting boundaries', () => {
    expect(greetingWord(0)).toBe('MORNING');
    expect(greetingWord(11)).toBe('MORNING');
    expect(greetingWord(16)).toBe('AFTERNOON');
    expect(greetingWord(23)).toBe('EVENING');
  });
});

describe('day streaks', () => {
  const full = { played: 10, won: 10 };
  const swept = { played: 10, won: 8 };
  it('counts back from today, or from yesterday when today is not done', () => {
    const days = { '2026-10-01': full, '2026-09-30': swept, '2026-09-29': full, '2026-09-27': full };
    expect(dayStreaks(days, 10, '2026-10-01')).toEqual({ sweep: 3, flawless: 1 });
    expect(dayStreaks(days, 10, '2026-10-02')).toEqual({ sweep: 3, flawless: 1 });
    expect(dayStreaks(days, 10, '2026-10-03')).toEqual({ sweep: 0, flawless: 0 });
  });
  it('a partly played today does not break yesterday’s run', () => {
    const days = { '2026-10-01': { played: 4, won: 4 }, '2026-09-30': full, '2026-09-29': full };
    expect(dayStreaks(days, 10, '2026-10-01')).toEqual({ sweep: 2, flawless: 2 });
  });
  it('word of the day: a right answer is a won day', () => {
    const days = { '2026-10-01': { played: 1, won: 1 }, '2026-09-30': { played: 1, won: 0 }, '2026-09-29': { played: 1, won: 1 } };
    expect(dayStreaks(days, 1, '2026-10-01').flawless).toBe(1);
  });
  it('shiftDay crosses months and years', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
  });
});
