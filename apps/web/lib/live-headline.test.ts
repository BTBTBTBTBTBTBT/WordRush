import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { HEADLINE_MIN_SCALE, HEADLINE_PALETTES, headlineFit } from './live-headline';
import { LOOP_CLASSES } from './motion-pause';

const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8');

describe('LiveHeadline fit (FINISH_SPEC AR)', () => {
  it('keeps a headline that fits at full size', () => {
    expect(headlineFit(200, 300)).toEqual({ scale: 1, wrap: false });
    expect(headlineFit(0, 300)).toEqual({ scale: 1, wrap: false });
  });

  it('shrinks to fit on one line before wrapping', () => {
    expect(headlineFit(400, 320)).toEqual({ scale: 0.8, wrap: false });
  });

  it('wraps (two lines) at the minimum scale once shrinking is not enough', () => {
    expect(headlineFit(1000, 300)).toEqual({ scale: HEADLINE_MIN_SCALE, wrap: true });
  });
});

describe('LiveHeadline palettes', () => {
  it('has every screen the spec names', () => {
    expect(Object.keys(HEADLINE_PALETTES).sort()).toEqual(['celebrate', 'friends', 'home', 'leaderboard', 'menu', 'stats', 'vs']);
    for (const p of Object.values(HEADLINE_PALETTES)) {
      for (const c of [p.top, p.bottom, p.deep, p.nameTop, p.nameBottom]) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('draws the outline behind the clipped fill and honors Reduce Motion', () => {
    expect(css).toContain('-webkit-text-stroke: 0.16em var(--lh-outline)');
    expect(css).toMatch(/\.lh-fill, \.lh-gloss \{[^}]*background-clip: text/);
    expect(css).toContain('[data-reduced-motion="true"] .lh-ch');
  });
});

describe('loops pause off-screen and while scrolling (FINISH_SPEC AQ2)', () => {
  it('lists only real looping classes, each paused by the stylesheet', () => {
    for (const c of LOOP_CLASSES) {
      if (c !== 'lh-sweep') expect(css, c).toMatch(new RegExp(`\\.${c}[^{]*\\{[^}]*infinite`));
      expect(css, c).toContain(`html[data-scrolling="true"] .${c},`);
    }
    expect(css).toContain('[data-offscreen="true"], [data-offscreen="true"]::before, [data-offscreen="true"]::after { animation-play-state: paused !important; }');
  });
});
