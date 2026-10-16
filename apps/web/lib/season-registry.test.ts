import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEASON_IDS, SEASON_WINDOWS, seasonReady } from '@wordle-duel/core';
import { SEASON_ART_SIZE, SEASON_REGISTRY, seasonBanner, seasonStage, seasonSurfaces, seasonalTitle, seasonalWall, slotLookup, timedNames, resolveSurfaces } from './season-kit';
import { HALLOWEEN_TRIM, castArt, parseSeasonParam, parseStoredSeason, resolveSeason, seasonOfSrc } from './season';

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

  // A season whose art hasn't shipped (core SEASON_WINDOWS ready: false) is listed for the admin preview only; its slots
  // fall back to the normal art until the ship step. Flipping `ready` makes these checks bite.
  const ready = SEASON_REGISTRY.filter((s) => seasonReady(s.id));

  it('points every title / wall / banner slot at art that ships on the web', () => {
    for (const s of ready) {
      for (const v of Object.values(s.slots.titles ?? {})) expect(SEASON_ART_SIZE[v], v).toBeDefined();
      for (const w of Object.values(s.slots.walls ?? {})) {
        // Night (the base) must ship; a time's own wall may still be on its way (it falls back to night).
        const night = typeof w === 'string' ? w : w.night!;
        expect(SEASON_ART_SIZE[night], night).toBeDefined();
      }
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

  it('lists a not-ready season for the admin preview while the public never gets it', () => {
    const t = SEASON_REGISTRY.find((s) => s.id === 'thanksgiving')!;
    expect(seasonReady('thanksgiving')).toBe(false);
    expect(parseSeasonParam('?season=thanksgiving')).toBe('thanksgiving');
    expect(parseStoredSeason('thanksgiving')).toBe('thanksgiving');
    expect(resolveSeason('2026-11-20', 'thanksgiving')).toBe('thanksgiving'); // the admin preview
    expect(resolveSeason('2026-11-20', null)).toBeNull(); // the public, inside the window, art not ready
    expect(seasonSurfaces('thanksgiving')?.tone).toBe('dark'); // the harvest surfaces render in the preview
    expect(timedNames(t.slots.stage)).toContain('art-celebration-stage-thanksgiving');
    expect(seasonStage('thanksgiving')).toBe('art-celebration-stage-thanksgiving'); // shipped 10-16 for the admin preview (the public still gets nothing: resolveSeason above)
    expect(seasonStage('halloween', (n) => n === 'art-celebration-stage-halloween')).toBe('art-celebration-stage-halloween');
  });

  // Time of day (10-16): walls / stage / surfaces by (season, time) with a night fallback.
  it('resolves the wall and stage per time of day, falling back to night when a file does not ship', () => {
    expect(seasonalWall('art-wall-home', 'thanksgiving', 'dark', 'morning')).toBe('art-wall-thanksgiving-home-morning');
    expect(seasonalWall('art-wall-home', 'thanksgiving', 'dark', 'evening')).toBe('art-wall-thanksgiving-home-evening');
    expect(seasonalWall('art-wall-home', 'thanksgiving', 'dark', 'night')).toBe('art-wall-thanksgiving-home');
    expect(seasonalWall('art-wall-game-quordle', 'thanksgiving', 'dark', 'day')).toBe('art-wall-thanksgiving-games-day');
    expect(seasonalWall('art-wall-home', 'halloween', 'dark', 'day')).toBe('art-wall-halloween-home-day');
    expect(seasonalWall('art-wall-home', 'halloween', 'dark', 'night')).toBe('art-wall-halloween-home');
    expect(seasonalWall('art-wall-home', null, 'dark', 'day')).toBeNull();
    expect(seasonStage('thanksgiving', undefined, 'day')).toBe('art-celebration-stage-thanksgiving-day');
    expect(seasonStage('thanksgiving', undefined, 'night')).toBe('art-celebration-stage-thanksgiving');
    expect(seasonStage('halloween', (n) => n === 'art-celebration-stage-halloween', 'morning')).toBe('art-celebration-stage-halloween-morning');
    // A time whose file is missing falls back to night's.
    expect(seasonStage('halloween', (n) => n === 'art-celebration-stage-halloween', 'night')).toBe('art-celebration-stage-halloween');
  });

  it('lays a time\'s surfaces over the night base; tone there only flips the on-wall ink', () => {
    const night = seasonSurfaces('thanksgiving', null, 'night')!;
    const day = seasonSurfaces('thanksgiving', null, 'day')!;
    const morning = seasonSurfaces('thanksgiving', null, 'morning')!;
    expect(night.card).toBe('#2A1419');
    expect(night.wallInk).toBe('light');
    expect(morning.card).toBe('#4A3049');
    expect(morning.cardOpacity).toBe(0.9);
    expect(day.card).toBe('#303C64');
    expect(day.glow).toBe('#86ADF2');
    expect(day.tone).toBe('dark');          // the card tone never flips
    expect(day.wallInk).toBe('dark');       // the on-wall chrome ink does
    // Evening keeps the base card opacity and text; only the keys it names change.
    const evening = seasonSurfaces('thanksgiving', null, 'evening')!;
    expect(evening.card).toBe('#3A1A2C');
    expect(evening.cardOpacity).toBe(0.92);
    expect(evening.text).toBe(night.text);
    expect(evening.textMuted).toBe('#E6C4B2');
    // No tod entry (Halloween) = the base at every time; a missing base = null.
    expect(seasonSurfaces('halloween', null, 'day')!.card).toBe(seasonSurfaces('halloween', null, 'night')!.card);
    expect(resolveSurfaces(undefined, 'day')).toBeNull();
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
    for (const s of ready) {
      // Every wall name (any time) that ships on the web ships on iOS + Android too; night's always ships.
      for (const v of new Set(Object.values(s.slots.walls ?? {}).flatMap(timedNames))) {
        if (!(v in SEASON_ART_SIZE)) continue;
        expect(exists(`apps/web/public/art/${v}.webp`), v).toBe(true);
        expect(exists(`apps/web/public/art/${v}-wide.webp`), `${v}-wide`).toBe(true);
        expect(exists(`apps/ios/Wordocious/Resources/Wallpapers.xcassets/${v}.imageset/${v}.jpg`), `iOS ${v}`).toBe(true);
        expect(exists(`apps/android/app/src/main/res/drawable-nodpi/${v.replace(/-/g, '_')}.webp`), `Android ${v}`).toBe(true);
      }
    }
  });
});
