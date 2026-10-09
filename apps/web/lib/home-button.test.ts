import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { HOME_DEBOUNCE_MS, HOME_ROOT, HOME_TAP_GUARD_MS, _resetHomeTapForTests, claimHomeTap, homeCardTapBlocked, homeTarget } from './nav-home';

// FINISH_SPEC AY: the top-left Home button ALWAYS lands on the Home root.

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('Home button', () => {
  beforeEach(() => _resetHomeTapForTests());

  it('game A → Next daily → game B → Home lands on the Home root with no game presented', () => {
    // The web router as a stack: Home → game A → (Next daily) game B.
    const stack = [HOME_ROOT, '/classic?daily=true', '/quadword?daily=true'];
    // Home pushes the root — never history-back (which would reveal game A).
    expect(claimHomeTap(1_000)).toBe(true);
    stack.push(homeTarget());
    expect(stack[stack.length - 1]).toBe('/');
    expect(stack[stack.length - 1]).not.toMatch(/classic|quadword/);
  });

  it('only ever targets the root (its own query allowed)', () => {
    expect(homeTarget()).toBe('/');
    expect(homeTarget('/?more=1')).toBe('/?more=1');
    expect(homeTarget('/classic')).toBe('/');
    expect(homeTarget('https://elsewhere.example/')).toBe('/');
  });

  it('is single-fire: a double tap navigates once', () => {
    expect(claimHomeTap(5_000)).toBe(true);
    expect(claimHomeTap(5_000 + HOME_DEBOUNCE_MS - 1)).toBe(false);
    expect(claimHomeTap(5_000 + HOME_DEBOUNCE_MS + 1)).toBe(true);
  });

  it('blocks tap-through onto Home cards for ~400 ms after landing', () => {
    expect(homeCardTapBlocked(10)).toBe(false);
    claimHomeTap(10_000);
    expect(homeCardTapBlocked(10_000 + 50)).toBe(true);
    expect(homeCardTapBlocked(10_000 + HOME_TAP_GUARD_MS + 1)).toBe(false);
  });

  it('BI10: no game launch is ever deferred past a Home tap (Next daily / Leaderboard are plain links)', () => {
    // iOS's cause was a 0.6 s deferred "Next daily" present + Home rebuilding its covers; the
    // web hands off synchronously, so there is nothing for a Home tap to race.
    const cta = read('components/game/next-daily-cta.tsx');
    expect(cta).toContain("<CastLink href={homeFirst ? '/' : next.href}");   // BJ15: the cast-color link (still a plain <Link>); 2.8 item 52: Home first while a celebration is due
    expect(cta).not.toMatch(/setTimeout/);
  });

  it('every top-left home control goes to the root and closes overlays — no history-back', () => {
    const btn = read('components/game/game-home-button.tsx');
    expect(btn).toContain('href={homeTarget(href)}');
    expect(btn).toContain('closeAllOverlays()');
    expect(btn).toContain('claimHomeTap()');
    const info = read('components/ui/info-page-header.tsx');
    expect(info).not.toMatch(/router\.back\(\)|history\.back\(\)/);
    expect(info).toContain('router.push(HOME_ROOT)');
    expect(read('components/vs/vs-game.tsx')).toContain("window.location.href = '/';");
    expect(read('app/page.tsx')).toContain('homeCardTapBlocked()');
  });
});
