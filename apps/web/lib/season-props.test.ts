import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { SEASON_REGISTRY, seasonProps, seasonAccentText, surfaceCssVars, SURFACE_CSS_VARS, seasonArtShips } from './season-kit';
import { ART_SIZE } from './art';
import { dayPropPair } from './headline';

const root = resolve(__dirname, '../../..');
const exists = (p: string) => existsSync(resolve(root, p));

describe('season day-title props (registry `props` slot)', () => {
  it('Halloween keeps its four, in the same order', () => {
    expect(seasonProps('halloween', (n) => n in ART_SIZE)).toEqual([
      'art-halloween-prop-pumpkin', 'art-halloween-prop-bat', 'art-halloween-prop-candy', 'art-halloween-prop-ghost',
    ]);
  });

  it('Thanksgiving lists all ten shipped props', () => {
    const t = seasonProps('thanksgiving');
    expect(t).toHaveLength(10);
    for (const n of ['turkey-platter', 'pumpkin-pie', 'leaf-maple', 'acorn', 'apple', 'corn', 'cornucopia', 'leaf-oak', 'pie-slice', 'wheat']) {
      expect(t).toContain(`art-thanksgiving-prop-${n}`);
    }
  });

  it('every registry prop ships on web, iOS and Android', () => {
    for (const s of SEASON_REGISTRY) {
      for (const n of s.slots.props ?? []) {
        expect(seasonArtShips(n) || n in ART_SIZE, n).toBe(true);
        expect(exists(`apps/web/public/art/${n}.webp`), n).toBe(true);
        expect(exists(`apps/ios/Wordocious/Resources/Assets.xcassets/${n}.imageset/Contents.json`), n).toBe(true);
        expect(exists(`apps/android/app/src/main/res/drawable-nodpi/${n.replace(/-/g, '_')}.webp`), n).toBe(true);
      }
    }
  });

  it('the day pair rotates through every prop and never repeats within a day', () => {
    const t = seasonProps('thanksgiving');
    const seen = new Set<string>();
    for (let d = 0; d < t.length; d++) {
      const pair = dayPropPair(t, d)!;
      expect(pair[0]).not.toBe(pair[1]);
      seen.add(pair[0]);
    }
    expect(seen.size).toBe(t.length);
  });
});

describe('season accent text', () => {
  it('Thanksgiving exposes #943F10 as text ink (CSS var + helper); Halloween has none', () => {
    expect(seasonAccentText('thanksgiving')).toBe('#943F10');
    expect(seasonAccentText('halloween')).toBeNull();
    const t = SEASON_REGISTRY.find((s) => s.id === 'thanksgiving')!.surfaces!;
    expect(surfaceCssVars(t)['--season-accent-text']).toBe('#943F10');
    expect(SURFACE_CSS_VARS).toContain('--season-accent-text');
    const h = SEASON_REGISTRY.find((s) => s.id === 'halloween')!.surfaces!;
    expect(surfaceCssVars(h)['--season-accent-text']).toBeUndefined();
  });
});

describe('Thanksgiving shipped extras', () => {
  it('the dress tag, the six candy buttons and the two achievement badges ship ×3', () => {
    const names = ['art-dress-tag-thanksgiving', ...['cranberry', 'maple', 'pumpkinpie', 'apple-cider', 'acorn', 'harvest-gold'].map((n) => `art-btn-thanksgiving-${n}`), 'art-ach-harvest_feast', 'art-ach-tune_simple_gifts'];
    for (const n of names) {
      expect(exists(`apps/web/public/art/${n}.webp`), n).toBe(true);
      expect(exists(`apps/ios/Wordocious/Resources/Assets.xcassets/${n}.imageset/Contents.json`), n).toBe(true);
      expect(exists(`apps/android/app/src/main/res/drawable-nodpi/${n.replace(/-/g, '_')}.webp`), n).toBe(true);
    }
    expect('art-ach-harvest_feast' in ART_SIZE && 'art-ach-tune_simple_gifts' in ART_SIZE).toBe(true);
  });
});
