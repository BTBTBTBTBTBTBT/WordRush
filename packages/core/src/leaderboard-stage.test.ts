import { describe, expect, it } from 'vitest';
import {
  DAY_PROPS, MASCOT_LEAN_DEGREES, dayProp, wearsWizardHat,
  DAY_HOSTS, LEDGE_STEPS, STAGE_TOP_MAX_HEIGHT, dayHost, podiumFits, stageWeekday,
} from './leaderboard-stage';
import { leaderboardTitle } from './leaderboard-title';

describe('leaderboard stage (11b)', () => {
  it('one host per weekday, W never hosts, Wednesday is the wizard', () => {
    expect(DAY_HOSTS).toHaveLength(7);
    expect(DAY_HOSTS.every((h) => h.castId !== 'w')).toBe(true);
    // 2026-10-07 is a Wednesday
    expect(leaderboardTitle('2026-10-07')).toBe('WEDNESDAY WIZARDS');
    expect(dayHost('2026-10-07')).toEqual({ castId: 'u', pose: 'spin' });
    expect(stageWeekday('2026-10-04')).toBe(0);
    expect(stageWeekday('2026-10-10')).toBe(6);
  });
  it('the ledge has places 1-3 in 2/1/3 order, centred', () => {
    expect(LEDGE_STEPS.map((s) => s.place)).toEqual([2, 1, 3]);
    expect(LEDGE_STEPS[1].x).toBeCloseTo(0.5);
    expect(LEDGE_STEPS[1].top).toBeLessThan(LEDGE_STEPS[0].top);
    expect(LEDGE_STEPS[0].top).toBeLessThan(LEDGE_STEPS[2].top);
  });
  it('the stage top leaves room for the whole podium on a standard phone', () => {
    expect(podiumFits(STAGE_TOP_MAX_HEIGHT)).toBe(true);
    expect(podiumFits(STAGE_TOP_MAX_HEIGHT + 200)).toBe(false);
  });
  it('every weekday has a prop with a motion; Wednesday swishes a wand, Thursday flashes lightning', () => {
    expect(DAY_PROPS).toHaveLength(7);
    expect(dayProp('2026-10-07')).toEqual({ art: 'art-lb-day-wand-swish', motion: 'swish' });
    expect(dayProp('2026-10-08')).toEqual({ art: 'art-lb-day-lightning', motion: 'flash' });
    expect(new Set(DAY_PROPS.map((p) => p.motion)).size).toBeGreaterThanOrEqual(5);
  });
  it('the wizard hat is Wednesday only; the mascot leans a few degrees', () => {
    expect(wearsWizardHat('2026-10-07')).toBe(true);
    for (const d of ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09', '2026-10-10']) expect(wearsWizardHat(d)).toBe(false);
    expect(MASCOT_LEAN_DEGREES).toBeGreaterThan(0);
    expect(MASCOT_LEAN_DEGREES).toBeLessThan(15);
  });
});
