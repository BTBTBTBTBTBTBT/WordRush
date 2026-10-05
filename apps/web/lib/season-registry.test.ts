import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEASON_IDS, SEASON_WINDOWS } from '@wordle-duel/core';
import { SEASON_ART_SIZE, SEASON_REGISTRY, seasonBanner, seasonSurfaces, seasonalTitle, seasonalWall, slotLookup } from './season-kit';
import { HALLOWEEN_TRIM, castArt, parseSeasonParam, parseStoredSeason, seasonOfSrc } from './season';

// The season registry (docs/design/brand/seasons/README.md "How to add a season"): one JSON shared
// by the three apps, the same ids as core SEASON_WINDOWS, every slot pointing at real shipped art.
const ROOT = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('season registry', () => {
  it('is copied byte for byte to iOS and Android', () => {
    const src = read('packages/core/src/season-registry.json');
    expect(read('apps/ios/Wordocious/Resources/season-registry.json')).toBe(src);
    expect(read('apps/android/app/src/main/assets/season-registry.json')).toBe(src);
  });

  it('lists the same seasons as the core windows, each with a palette', () => {
    expect(SEASON_REGISTRY.map((s) => s.id)).toEqual(SEASON_WINDOWS.map((w) => w.id));
    for (const s of SEASON_REGISTRY) {
      for (const c of [s.palette.accent, s.palette.buttonTint, s.palette.quietTint, ...s.palette.wallLight, ...s.palette.wallDark]) {
        expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it('points every title / wall / banner slot at art that ships on the web', () => {
    for (const s of SEASON_REGISTRY) {
      for (const v of Object.values(s.slots.titles ?? {})) expect(SEASON_ART_SIZE[v], v).toBeDefined();
      for (const v of Object.values(s.slots.walls ?? {})) expect(SEASON_ART_SIZE[v], v).toBeDefined();
      if (s.slots.banner) expect(SEASON_ART_SIZE[s.slots.banner]).toBeDefined();
    }
  });

  it('swaps Halloween titles, walls and the banner; falls back everywhere else', () => {
    expect(seasonalTitle('art-titlecast-dailies', 'halloween')?.name).toBe('art-title-halloween-dailies');
    expect(seasonalTitle('art-game-quordle', 'halloween')?.src).toBe('/art/art-title-halloween-quordle.webp');
    expect(seasonalTitle('art-titlecast-settings', 'halloween')).toBeNull();
    expect(seasonalTitle('art-titlecast-dailies', null)).toBeNull();
    expect(seasonalWall('art-wall-home', 'halloween', 'dark')).toBe('art-wall-halloween-home');
    // Midnight is the same night sky in both modes: no -light twin ships, light falls back to the base.
    expect(seasonalWall('art-wall-home', 'halloween', 'light')).toBe('art-wall-halloween-home');
    expect(seasonalWall('art-wall-game-quordle', 'halloween', 'dark')).toBe('art-wall-halloween-games');
    expect(seasonalWall('art-wall-home', null, 'dark')).toBeNull();
    expect(seasonBanner('halloween')).toBe('art-scene-banner-halloween');
    expect(seasonBanner('not-a-season')).toBeNull();
    expect(slotLookup({ 'a-*': 'x', 'a-b-*': 'y' }, 'a-b-c')).toBe('y');
  });

  it('accepts every registry id as a preview', () => {
    for (const id of SEASON_IDS) {
      expect(parseSeasonParam(`?season=${id}`)).toBe(id);
      expect(parseStoredSeason(id)).toBe(id);
    }
    expect(parseStoredSeason('xmas')).toBeNull();
  });

  it('frames the cast skins from the registry boxes (the same boxes the row always used)', () => {
    const h = SEASON_REGISTRY.find((s) => s.id === 'halloween')!;
    expect(h.slots.castTrim).toEqual(HALLOWEEN_TRIM);
    expect(castArt('w', 'halloween').src).toContain('/art-halloween-w');
    expect(seasonOfSrc('/art/art-halloween-o1.webp')).toBe('halloween');
    expect(seasonOfSrc('/art/mascot-o1.webp')).toBeNull();
  });

  it('ships one surfaces look per season (haunted glass for Halloween), no variants; off = the normal look', () => {
    for (const s of SEASON_REGISTRY) expect((s as unknown as Record<string, unknown>).surfaceVariants).toBeUndefined();
    const glass = seasonSurfaces('halloween');
    expect(glass?.tone).toBe('dark');
    // Text-bearing glass stays >= 90% so the wall's skyline never shows through the text (10-05).
    expect(glass?.cardOpacity).toBeGreaterThanOrEqual(0.9);
    expect(glass?.heroOpacity).toBeGreaterThanOrEqual(0.9);
    expect(glass?.headline).toHaveLength(5);
    expect(glass?.cap).toHaveLength(3);
    expect(glass?.bannerGlow).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(glass?.cobweb).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(seasonSurfaces('halloween', 'parchment')).toEqual(glass);
    expect(seasonSurfaces('halloween', 'off')).toBeNull();
    expect(seasonSurfaces(null)).toBeNull();
  });

  it('ships every season wall on all three platforms (portrait on iOS + Android, wide on the web)', () => {
    const exists = (p: string) => {
      try {
        readFileSync(join(ROOT, p));
        return true;
      } catch {
        return false;
      }
    };
    for (const s of SEASON_REGISTRY) {
      for (const v of new Set(Object.values(s.slots.walls ?? {}))) {
        expect(exists(`apps/web/public/art/${v}.webp`), v).toBe(true);
        expect(exists(`apps/web/public/art/${v}-wide.webp`), `${v}-wide`).toBe(true);
        expect(exists(`apps/ios/Wordocious/Resources/Wallpapers.xcassets/${v}.imageset/${v}.jpg`), `iOS ${v}`).toBe(true);
        expect(exists(`apps/android/app/src/main/res/drawable-nodpi/${v.replace(/-/g, '_')}.webp`), `Android ${v}`).toBe(true);
      }
    }
  });
});
