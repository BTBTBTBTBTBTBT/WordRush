import { describe, expect, it } from 'vitest';
import { FINISH_MOTION } from './finish-motion';

describe('FINISH_MOTION (BJ2: one big thing at a time)', () => {
  it('orders the win card beats: tiles → count-up → gloss → sparkle → bob', () => {
    const m = FINISH_MOTION;
    expect(m.tilesStartMs).toBeLessThan(m.countStartMs);
    expect(m.countStartMs).toBeLessThan(m.sweepStartMs);
    expect(m.sweepStartMs).toBeLessThan(m.sparkleStartMs);
    expect(m.sparkleStartMs).toBeLessThanOrEqual(m.bobStartMs);
  });

  it('after CONTINUE: strip headline → XP toast → achievement popups', () => {
    const m = FINISH_MOTION;
    expect(m.afterCardMs).toBeGreaterThanOrEqual(250);
    expect(m.xpAfterHoldMs).toBeGreaterThan(m.afterCardMs);
    expect(m.achievementsAfterHoldMs).toBeGreaterThan(m.xpAfterHoldMs + 300);
  });

  it('matches the native FinishMotion numbers (iOS / Android parity)', () => {
    expect(FINISH_MOTION).toEqual({
      afterCardMs: 300, xpAfterHoldMs: 450, achievementsAfterHoldMs: 850,
      tilesStartMs: 250, countStartMs: 450, sweepStartMs: 900, sparkleStartMs: 1150, bobStartMs: 1200,
    });
  });
});
