// The art pass (founder, 2026-10-02; docs/ART_SPEC.md): one table of the
// shipped art in public/art/ with each file's real pixel size, so every <img>
// gets an explicit width/height (no layout shift) and is sized by width with
// the true aspect ratio (never stretched). iOS image sets and Android
// drawable-nodpi carry the same names (docs/design/brand/ship-art.py).

import type { CSSProperties } from 'react';
import { MODES, MODE_BY_DBKEY } from './modes.generated';

/** Leaderboard day titles (§1), one per weekday, Sunday first (Date#getUTCDay order). */
export const DAY_ART = [
  'art-day-sunday',
  'art-day-monday',
  'art-day-tuesday',
  'art-day-wednesday',
  'art-day-thursday',
  'art-day-friday',
  'art-day-saturday',
] as const;
export type DayArtName = (typeof DAY_ART)[number];

/** Whole-cast page titles (§2). */
export type TitleArtName =
  | 'art-title-friends'
  | 'art-title-stats'
  | 'art-title-records'
  | 'art-title-vs'
  | 'art-title-puzzles'
  | 'art-title-wotd'
  | 'art-title-settings'
  | 'art-title-howto'
  | 'art-title-guides'
  | 'art-title-strategy'
  | 'art-title-words'
  | 'art-title-faq'
  | 'art-title-privacy'
  | 'art-title-terms'
  | 'art-title-gopro'
  | 'art-title-moregames'
  // Second pass (§8): WELCOME! on the sign-in / signed-out landing, and the
  // LEADERBOARD title holidays show over their HEROES text.
  | 'art-title-welcome'
  | 'art-title-leaderboard'
  // §12: the Home section header above the daily games (§19.2: reads just DAILIES).
  | 'art-title-dailies';

/**
 * The seamless letter-tile page pattern (§11; v2 §18): 720 px square of big
 * glossy, softly blurred letter tiles with their opacity baked in.
 */
export type BackgroundArtName = 'art-bg-tiles';

/**
 * Wallpapers (§19.1, v3 drawn in code at full phone resolution): 1179×2556,
 * portrait, opaque, each with its own tile arrangement in the page's / game's
 * color, plus a 2400×1500 `<name>-wide` twin for landscape (desktop) viewports. One per page tint (`art-wall-home`,
 * …) and one per solo game (`art-wall-game-<mode id>`, the same 18 ids as the
 * game title art).
 */
export type WallArtName = `art-wall-${PageTint}` | `art-wall-game-${GameTitleArtId}`;

/**
 * Moment lettering (§6): glossy result / celebration headlines drawn in place
 * of the text, each with the words it says as its accessible name.
 */
export const MOMENT_LABEL = {
  victory: 'Victory!',
  soclose: 'So close!',
  sweep: 'Sweep!',
  flawless: 'Flawless!',
  youwin: 'You win!',
  youlose: 'You lose',
  draw: 'Draw',
  newrecord: 'New record!',
  streak: 'Streak!',
} as const;
export type MomentName = keyof typeof MOMENT_LABEL;
export type MomentArtName = `art-moment-${MomentName}`;

/** A head-to-head result's lettering (VS, bot, challenge): YOU WIN! / YOU LOSE / DRAW. */
export function resultMoment(outcome: 'win' | 'loss' | 'draw'): MomentName {
  return outcome === 'win' ? 'youwin' : outcome === 'loss' ? 'youlose' : 'draw';
}

/**
 * Scenes for empty / error / done states (§7): one character with a prop.
 * Decorative; the state's one-line voice text stays under it.
 */
export type SceneName =
  /** Empty lists / boards ("nobody's on yet"). */
  | 'r-asleep'
  /** Offline, failed to load, error screens. */
  | 'r-unplugged'
  /** All dailies done, played-today limit, "fresh puzzles in …". */
  | 'u-alldone'
  /** 404, profile / invite / item not found. */
  | 'o3-notfound'
  /** Empty Friends ("add a friend"), invite sheet header. */
  | 'i-invite'
  /** Stats with no games yet. */
  | 'd-nostats';
export type SceneArtName = `art-scene-${SceneName}`;

/** Which scene each empty / error / done state draws (§7), beside PAGE_HOSTS. */
export const PAGE_SCENES = {
  /** Empty lists and boards: "nobody's on yet", no results, no records. */
  empty: 'r-asleep',
  /** Offline, failed to load, the error screen. */
  offline: 'r-unplugged',
  /** All done for today / played-today limit. */
  allDone: 'u-alldone',
  /** 404, player / invite / challenge / game not found. */
  notFound: 'o3-notfound',
  /** Empty Friends: "Add a friend and the race begins.", invite sheet. */
  addFriend: 'i-invite',
  /** Stats with no games yet. */
  stats: 'd-nostats',
} as const satisfies Record<string, SceneName>;

/**
 * Game title art (§10, third pass): each game's name lettered in its own accent
 * color with its host at the end, ≈900 wide. Keyed by mode id (modes.json `id`);
 * VS and More Games have none.
 */
export const GAME_TITLE_ART_IDS = [
  'practice', 'gauntlet', 'quordle', 'octordle', 'sequence', 'rescue', 'six', 'seven',
  'propernoundle', 'sudoku', 'scramble', 'hub', 'crossword', 'groups', 'ladder', 'cryptogram',
  'wordsearch', 'regions',
] as const;
export type GameTitleArtId = (typeof GAME_TITLE_ART_IDS)[number];
export type GameTitleArtName = `art-game-${GameTitleArtId}`;

export type ArtName = DayArtName | TitleArtName | MomentArtName | SceneArtName | GameTitleArtName | BackgroundArtName | WallArtName;

/** Real pixel sizes of public/art/<name>.webp (width, height). */
export const ART_SIZE: Record<ArtName, readonly [number, number]> = {
  'art-day-sunday': [900, 540],
  'art-day-monday': [900, 861],
  'art-day-tuesday': [900, 540],
  'art-day-wednesday': [900, 840],
  'art-day-thursday': [879, 482],
  'art-day-friday': [853, 591],
  'art-day-saturday': [898, 502],
  'art-title-friends': [980, 249],
  'art-title-stats': [1080, 257],
  'art-title-records': [1080, 154],
  'art-title-vs': [757, 158],
  'art-title-puzzles': [1080, 206],
  'art-title-wotd': [1080, 174],
  'art-title-settings': [1080, 205],
  'art-title-howto': [1080, 211],
  'art-title-guides': [1080, 238],
  'art-title-strategy': [1080, 239],
  'art-title-words': [1080, 244],
  'art-title-faq': [966, 290],
  'art-title-privacy': [1080, 254],
  'art-title-terms': [1080, 246],
  'art-title-gopro': [1080, 218],
  'art-title-moregames': [1080, 211],
  'art-title-welcome': [1049, 233],
  'art-title-leaderboard': [1080, 214],
  'art-title-dailies': [1080, 246],
  'art-bg-tiles': [720, 720],
  'art-moment-victory': [880, 180],
  'art-moment-soclose': [899, 179],
  'art-moment-sweep': [609, 150],
  'art-moment-flawless': [826, 149],
  'art-moment-youwin': [898, 197],
  'art-moment-youlose': [707, 139],
  'art-moment-draw': [540, 156],
  'art-moment-newrecord': [898, 139],
  'art-moment-streak': [647, 146],
  'art-scene-r-asleep': [373, 302],
  'art-scene-r-unplugged': [347, 287],
  'art-scene-u-alldone': [404, 292],
  'art-scene-o3-notfound': [374, 298],
  'art-scene-i-invite': [291, 340],
  'art-scene-d-nostats': [332, 277],
  'art-game-practice': [900, 232],
  'art-game-gauntlet': [895, 208],
  'art-game-quordle': [900, 204],
  'art-game-octordle': [900, 196],
  'art-game-sequence': [900, 217],
  'art-game-rescue': [900, 179],
  'art-game-six': [900, 201],
  'art-game-seven': [900, 163],
  'art-game-propernoundle': [900, 164],
  'art-game-sudoku': [617, 234],
  'art-game-scramble': [817, 211],
  'art-game-hub': [898, 231],
  'art-game-crossword': [900, 220],
  'art-game-groups': [895, 231],
  'art-game-ladder': [900, 168],
  'art-game-cryptogram': [900, 181],
  'art-game-wordsearch': [846, 226],
  'art-game-regions': [900, 214],
  // §19.1 wallpapers.
  'art-wall-home': [1179, 2556],
  'art-wall-leaderboard': [1179, 2556],
  'art-wall-stats': [1179, 2556],
  'art-wall-friends': [1179, 2556],
  'art-wall-vs': [1179, 2556],
  'art-wall-game-practice': [1179, 2556],
  'art-wall-game-gauntlet': [1179, 2556],
  'art-wall-game-quordle': [1179, 2556],
  'art-wall-game-octordle': [1179, 2556],
  'art-wall-game-sequence': [1179, 2556],
  'art-wall-game-rescue': [1179, 2556],
  'art-wall-game-six': [1179, 2556],
  'art-wall-game-seven': [1179, 2556],
  'art-wall-game-propernoundle': [1179, 2556],
  'art-wall-game-sudoku': [1179, 2556],
  'art-wall-game-scramble': [1179, 2556],
  'art-wall-game-hub': [1179, 2556],
  'art-wall-game-crossword': [1179, 2556],
  'art-wall-game-groups': [1179, 2556],
  'art-wall-game-ladder': [1179, 2556],
  'art-wall-game-cryptogram': [1179, 2556],
  'art-wall-game-wordsearch': [1179, 2556],
  'art-wall-game-regions': [1179, 2556],
};

const GAME_TITLE_ART_SET: ReadonlySet<string> = new Set(GAME_TITLE_ART_IDS);

/** A game's title art (§10) by mode id, or null when it has none (VS, More Games). */
export function gameTitleArt(id: string | null | undefined): GameTitleArtName | null {
  return id && GAME_TITLE_ART_SET.has(id) ? (`art-game-${id}` as GameTitleArtName) : null;
}

/** The words a game's title art says, its accessible name: the catalog title, except Classic Six / Seven. */
export function gameTitleArtLabel(name: GameTitleArtName): string {
  const id = name.slice('art-game-'.length);
  if (id === 'six') return 'Classic Six';
  if (id === 'seven') return 'Classic Seven';
  return MODES.find((m) => m.id === id)?.title ?? id;
}

/**
 * Rendered heights of the game title art, CSS px. §14 (founder, 2026-10-02
 * midday: "much larger on the page"): every place is sized by the width it
 * has, and these are the height caps. §19.3 (late morning: "much bigger"):
 * the game screen title moves below the corner-button row and spans the full
 * width minus 32, ≤ 120 tall (≤ 84 on short viewports, height < 700).
 */
export const GAME_TITLE_ART_HEIGHT = {
  /** Game screen header cap (§19.3): full width minus 32, ≤ 120 tall. */
  header: 120,
  /** The cap on short viewports (height < `shortViewport`). */
  headerShort: 84,
  /** Viewport height (CSS px) under which the short cap applies. */
  shortViewport: 700,
  /** Game screen header floor, so short names (MUDDLE) never look tiny. */
  headerMin: 44,
  /** Guide sheet / guide page top: full width minus 32, ≤ 72 tall (§14; was 56). */
  guide: 72,
  /** Leaderboard / Records Play card: fills the room left of Play, ≤ 52 tall (§14; was 40). */
  playCard: 52,
} as const;

/**
 * The game screen header around the title art (§19.3): the 44 px corner
 * buttons (Home left, ? / sound right) sit in their own top row `pad` px from
 * the top; the title art starts `gap` px under that row and spans the full
 * viewport width minus `inset` (16 px each side; the header's own side padding
 * is `side`, px-2), so its height is (100vw − inset) × the art's aspect ratio.
 * The guess / timer status line follows the art; `pad` px under the header.
 */
export const GAME_HEADER = { pad: 6, side: 8, button: 44, gap: 2, inset: 32 } as const;

/** Where the title art starts, px from the header top: under the corner-button row (§19.3). */
export const GAME_TITLE_TOP = GAME_HEADER.pad + GAME_HEADER.button + GAME_HEADER.gap;

/**
 * A header art's rendered height as CSS (§19.3): the full width minus 32 times
 * the art's aspect ratio, clamped to [headerMin, cap], where the cap is
 * `--game-title-cap` (globals.css .game-art-header: 120, or 84 when the
 * viewport is under 700 tall).
 */
export function gameHeaderArtHeight(name: GameTitleArtName): string {
  const [w, h] = ART_SIZE[name];
  return `clamp(${GAME_TITLE_ART_HEIGHT.headerMin}px, calc((100vw - ${GAME_HEADER.inset}px) * ${(h / w).toFixed(4)}), var(--game-title-cap, ${GAME_TITLE_ART_HEIGHT.header}px))`;
}

/**
 * The style a game screen header wearing title art takes (§19.3), with
 * className `game-art-header` (globals.css: the title cap, the top padding
 * from `--game-title-top`, 6 px bottom padding):
 * - `--game-corner-top` keeps the corner buttons in their own top row
 *   (GameHomeButton / GameGuideButton / SoundToggle read it);
 * - `--game-title-top` drops the title art below that row;
 * - `--game-header-shift` is how much lower the line under the title now sits
 *   than it did before the art (`titleBottom`: where the old text title ended,
 *   px from the header top: 46 for the 8 px + 38 px headers, 36 for Muddle's
 *   compact one), so absolutely placed toasts keep their spot under the header
 *   (gameToastTop).
 * Games without title art get no change.
 */
export function gameHeaderStyle(dbKey: string, titleBottom = 46): CSSProperties {
  const art = gameTitleArtForDbKey(dbKey);
  if (!art) return {};
  return {
    '--game-art-h': gameHeaderArtHeight(art),
    '--game-corner-top': `${GAME_HEADER.pad}px`,
    '--game-title-top': `${GAME_TITLE_TOP}px`,
    '--game-header-shift': `calc(var(--game-art-h) + ${GAME_TITLE_TOP - titleBottom}px)`,
  } as CSSProperties;
}

/** A toast's `top` inside a game header, moved down by the header's growth (§14). */
export function gameToastTop(px: number): string {
  return `calc(${px}px + var(--game-header-shift, 0px))`;
}

/** A game's title art (§10) by db key (DUEL, DUEL_6, SCRAMBLE, …), or null (SWEEP, VS). */
export function gameTitleArtForDbKey(dbKey: string | null | undefined): GameTitleArtName | null {
  return dbKey ? gameTitleArt(MODE_BY_DBKEY[dbKey]?.id) : null;
}

/** A game's title art (§10) by guide slug (classic, quadword, letter-ladder, …), or null. */
export function gameTitleArtForGuide(slug: string | null | undefined): GameTitleArtName | null {
  return slug ? gameTitleArt(MODES.find((m) => m.guideSlug === slug)?.id) : null;
}

/** Public path of a title / day / game / icon art file. */
/** The landscape (desktop) twin of a wallpaper. */
export function wideWallSrc(name: WallArtName): string {
  return artSrc(`${name}-wide`);
}

export function artSrc(name: string): string {
  return `/art/${name}.webp`;
}

/** The day art for the board's local YYYY-MM-DD (same weekday math as core leaderboardTitle). */
export function dayArtName(day: string): DayArtName {
  const [y, m, d] = day.split('-').map(Number);
  return DAY_ART[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/**
 * Game ids with a glossy 3D icon (§3), public/art/game-<id>.webp, 256 px
 * square. A mode missing here keeps its old glyph.
 */
export const GAME_ART_IDS: ReadonlySet<string> = new Set([
  'practice', 'vs', 'quordle', 'octordle', 'sequence', 'rescue', 'six', 'seven', 'gauntlet',
  'propernoundle', 'more', 'sudoku', 'scramble', 'hub', 'crossword', 'groups', 'ladder',
  'cryptogram', 'wordsearch', 'regions',
]);

/**
 * The old glyphs were drawn at about half their chip (a 16 px glyph in a 32 px
 * chip); the art fills the chip, so an icon slot sized for the old glyph draws
 * the art at this multiple of it.
 */
export const GAME_ART_FILL = 1.75;

/** Public path of a game's 3D icon, or null when the game has none. */
export function gameArtSrc(id: string | null | undefined): string | null {
  return id && GAME_ART_IDS.has(id) ? artSrc(`game-${id}`) : null;
}

/**
 * True when an icon-table entry (MODE_CHROME `icon`) draws game art
 * (components/ui/game-art.tsx gameArtIcon). It then wins over a roman numeral.
 * Here, not in the client module, so server components can ask too.
 */
export function isGameArtIcon(icon: unknown): boolean {
  return typeof icon === 'function' && typeof (icon as { gameArtId?: unknown }).gameArtId === 'string';
}

/**
 * Friends pocket game icons (§9): public/art/game-pocket-<kind>.webp, 256 px
 * square, keyed by the core friendly-game kind. Same size rules as the game
 * icons (§3); a kind missing here keeps its old glyph.
 */
export const POCKET_ART_KINDS: ReadonlySet<string> = new Set(['rps', 'ttt', 'coin', 'pass', 'ghost', 'chain']);

/** Public path of a pocket game's 3D icon, or null when the kind has none. */
export function pocketArtSrc(kind: string | null | undefined): string | null {
  return kind && POCKET_ART_KINDS.has(kind) ? artSrc(`game-pocket-${kind}`) : null;
}

// ── Page backgrounds, "page tint + tiles" (§11) ─────────────────────────────

/** The five page tints: which pages draw which is in components/ui/page-background.tsx. */
export type PageTint = 'home' | 'leaderboard' | 'stats' | 'friends' | 'vs';

/**
 * Each tint's soft diagonal gradient (top-left → bottom-right, 3 stops) in
 * light and dark, and the accent its cards' shadows lean toward.
 */
export const PAGE_TINTS: Record<PageTint, {
  light: readonly [string, string, string];
  dark: readonly [string, string, string];
  accent: string;
}> = {
  home: { light: ['#F3EEFF', '#FBEFFF', '#FFF1F7'], dark: ['#160F26', '#1C1231', '#22122C'], accent: '#7c3aed' },
  leaderboard: { light: ['#FFF8E6', '#FFEFD2', '#FDE9F2'], dark: ['#1E1608', '#23160D', '#241221'], accent: '#f59e0b' },
  stats: { light: ['#EEF4FF', '#EEEBFF', '#F4EEFF'], dark: ['#0E1530', '#141433', '#1A1233'], accent: '#2563eb' },
  friends: { light: ['#FFF0F7', '#FCE7F3', '#F3E8FF'], dark: ['#241024', '#22102A', '#1A1030'], accent: '#ec4899' },
  vs: { light: ['#E9FBF8', '#ECF6FF', '#F1EEFF'], dark: ['#08201E', '#0E1A2A', '#15142B'], accent: '#0d9488' },
};

/**
 * The tile pattern (v2, §18.1): its opacity is baked into the file, drawn at
 * 100% in light and 60% in dark, 360 CSS px per 720 px tile. Pages draw the
 * wallpapers now (§19.1); the share cards (lib/share-image.ts) still tile it.
 */
export const PAGE_TILES = { name: 'art-bg-tiles', size: 360, opacity: { light: 1, dark: 0.6 } } as const;

// ── Wallpapers (§19.1) ──────────────────────────────────────────────────────

/** A page tint's wallpaper: Home tint pages `art-wall-home`, Leaderboard + Records `art-wall-leaderboard`, … */
export function pageWall(tint: PageTint): WallArtName {
  return `art-wall-${tint}`;
}

/** A solo game screen's wallpaper by db key (DUEL, QUORDLE, SCRAMBLE, …), or null (VS, Sweep, unknown). */
export function gameWallForDbKey(dbKey: string | null | undefined): WallArtName | null {
  const art = gameTitleArtForDbKey(dbKey);
  return art ? (`art-wall-game-${art.slice('art-game-'.length)}` as WallArtName) : null;
}

/**
 * The overlays on a wallpaper (§19.1), a flat `color` layer over the fixed,
 * cover-fit image: dark mode 58% (game screens 62%); Reduce transparency /
 * more contrast keeps the wallpaper but lays 20% white (light) / 70% `color`
 * (dark) over it so text on the page stays legible.
 */
export const WALL_OVERLAY = {
  color: '#120D1F',
  dark: 0.58,
  darkGame: 0.62,
  a11yLight: 0.2,
  a11yDark: 0.7,
} as const;

/** A card's shadow on a tinted page: the tint's accent at 11% alpha, blur 14, y 5. */
export function pageCardShadow(tint: PageTint): string {
  return accentCardShadow(PAGE_TINTS[tint].accent);
}

/** A card's shadow leaning toward any accent (#rrggbb) at 11% alpha, blur 14, y 5. */
export function accentCardShadow(accentHex: string): string {
  const [r, g, b] = hexRgb(accentHex);
  return `0 5px 14px rgba(${r},${g},${b},0.11)`;
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** `accent` at `alpha` laid over the opaque `base`, as #RRGGBB. */
export function mixOver(accentHex: string, alpha: number, baseHex: string): string {
  const a = hexRgb(accentHex);
  const b = hexRgb(baseHex);
  return `#${a.map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

// ── Game screens: a soft tint in the game's color (§15) ─────────────────────

/** A page background's gradient stops (light + dark) and the accent its card shadows lean toward. */
export interface TintStops {
  light: readonly [string, string, string];
  dark: readonly [string, string, string];
  accent: string;
}

/**
 * A game's tint (§15), made from its accent: light = accent at 6% over white,
 * 10% over white, 4% over #FFF7FB; dark = accent at 10% / 14% / 8% over #120D1F.
 */
export function gameTint(accentHex: string): TintStops {
  return {
    light: [mixOver(accentHex, 0.06, '#FFFFFF'), mixOver(accentHex, 0.1, '#FFFFFF'), mixOver(accentHex, 0.04, '#FFF7FB')],
    dark: [mixOver(accentHex, 0.1, '#120D1F'), mixOver(accentHex, 0.14, '#120D1F'), mixOver(accentHex, 0.08, '#120D1F')],
    accent: accentHex,
  };
}

/** A solo game's tint by its db key (DUEL, QUORDLE, SCRAMBLE, …), or null when unknown. */
export function gameTintForDbKey(dbKey: string | null | undefined): TintStops | null {
  const accent = dbKey ? MODE_BY_DBKEY[dbKey]?.accentHex : null;
  return accent ? gameTint(accent) : null;
}

/** Game share cards draw the tile pattern quieter than menus (§15, v2 §18.1): 55% light, 35% dark. */
export const GAME_TILES_OPACITY = { light: 0.55, dark: 0.35 } as const;

// ── Title art motion (§16) ──────────────────────────────────────────────────

/**
 * How a title art animates when its page appears (§16): page titles
 * (art-title-*) and day titles (art-day-*) pop in (scale 0.94 → 1.03 → 1,
 * fade in, 420 ms) then float forever (0 → −2 px → 0 over 4 s); game title art
 * (art-game-*) only pops in (no float in game headers during play); everything
 * else (moments, scenes) is left alone. Reduce Motion (OS or the in-app
 * toggle) turns both off in globals.css.
 */
export type ArtMotion = 'float' | 'pop' | 'none';
export function artMotion(name: string): ArtMotion {
  if (name.startsWith('art-title-') || name.startsWith('art-day-')) return 'float';
  if (name.startsWith('art-game-')) return 'pop';
  return 'none';
}

/**
 * The shadow a card on a tinted page draws (`boxShadow`), read from the
 * PageBackground it sits in; outside one it falls back to `fallback`.
 */
export function onPageShadow(fallback = 'none'): string {
  return `var(--page-card-shadow, ${fallback})`;
}
