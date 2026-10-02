import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { INTRO, SPLASH, introShouldPlay, introTotalMs } from './intro';
import { PAGE_TINTS } from './art';

// FINISH_SPEC F2: cold start only, ≤ 1.6 s, Reduce Motion = a 200 ms crossfade.

describe('cold-start intro', () => {
  it('plays only on a cold start at Home, once per session', () => {
    expect(introShouldPlay({ pathname: '/', seenThisSession: false, hasStaticSplash: true })).toBe(true);
    expect(introShouldPlay({ pathname: '/', seenThisSession: true, hasStaticSplash: true })).toBe(false);
    expect(introShouldPlay({ pathname: '/', seenThisSession: false, hasStaticSplash: false })).toBe(false);
    expect(introShouldPlay({ pathname: '/stats', seenThisSession: false, hasStaticSplash: true })).toBe(false);
  });

  it('stays within 1.6 s, the pops finish before the glide, and Reduce Motion is a 200 ms crossfade', () => {
    expect(introTotalMs(false)).toBeLessThanOrEqual(1600);
    expect(INTRO.rowAt + 9 * INTRO.popStagger).toBeLessThan(INTRO.glideAt);
    expect(INTRO.glideAt + INTRO.glideMs).toBeLessThanOrEqual(INTRO.endAt);
    expect(INTRO.reducedFadeMs).toBe(200);
    expect(introTotalMs(true)).toBeLessThan(introTotalMs(false));
  });

  it('starts from the static launch screen: the Home wallpaper colors and a shipped icon', () => {
    for (const c of PAGE_TINTS.home.light) expect(SPLASH.background.toLowerCase()).toContain(c.toLowerCase());
    expect(fs.existsSync(path.join(__dirname, '..', 'public', SPLASH.icon))).toBe(true);
  });
});
