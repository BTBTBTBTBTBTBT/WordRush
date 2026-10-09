import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { modeCardSurface } from '@/components/home/mode-card';
import { MODES } from './modes.generated';
import { SEASON_DONE, SEASON_REGISTRY, SURFACE_CSS_VARS, surfaceCssVars, type SeasonSurfaces } from './season-kit';

// 2.7.1 regression (370ee6e6): under Halloween's dark "Haunted glass" a finished daily painted its
// accent at 16% over the night plum and an unplayed one at 8%, so Home showed no finished games at
// all. These pin the rule the fix shipped: on a DARK season's card, every game's finished color is
// clearly apart from its unplayed color, the numbers match iOS / Android, and leaving the season
// clears every variable the season set.
const ROOT = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** `color` at `share` over the opaque `base` (what color-mix(… share, transparent) over the card resolves to). */
const over = (color: string, share: number, base: string) => {
  const c = rgb(color), b = rgb(base);
  return c.map((v, i) => v * share + b[i] * (1 - share));
};
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** A finished card must sit at least this far (sRGB distance) from its unplayed twin. The pre-fix
 *  16% / 8% washes peaked at ~19.5 over Halloween's card; the shipped 38% / 5% bottom out at ~33. */
const MIN_DONE_GAP = 30;

const darkSeasons = SEASON_REGISTRY.filter((s) => s.surfaces?.tone === 'dark' && s.surfaces.card);
const accents = Array.from(new Set(MODES.map((m) => m.accentHex)));

describe('finished dailies under a dark season (Haunted glass)', () => {
  it('has at least one dark season to check (Halloween)', () => {
    expect(darkSeasons.map((s) => s.id)).toContain('halloween');
    expect(accents.length).toBeGreaterThan(10);
  });

  it('hands the document the finished / unplayed shares for every dark season', () => {
    for (const s of darkSeasons) {
      const v = surfaceCssVars(s.surfaces!);
      expect(v['--season-done-pct'], s.id).toBe(`${SEASON_DONE.wash * 100}%`);
      expect(v['--season-idle-pct'], s.id).toBe(`${SEASON_DONE.idle * 100}%`);
      expect(v['--season-done-glow'], s.id).toBe(`${SEASON_DONE.glow}px`);
      expect(v['--season-tile-base'], s.id).toBe(s.surfaces!.card);
    }
  });

  it('keeps every game color finished vs unplayed clearly apart on the night card', () => {
    for (const s of darkSeasons) {
      const card = s.surfaces!.card!;
      for (const a of accents) {
        const gap = dist(over(a, SEASON_DONE.wash, card), over(a, SEASON_DONE.idle, card));
        expect(gap, `${s.id} ${a}`).toBeGreaterThanOrEqual(MIN_DONE_GAP);
      }
    }
  });

  it('would have failed on the pre-fix 16% / 8% washes (the test has teeth)', () => {
    const card = darkSeasons[0].surfaces!.card!;
    const worst = Math.max(...accents.map((a) => dist(over(a, 0.16, card), over(a, 0.08, card))));
    expect(worst).toBeLessThan(MIN_DONE_GAP);
  });

  it('paints a finished card from --season-done-pct with a glow, an unplayed one from --season-idle-pct', () => {
    const done = modeCardSurface('#7c3aed', { done: true });
    const idle = modeCardSurface('#7c3aed', { done: false });
    expect(String(done.background)).toContain('var(--season-done-pct, 20%)');
    expect(String(idle.background)).toContain('var(--season-idle-pct, 13%)');
    expect(String(done.background)).not.toBe(String(idle.background));
    expect(String(done.boxShadow)).toContain('var(--season-done-glow, 0px)');
    expect(String(idle.boxShadow)).not.toContain('--season-done-glow');
    // Locked (free, played) keeps its grey look whether or not it's finished.
    expect(modeCardSurface('#7c3aed', { done: true, locked: true }).background)
      .toBe(modeCardSurface('#7c3aed', { done: false, locked: true }).background);
  });

  it('lists every variable surfaceCssVars can set, so leaving the season clears them all', () => {
    const full: SeasonSurfaces = {
      tone: 'dark', card: '#101010', cardOpacity: 0.9, hero: '#111111', heroOpacity: 0.9, raised: '#121212',
      cap: ['#ffffff', '#888888', '#000000'], capTint: 0.3, glow: '#ff0000', text: '#ffffff',
      textMuted: '#cccccc', textSecondary: '#dddddd', bannerGlow: '#ff8800', cobweb: '#eeeeee',
    };
    const known = new Set<string>(SURFACE_CSS_VARS);
    for (const s of [full, { ...full, tone: 'light' as const }, ...SEASON_REGISTRY.flatMap((e) => (e.surfaces ? [e.surfaces] : []))]) {
      for (const k of Object.keys(surfaceCssVars(s))) expect(known.has(k), k).toBe(true);
    }
  });

  it('uses the same shares on iOS and Android (SeasonDone)', () => {
    const ios = read('apps/ios/Wordocious/Sources/ModeCardView.swift');
    const android = read('apps/android/app/src/main/kotlin/com/wordocious/app/ui/ModeCardView.kt');
    const num = (src: string, re: RegExp) => Number(src.match(re)?.[1]);
    expect(num(ios, /enum SeasonDone \{[\s\S]*?static let wash = ([\d.]+)/)).toBe(SEASON_DONE.wash);
    expect(num(ios, /enum SeasonDone \{[\s\S]*?static let idle = ([\d.]+)/)).toBe(SEASON_DONE.idle);
    expect(num(ios, /enum SeasonDone \{[\s\S]*?static let idleTile = ([\d.]+)/)).toBe(SEASON_DONE.idleTile);
    expect(num(android, /object SeasonDone \{[\s\S]*?WASH = ([\d.]+)f/)).toBe(SEASON_DONE.wash);
    expect(num(android, /object SeasonDone \{[\s\S]*?IDLE = ([\d.]+)f/)).toBe(SEASON_DONE.idle);
    expect(num(android, /object SeasonDone \{[\s\S]*?IDLE_TILE = ([\d.]+)f/)).toBe(SEASON_DONE.idleTile);
  });
});
