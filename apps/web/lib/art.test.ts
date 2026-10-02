import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FRIENDLY_KINDS, leaderboardTitle } from '@wordle-duel/core';
import {
  ART_SIZE, DAY_ART, GAME_ART_IDS, GAME_TITLE_ART_HEIGHT, GAME_TITLE_ART_IDS, MOMENT_LABEL, PAGE_SCENES, PAGE_TILES, PAGE_TINTS,
  POCKET_ART_KINDS, artSrc, dayArtName, gameArtSrc, gameTitleArt, gameTitleArtForDbKey, gameTitleArtForGuide, gameTitleArtLabel,
  isGameArtIcon, onPageShadow, pageCardShadow, pocketArtSrc, resultMoment, type ArtName,
  GAME_HEADER, GAME_TILES_OPACITY, accentCardShadow, artMotion, gameHeaderArtHeight, gameHeaderStyle, gameTint,
  gameTintForDbKey, gameToastTop, mixOver,
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

  it('draws at the spec height caps (§14: larger, sized by width)', () => {
    expect(GAME_TITLE_ART_HEIGHT.header).toBe(72);
    expect(GAME_TITLE_ART_HEIGHT.headerMin).toBe(44);
    expect(GAME_TITLE_ART_HEIGHT.guide).toBe(72);
    expect(GAME_TITLE_ART_HEIGHT.playCard).toBe(52);
  });
});

describe('page tint + tiles (§11)', () => {
  it('ships the seamless tile pattern v2 (§18.1), 720 px square, drawn at 360 px, opacity baked in', () => {
    expect(ART_SIZE['art-bg-tiles']).toEqual([720, 720]);
    expect(webpSize(pub(artSrc(PAGE_TILES.name)))).toEqual([720, 720]);
    expect(PAGE_TILES.size).toBe(360);
    expect(PAGE_TILES.opacity).toEqual({ light: 1, dark: 0.6 });
  });

  it('has the five tints with the spec stops, light and dark', () => {
    expect(PAGE_TINTS.home.light).toEqual(['#F3EEFF', '#FBEFFF', '#FFF1F7']);
    expect(PAGE_TINTS.leaderboard.dark).toEqual(['#1E1608', '#23160D', '#241221']);
    expect(PAGE_TINTS.stats.light).toEqual(['#EEF4FF', '#EEEBFF', '#F4EEFF']);
    expect(PAGE_TINTS.friends.dark).toEqual(['#241024', '#22102A', '#1A1030']);
    expect(PAGE_TINTS.vs.light).toEqual(['#E9FBF8', '#ECF6FF', '#F1EEFF']);
    for (const [tint, t] of Object.entries(PAGE_TINTS)) {
      for (const c of [...t.light, ...t.dark, t.accent]) expect(c, tint).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.light, tint).toHaveLength(3);
      expect(t.dark, tint).toHaveLength(3);
    }
  });

  it('tints card shadows toward the page accent at ~11%, y 5, blur 14', () => {
    expect(pageCardShadow('home')).toBe('0 5px 14px rgba(124,58,237,0.11)');
    expect(pageCardShadow('leaderboard')).toBe('0 5px 14px rgba(245,158,11,0.11)');
    expect(pageCardShadow('stats')).toBe('0 5px 14px rgba(37,99,235,0.11)');
    expect(pageCardShadow('friends')).toBe('0 5px 14px rgba(236,72,153,0.11)');
    expect(pageCardShadow('vs')).toBe('0 5px 14px rgba(13,148,136,0.11)');
    expect(onPageShadow()).toBe('var(--page-card-shadow, none)');
    expect(onPageShadow('0 1px 2px #000')).toBe('var(--page-card-shadow, 0 1px 2px #000)');
  });
});

describe('Home section titles (§12)', () => {
  it('ships WORDOCIOUS DAILIES as wide as PUZZLES and WORD OF THE DAY', () => {
    const [w, h] = ART_SIZE['art-title-dailies'];
    expect(webpSize(pub(artSrc('art-title-dailies')))).toEqual([w, h]);
    expect(w).toBe(ART_SIZE['art-title-puzzles'][0]);
    expect(w).toBe(ART_SIZE['art-title-wotd'][0]);
    expect(w).toBeGreaterThan(h * 4);
  });
});

describe('game titles fill the header (§14)', () => {
  it('sizes the header art by the room between the corner buttons, 44–72 px', () => {
    const [w, h] = ART_SIZE['art-game-scramble'];
    const room = 2 * (GAME_HEADER.side + GAME_HEADER.clearance);
    expect(GAME_HEADER.pad).toBeLessThanOrEqual(6);
    expect(GAME_HEADER.clearance).toBeGreaterThanOrEqual(GAME_HEADER.button);
    expect(gameHeaderArtHeight('art-game-scramble')).toBe(
      `clamp(44px, calc((100vw - ${room}px) * ${(h / w).toFixed(4)}), 72px)`,
    );
  });

  it('centers the corner buttons on the art and moves toasts down by the growth', () => {
    const style = gameHeaderStyle('QUORDLE') as Record<string, string>;
    expect(style['--game-art-h']).toBe(gameHeaderArtHeight('art-game-quordle'));
    expect(style['--game-corner-top']).toBe('calc(6px + (var(--game-art-h) - 44px) / 2)');
    expect(style['--game-header-shift']).toBe('calc(var(--game-art-h) + -40px)');
    expect((gameHeaderStyle('SCRAMBLE', 36) as Record<string, string>)['--game-header-shift']).toBe('calc(var(--game-art-h) + -30px)');
    expect(gameHeaderStyle('VS')).toEqual({});
    expect(gameToastTop(90)).toBe('calc(90px + var(--game-header-shift, 0px))');
  });

  it('gives every solo game with a header title art', () => {
    for (const key of ['DUEL', 'DUEL_6', 'DUEL_7', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'PROPERNOUNDLE', 'SUDOKU',
      'SCRAMBLE', 'HUB', 'CROSSWORD', 'GROUPS', 'LADDER', 'CRYPTOGRAM', 'WORDSEARCH', 'REGIONS']) {
      expect(Object.keys(gameHeaderStyle(key)), key).toHaveLength(3);
    }
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
  it('floats page and day titles, only pops game titles, leaves moments and scenes alone', () => {
    expect(artMotion('art-title-friends')).toBe('float');
    expect(artMotion('art-day-friday')).toBe('float');
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
