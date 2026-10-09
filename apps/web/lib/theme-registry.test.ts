import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BASE_THEMES, contrastRatio } from '@wordle-duel/core';
import { THEME_REGISTRY, ambientSrc, seasonalEntry, themeLook, themeWallVars } from './theme-kit';

const ROOT = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('theme registry (item 25)', () => {
  it('is copied byte for byte to iOS and Android', () => {
    const src = read('packages/core/src/theme-registry.json');
    expect(read('apps/ios/Wordocious/Resources/theme-registry.json')).toBe(src);
    expect(read('apps/android/app/src/main/assets/theme-registry.json')).toBe(src);
  });

  it('lists every base theme, in picker order', () => {
    expect(THEME_REGISTRY.map((t) => t.id)).toEqual([...BASE_THEMES]);
  });

  it('readability per theme: ink on the card is AA, secondary ink is AA, in every scheme the theme has', () => {
    for (const t of THEME_REGISTRY) {
      for (const [scheme, look] of [['light', t.light], ['dark', t.dark]] as const) {
        if (!look) continue;
        expect(contrastRatio(look.ink, look.card), `${t.id} ${scheme} ink`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(look.inkSecondary, look.card), `${t.id} ${scheme} secondary`).toBeGreaterThanOrEqual(4.5);
        // the accent is a title / button tint, drawn large or on its own fill: AA for large text on the card
        expect(contrastRatio(look.accent, look.card), `${t.id} ${scheme} accent`).toBeGreaterThanOrEqual(3);
        for (const c of [...look.wall, look.glow, look.card, look.tabBar]) expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it('only Dark is dark-only, and the dark twins really are dark', () => {
    expect(THEME_REGISTRY.filter((t) => !t.light).map((t) => t.id)).toEqual(['dark']);
    for (const t of THEME_REGISTRY) expect(contrastRatio(t.dark.wall[1], '#000000')).toBeLessThan(3);
  });

  it('ambient specs are sane and point at shipped sprites', () => {
    for (const t of THEME_REGISTRY) {
      expect(t.ambient.count).toBeLessThanOrEqual(10);
      expect(t.ambient.duration[0]).toBeGreaterThan(8);
      for (const s of t.ambient.sprites) read(`apps/web/public${ambientSrc(s)}`);
    }
    const h = seasonalEntry('halloween')!;
    for (const s of [h.ambient.bats.sprite, h.ambient.witch.sprite, h.ambient.fog.sprite]) read(`apps/web/public${ambientSrc(s)}`);
  });

  it('wall vars cover both schemes; Seasonal has its row data', () => {
    expect(Object.keys(themeWallVars('ocean')).length).toBe(8);
    expect(themeLook('dark', false).wall).toEqual(THEME_REGISTRY[3].dark.wall);
    const h = seasonalEntry('halloween')!;
    expect(h.title).toBe('Seasonal — Halloween');
    expect(h.previewTiles.map((t) => t.letter).join('')).toBe('WORD');
    expect(seasonalEntry(null)).toBeNull();
  });
});
