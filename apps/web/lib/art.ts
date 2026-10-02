// The art pass (founder, 2026-10-02; docs/ART_SPEC.md): one table of the
// shipped art in public/art/ with each file's real pixel size, so every <img>
// gets an explicit width/height (no layout shift) and is sized by width with
// the true aspect ratio (never stretched). iOS image sets and Android
// drawable-nodpi carry the same names (docs/design/brand/ship-art.py).

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
  | 'art-title-gopro'
  | 'art-title-moregames';

export type ArtName = DayArtName | TitleArtName;

/** Real pixel sizes of public/art/<name>.webp (width, height). */
export const ART_SIZE: Record<ArtName, readonly [number, number]> = {
  'art-day-sunday': [900, 540],
  'art-day-monday': [900, 692],
  'art-day-tuesday': [900, 540],
  'art-day-wednesday': [900, 750],
  'art-day-thursday': [900, 482],
  'art-day-friday': [900, 591],
  'art-day-saturday': [898, 502],
  'art-title-friends': [1025, 249],
  'art-title-stats': [1080, 247],
  'art-title-records': [1080, 159],
  'art-title-vs': [1053, 180],
  'art-title-puzzles': [1080, 211],
  'art-title-wotd': [1080, 175],
  'art-title-settings': [1080, 201],
  'art-title-howto': [1080, 195],
  'art-title-gopro': [1080, 217],
  'art-title-moregames': [1080, 215],
};

/** Public path of a title / day / game / icon art file. */
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
