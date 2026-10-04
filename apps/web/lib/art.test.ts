import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FRIENDLY_KINDS, leaderboardTitle } from '@wordle-duel/core';
import {
  ART_SIZE, DAY_ART, GAME_ART_IDS, GAME_TITLE_ART_HEIGHT, GAME_TITLE_ART_IDS, MOMENT_LABEL, PAGE_SCENES, PAGE_TILES,
  PAGE_TINTS, POCKET_ART_KINDS, artSrc, dayArtName, gameArtSrc, gameTitleArt, gameTitleArtForDbKey,
  gameTitleArtForGuide, gameTitleArtLabel, isGameArtIcon, pageCardShadow, pocketArtSrc, resultMoment, type ArtName,
  GAME_HEADER, GAME_TILES_OPACITY, accentCardShadow, artMotion, gameHeaderArtHeight, gameHeaderStyle, gameTint,
  gameTintForDbKey, gameToastTop, mixOver, GAME_TITLE_TOP, WALL_OVERLAY, gameWallForDbKey, pageWall, wideWallSrc,
  type WallArtName, POSE_ART, POSE_ART_NAMES, POSE_SIZE, poseArt, poseSrc, GOPRO_SIGN_CAST, goProSignOfDay,
} from './art';
import { CAST } from './mascots';
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
    // C2b: the Sweep tile's broom (not a catalog game).
    expect(webpSize(pub(gameArtSrc('sweep') as string))).toEqual([256, 256]);
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
    // wallpaper `-wide` twins (desktop only) are checked with their portrait wallpaper below
    for (const f of files) expect(Object.keys(ART_SIZE), f).toContain(f.replace(/\.webp$/, '').replace(/^(art-wall-.+)-wide$/, '$1'));
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
    expect(ART_SIZE['art-titlecast-welcome']).toBeDefined();
    expect(ART_SIZE['art-titlecast-leaderboard']).toBeDefined();
  });

  it('ships the PLAY WITH FRIENDS (guest Friends) and MORE (finished sheet) titles', () => {
    for (const name of ['art-titlecast-playwithfriends', 'art-titlecast-more'] as ArtName[]) {
      expect(ART_SIZE[name], name).toBeDefined();
      expect(fs.existsSync(pub(artSrc(name))), name).toBe(true);
    }
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
  it('ships all 18 titles, 900–1200 wide (10-03 hi-res re-letters) and much wider than tall', () => {
    expect(GAME_TITLE_ART_IDS).toHaveLength(18);
    for (const id of GAME_TITLE_ART_IDS) {
      const name = gameTitleArt(id) as ArtName;
      expect(name).toBe(`art-game-${id}`);
      const [w, h] = ART_SIZE[name];
      expect(w, name).toBeGreaterThanOrEqual(600);
      expect(w, name).toBeLessThanOrEqual(1200);
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

  it('draws at the spec height caps (§14; §19.3 game headers much bigger)', () => {
    expect(GAME_TITLE_ART_HEIGHT.header).toBe(120);
    expect(GAME_TITLE_ART_HEIGHT.headerShort).toBe(56);
    expect(GAME_TITLE_ART_HEIGHT.shortViewport).toBe(700);
    expect(GAME_TITLE_ART_HEIGHT.headerMin).toBe(44);
    expect(GAME_TITLE_ART_HEIGHT.guide).toBe(72);
    expect(GAME_TITLE_ART_HEIGHT.playCard).toBe(52);
  });
});

describe('big game titles below the corner row (§19.3)', () => {
  it('sizes the header art by the full width minus 32, 44 px up to the cap var (120 / 56)', () => {
    const [w, h] = ART_SIZE['art-game-scramble'];
    expect(GAME_HEADER.pad).toBeLessThanOrEqual(6);
    expect(GAME_HEADER.inset).toBe(32);
    expect(gameHeaderArtHeight('art-game-scramble')).toBe(
      `clamp(44px, calc((var(--game-col-w, 100vw) - 32px) * ${(h / w).toFixed(4)}), var(--game-title-cap, 120px))`,
    );
  });

  it('keeps the corner buttons in their own top row, the title below it, toasts moved down by the growth', () => {
    expect(GAME_TITLE_TOP).toBe(GAME_HEADER.pad + GAME_HEADER.button + GAME_HEADER.gap);
    const style = gameHeaderStyle('QUORDLE') as Record<string, string>;
    expect(style['--game-art-h']).toBe(gameHeaderArtHeight('art-game-quordle'));
    expect(style['--game-corner-top']).toBe('6px');
    expect(style['--game-title-top']).toBe(`${GAME_TITLE_TOP}px`);
    expect(style['--game-header-shift']).toBe(`calc(var(--game-art-h) + ${GAME_TITLE_TOP - 46}px)`);
    expect((gameHeaderStyle('SCRAMBLE', 36) as Record<string, string>)['--game-header-shift']).toBe(`calc(var(--game-art-h) + ${GAME_TITLE_TOP - 36}px)`);
    expect(gameHeaderStyle('VS')).toEqual({});
    expect(gameToastTop(90)).toBe('calc(90px + var(--game-header-shift, 0px))');
  });

  it('caps the title at 120, or 56 on viewports under 700 tall (globals.css)', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8');
    expect(css).toMatch(/\.game-art-header \{\s*--game-title-cap: 120px;\s*padding-top: var\(--game-title-top, 6px\);/);
    expect(css).toMatch(/@media \(max-height: 699\.98px\) \{\s*\.game-art-header \{ --game-title-cap: 56px; \}/);
  });

  it('gives every solo game with a header title art', () => {
    for (const key of ['DUEL', 'DUEL_6', 'DUEL_7', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'PROPERNOUNDLE', 'SUDOKU',
      'SCRAMBLE', 'HUB', 'CROSSWORD', 'GROUPS', 'LADDER', 'CRYPTOGRAM', 'WORDSEARCH', 'REGIONS']) {
      expect(Object.keys(gameHeaderStyle(key)), key).toHaveLength(4);
    }
  });
});

describe('wallpapers (§19.1)', () => {
  const WALL = [1179, 2556];

  it('ships a full-resolution portrait wallpaper + a landscape twin for every page tint', () => {
    for (const tint of Object.keys(PAGE_TINTS) as (keyof typeof PAGE_TINTS)[]) {
      const name = pageWall(tint);
      expect(name).toBe(`art-wall-${tint}`);
      const [w, h] = ART_SIZE[name];
      expect([w, h], name).toEqual(WALL);
      expect(webpSize(pub(artSrc(name))), name).toEqual([w, h]);
      expect(h, name).toBeGreaterThan(w);
      expect(webpSize(pub(wideWallSrc(name))), `${name}-wide`).toEqual([2400, 1500]);
    }
  });

  it('ships a wallpaper for every solo game, none for VS / Sweep', () => {
    for (const id of GAME_TITLE_ART_IDS) {
      const name = `art-wall-game-${id}` as ArtName;
      expect(ART_SIZE[name], name).toEqual(WALL);
      expect(webpSize(pub(artSrc(name))), name).toEqual([...ART_SIZE[name]]);
      expect(webpSize(pub(wideWallSrc(name as WallArtName))), `${name}-wide`).toEqual([2400, 1500]);
    }
    for (const m of MODES) {
      if (m.dbKey) expect(gameWallForDbKey(m.dbKey), m.dbKey).toBe(`art-wall-game-${m.id}`);
    }
    expect(gameWallForDbKey('DUEL_6')).toBe('art-wall-game-six');
    expect(gameWallForDbKey('VS')).toBeNull();
    expect(gameWallForDbKey('SWEEP')).toBeNull();
    expect(gameWallForDbKey(undefined)).toBeNull();
  });

  it('dims 58% (games 62%) in dark mode, 20% white / 70% dark under reduce transparency', () => {
    expect(WALL_OVERLAY).toEqual({ color: '#120D1F', dark: 0.58, darkGame: 0.62, a11yLight: 0.2, a11yDark: 0.7 });
  });

  it('draws the wallpaper fixed and cover-fit, the tile pattern gone from pages (globals.css)', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8');
    const block = css.slice(css.indexOf('.page-bg {'), css.indexOf('/* Tile/keyboard state utilities'));
    expect(block).toContain('position: fixed;');
    expect(block).toContain('background-image: var(--page-wall, none), linear-gradient(');
    expect(block).toContain('background-size: cover, auto;');
    expect(block).not.toContain('--page-tiles');
    expect(block).toContain('@media (prefers-reduced-transparency: reduce), (prefers-contrast: more)');
    expect(block).toContain('@media (min-aspect-ratio: 1/1)');
    expect(block).toContain('var(--page-wall-wide, var(--page-wall, none))');
  });
});

describe('game screen tints (§15)', () => {
  it('lays the accent over white / #FFF7FB (light) and #120D1F (dark)', () => {
    expect(mixOver('#000000', 0.5, '#FFFFFF')).toBe('#808080');
    expect(mixOver('#7c3aed', 0, '#FFF7FB')).toBe('#FFF7FB');
    expect(mixOver('#7c3aed', 1, '#FFFFFF')).toBe('#7C3AED');
    const t = gameTint('#ec4899');
    expect(t.light).toEqual([mixOver('#ec4899', 0.06, '#FFFFFF'), mixOver('#ec4899', 0.1, '#FFFFFF'), mixOver('#ec4899', 0.04, '#FFF7FB')]);
    expect(t.dark).toEqual([mixOver('#ec4899', 0.1, '#120D1F'), mixOver('#ec4899', 0.14, '#120D1F'), mixOver('#ec4899', 0.08, '#120D1F')]);
    expect(t.accent).toBe('#ec4899');
  });

  it('tints every solo game from its catalog accent, tiles quieter than menus', () => {
    for (const m of MODES) {
      if (!m.dbKey) continue;
      expect(gameTintForDbKey(m.dbKey), m.dbKey).toEqual(gameTint(m.accentHex));
    }
    expect(gameTintForDbKey('NOPE')).toBeNull();
    expect(GAME_TILES_OPACITY).toEqual({ light: 0.55, dark: 0.35 });
    expect(GAME_TILES_OPACITY.light).toBeLessThan(PAGE_TILES.opacity.light);
    expect(accentCardShadow('#7c3aed')).toBe(pageCardShadow('home'));
  });
});

describe('title art motion (§16)', () => {
  it('pops page, day and game titles in (no float, FINISH_SPEC A6), leaves moments and scenes alone', () => {
    // FINISH_SPEC A6: page / day titles no longer float, they only pop in.
    expect(artMotion('art-titlecast-friends')).toBe('pop');
    expect(artMotion('art-day-friday')).toBe('pop');
    expect(artMotion('art-game-quordle')).toBe('pop');
    expect(artMotion('art-moment-victory')).toBe('none');
    expect(artMotion('art-scene-r-asleep')).toBe('none');
  });

  it('turns the motion off under Reduce Motion, OS and in-app', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.art-pop, \.art-float \{ animation: none !important; \}/);
    expect(css).toContain('[data-reduced-motion="true"] .art-float { animation: none !important; }');
  });
});

describe('cast poses (finishing build)', () => {
  it('records every shipped pose (at least the 62 of the first set), every file 320 px square', () => {
    expect(POSE_ART_NAMES.length).toBeGreaterThanOrEqual(62);
    expect(new Set(POSE_ART_NAMES).size).toBe(POSE_ART_NAMES.length);
    for (const name of POSE_ART_NAMES) {
      expect(ART_SIZE[name], name).toEqual([POSE_SIZE, POSE_SIZE]);
      expect(fs.existsSync(pub(artSrc(name))), name).toBe(true);
      expect(webpSize(pub(artSrc(name))), name).toEqual([POSE_SIZE, POSE_SIZE]);
    }
    const files = fs.readdirSync(pub('/art')).filter((f) => f.startsWith('art-pose-'));
    expect(files.length).toBe(POSE_ART_NAMES.length);
  });

  it('has poses for every cast member and builds their paths', () => {
    expect(Object.keys(POSE_ART).sort()).toEqual([...CAST].sort());
    expect(poseArt('s', 'trophy')).toBe('art-pose-s-trophy');
    expect(poseSrc('u', 'lotus')).toBe('/art/art-pose-u-lotus.webp');
  });
});

// FINISH_SPEC BJ17: the GO PRO sign cast — every member ships ×3, and the finish upsell's daily pick
// rotates through all ten with the same formula on iOS (GoProSign.ofDay) and Android (GoProSign.ofDay).
describe('GO PRO sign cast (BJ17)', () => {
  it('ships every member with its size, on iOS and Android too', () => {
    const root = path.join(__dirname, '..', '..');
    for (const id of GOPRO_SIGN_CAST) {
      expect(ART_SIZE[`art-gopro-sign-${id}`], id).toBeDefined();
      expect(fs.existsSync(path.join(root, 'ios', 'Wordocious', 'Resources', 'Assets.xcassets', `art-gopro-sign-${id}.imageset`, `art-gopro-sign-${id}.png`)), id).toBe(true);
      expect(fs.existsSync(path.join(root, 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi', `art_gopro_sign_${id}.webp`)), id).toBe(true);
    }
    expect([...GOPRO_SIGN_CAST]).toEqual([...CAST]);
  });

  it('rotates the finish upsell through all ten over ten days', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 10; d++) seen.add(goProSignOfDay(`2026-10-${String(d).padStart(2, '0')}`));
    expect(seen.size).toBe(10);
    expect(goProSignOfDay('2026-10-03')).toBe(GOPRO_SIGN_CAST[(2026 * 372 + 10 * 31 + 3) % 10]);
  });

  it('keeps the same cast order and day formula in the iOS and Android ports', () => {
    const root = path.join(__dirname, '..', '..');
    const ios = fs.readFileSync(path.join(root, 'ios', 'Wordocious', 'Sources', 'StatKit.swift'), 'utf8');
    const droid = fs.readFileSync(path.join(root, 'android', 'app', 'src', 'main', 'kotlin', 'com', 'wordocious', 'app', 'ui', 'StatKit.kt'), 'utf8');
    const list = GOPRO_SIGN_CAST.map((id) => `"${id}"`).join(', ');
    expect(ios).toContain(`static let cast = [${list}]`);
    expect(droid).toContain(`val cast = listOf(${list})`);
    expect(ios).toContain('* 372 +');
    expect(droid).toContain('* 372 +');
  });
});
