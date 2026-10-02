import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FRIENDLY_KINDS, leaderboardTitle } from '@wordle-duel/core';
import {
  ART_SIZE, DAY_ART, GAME_ART_IDS, GAME_TITLE_ART_HEIGHT, GAME_TITLE_ART_IDS, MOMENT_LABEL, PAGE_SCENES, POCKET_ART_KINDS,
  artSrc, dayArtName, gameArtSrc, gameTitleArt, gameTitleArtForDbKey, gameTitleArtForGuide, gameTitleArtLabel,
  isGameArtIcon, pocketArtSrc, resultMoment, type ArtName,
} from './art';
import { MODES } from './modes.generated';

// The art pass (docs/ART_SPEC.md): every name the web table knows has its file
// in public/art, with the pixel size the table claims (so explicit width/height
// never distort or shift layout).

const pub = (src: string) => path.join(__dirname, '..', 'public', src);

/** Width × height of a WebP (VP8, VP8L or VP8X). */
function webpSize(file: string): [number, number] {
  const b = fs.readFileSync(file);
  expect(b.toString('ascii', 0, 4)).toBe('RIFF');
  expect(b.toString('ascii', 8, 12)).toBe('WEBP');
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
  }
  if (chunk === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  throw new Error(`unknown WebP chunk ${chunk}`);
}

describe('title + day art', () => {
  it('has every file at its recorded size', () => {
    for (const [name, size] of Object.entries(ART_SIZE)) {
      const file = pub(artSrc(name));
      expect(fs.existsSync(file), file).toBe(true);
      expect(webpSize(file), name).toEqual([...size]);
    }
  });

  it('picks the same weekday as the core title', () => {
    const titles: Record<string, string> = {
      'art-day-sunday': 'SUNDAY SUPERSTARS', 'art-day-monday': 'MONDAY MASTERS',
      'art-day-tuesday': 'TUESDAY TITANS', 'art-day-wednesday': 'WEDNESDAY WIZARDS',
      'art-day-thursday': 'THURSDAY THUNDER', 'art-day-friday': 'FRIDAY’S FINEST',
      'art-day-saturday': 'SATURDAY STARS',
    };
    for (let d = 1; d <= 14; d++) {
      const day = `2026-10-${String(d).padStart(2, '0')}`;
      expect(titles[dayArtName(day)]).toBe(leaderboardTitle(day));
    }
    expect(new Set(DAY_ART).size).toBe(7);
  });
});

describe('game art', () => {
  it('covers every game id in the catalog, 256 px square', () => {
    for (const m of MODES) {
      expect(GAME_ART_IDS.has(m.id), m.id).toBe(true);
      const file = pub(gameArtSrc(m.id) as string);
      expect(fs.existsSync(file), file).toBe(true);
      expect(webpSize(file)).toEqual([256, 256]);
    }
    expect(gameArtSrc('nope')).toBeNull();
    expect(gameArtSrc(null)).toBeNull();
  });

  it('tells art icons from plain glyphs', () => {
    const Art = Object.assign(() => null, { gameArtId: 'six' });
    expect(isGameArtIcon(Art)).toBe(true);
    expect(isGameArtIcon(() => null)).toBe(false);
    expect(isGameArtIcon(null)).toBe(false);
  });
});

describe('3D UI icons (§0, §4, §5)', () => {
  it('ships every art-pass icon', () => {
    for (const name of ['badge-w', 'badge-l', 'badge-check', 'lock', 'bell', 'add-friend', 'share', 'sound', 'back']) {
      const file = pub(`/art/icon3d-${name}.webp`);
      expect(fs.existsSync(file), file).toBe(true);
      expect(webpSize(file)).toEqual([256, 256]);
    }
  });
});

describe('second pass (§6–§9)', () => {
  it('lists every art-* file in public/art (none shipped without a recorded size)', () => {
    const files = fs.readdirSync(pub('/art')).filter((f) => f.startsWith('art-') && f.endsWith('.webp'));
    for (const f of files) expect(Object.keys(ART_SIZE), f).toContain(f.replace(/\.webp$/, ''));
  });

  it('has moment lettering for every label (§6), ≈900 wide and wider than tall', () => {
    for (const m of Object.keys(MOMENT_LABEL)) {
      const name = `art-moment-${m}` as ArtName;
      const [w, h] = ART_SIZE[name];
      expect(w, name).toBeGreaterThan(h * 2);
      expect(fs.existsSync(pub(artSrc(name))), name).toBe(true);
    }
    expect(resultMoment('win')).toBe('youwin');
    expect(resultMoment('loss')).toBe('youlose');
    expect(resultMoment('draw')).toBe('draw');
  });

  it('has a scene for every empty / error / done state (§7)', () => {
    for (const scene of Object.values(PAGE_SCENES)) {
      const name = `art-scene-${scene}` as ArtName;
      expect(ART_SIZE[name], name).toBeDefined();
      expect(fs.existsSync(pub(artSrc(name))), name).toBe(true);
    }
  });

  it('ships the WELCOME! and LEADERBOARD titles (§8)', () => {
    expect(ART_SIZE['art-title-welcome']).toBeDefined();
    expect(ART_SIZE['art-title-leaderboard']).toBeDefined();
  });

  it('has a pocket game icon for every friendly kind (§9), 256 px square', () => {
    for (const k of FRIENDLY_KINDS) {
      expect(POCKET_ART_KINDS.has(k), k).toBe(true);
      const file = pub(pocketArtSrc(k) as string);
      expect(fs.existsSync(file), file).toBe(true);
      expect(webpSize(file)).toEqual([256, 256]);
    }
    expect(pocketArtSrc('nope')).toBeNull();
    expect(pocketArtSrc(undefined)).toBeNull();
  });
});

describe('game title art (§10)', () => {
  it('ships all 18 titles, ≈900 wide and much wider than tall', () => {
    expect(GAME_TITLE_ART_IDS).toHaveLength(18);
    for (const id of GAME_TITLE_ART_IDS) {
      const name = gameTitleArt(id) as ArtName;
      expect(name).toBe(`art-game-${id}`);
      const [w, h] = ART_SIZE[name];
      expect(w, name).toBeGreaterThanOrEqual(600);
      expect(w, name).toBeLessThanOrEqual(1000);
      expect(w, name).toBeGreaterThan(h * 2.5);
      expect(fs.existsSync(pub(artSrc(name))), name).toBe(true);
    }
  });

  it('has a title for every game with a db key, none for VS / More / Sweep', () => {
    for (const m of MODES) {
      if (m.dbKey) expect(gameTitleArtForDbKey(m.dbKey), m.dbKey).toBe(`art-game-${m.id}`);
      else expect(gameTitleArt(m.id), m.id).toBeNull();
    }
    expect(gameTitleArtForDbKey('SWEEP')).toBeNull();
    expect(gameTitleArtForDbKey(null)).toBeNull();
    expect(gameTitleArt('nope')).toBeNull();
  });

  it('tops every game guide', () => {
    for (const m of MODES) {
      if (m.guideSlug) expect(gameTitleArtForGuide(m.guideSlug), m.guideSlug).toBe(`art-game-${m.id}`);
    }
    expect(gameTitleArtForGuide('letter-ladder')).toBe('art-game-ladder');
    expect(gameTitleArtForGuide('nope')).toBeNull();
    expect(gameTitleArtForGuide(undefined)).toBeNull();
  });

  it('names each title by the words it draws', () => {
    expect(gameTitleArtLabel('art-game-practice')).toBe('Classic');
    expect(gameTitleArtLabel('art-game-six')).toBe('Classic Six');
    expect(gameTitleArtLabel('art-game-seven')).toBe('Classic Seven');
    expect(gameTitleArtLabel('art-game-regions')).toBe('Starsweep');
    expect(gameTitleArtLabel('art-game-scramble')).toBe('Muddle');
  });

  it('draws at the spec heights', () => {
    expect(GAME_TITLE_ART_HEIGHT.header).toBeGreaterThanOrEqual(36);
    expect(GAME_TITLE_ART_HEIGHT.header).toBeLessThanOrEqual(40);
    expect(GAME_TITLE_ART_HEIGHT.guide).toBe(56);
    expect(GAME_TITLE_ART_HEIGHT.playCard).toBe(40);
  });
});
