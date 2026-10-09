import { describe, expect, it } from 'vitest';
import { FEATURE_SWITCH_KEYS, isFeatureLive } from './feature-switches';

describe('2.8 off-switches (fail open)', () => {
  it('is on when the flags are unknown or the row is missing', () => {
    expect(isFeatureLive('live_play', null, false)).toBe(true);
    expect(isFeatureLive('live_play', {}, false)).toBe(true);
  });
  it('turns off when the row is disabled — for testers too', () => {
    const f = { live_play: { enabled: false, audience: 'all' } };
    expect(isFeatureLive('live_play', f, false)).toBe(false);
    expect(isFeatureLive('live_play', f, true)).toBe(false);
  });
  it("a 'testers' row re-enables for testers only", () => {
    const f = { live_play: { enabled: true, audience: 'testers' } };
    expect(isFeatureLive('live_play', f, false)).toBe(false);
    expect(isFeatureLive('live_play', f, true)).toBe(true);
  });
  it('keys are snake_case and unique', () => {
    expect(new Set(FEATURE_SWITCH_KEYS).size).toBe(FEATURE_SWITCH_KEYS.length);
    for (const k of FEATURE_SWITCH_KEYS) expect(k).toMatch(/^[a-z0-9_]+$/);
  });
});
