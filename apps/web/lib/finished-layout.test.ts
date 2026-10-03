import { describe, expect, it } from 'vitest';
import { MIN_PHONE_HEIGHT, fitScale, formatNextDailyIn, unlimitedHref } from './finished-layout';

describe('share CTA countdown (founder 10-02)', () => {
  it('reads "Xh Ym" from an hour, "Ym" under it, never under 1m', () => {
    expect(formatNextDailyIn(3 * 3600 + 12 * 60 + 40)).toBe('3h 12m');
    expect(formatNextDailyIn(3600)).toBe('1h 0m');
    expect(formatNextDailyIn(23 * 3600 + 59 * 60 + 59)).toBe('23h 59m');
    expect(formatNextDailyIn(3599)).toBe('59m');
    expect(formatNextDailyIn(12 * 60 + 5)).toBe('12m');
    expect(formatNextDailyIn(59)).toBe('1m');
    expect(formatNextDailyIn(0)).toBe('1m');
    expect(formatNextDailyIn(-5)).toBe('1m');
  });
});

describe('one-screen finished screen (FINISH_SPEC R2/R3)', () => {
  it('shrinks the board to the room left, never grows it', () => {
    expect(fitScale({ width: 360, height: 300 }, { width: 340, height: 400 })).toBe(0.75);
    expect(fitScale({ width: 360, height: 600 }, { width: 340, height: 400 })).toBe(1);
    expect(fitScale({ width: 170, height: 600 }, { width: 340, height: 400 })).toBe(0.5);
    expect(fitScale({ width: 360, height: 50 }, { width: 340, height: 400 }, 0.4)).toBe(0.4);
    expect(fitScale({ width: 0, height: 0 }, { width: 340, height: 400 })).toBe(1);
  });
  it('routes Unlimited to the same game without ?daily', () => {
    expect(unlimitedHref('DUEL', { DUEL: '/practice?daily=true' })).toBe('/practice');
    expect(unlimitedHref('QUORDLE', { QUORDLE: '/quadword' })).toBe('/quadword');
    expect(unlimitedHref('NOPE', {})).toBeNull();
    expect(MIN_PHONE_HEIGHT).toBe(667);
  });
});
