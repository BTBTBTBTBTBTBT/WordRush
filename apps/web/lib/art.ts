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
  | 'art-title-moregames'
  // Second pass (§8): WELCOME! on the sign-in / signed-out landing, and the
  // LEADERBOARD title holidays show over their HEROES text.
  | 'art-title-welcome'
  | 'art-title-leaderboard';

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

export type ArtName = DayArtName | TitleArtName | MomentArtName | SceneArtName;

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
  'art-title-welcome': [1080, 197],
  'art-title-leaderboard': [1080, 212],
  'art-moment-victory': [880, 180],
  'art-moment-soclose': [899, 179],
  'art-moment-sweep': [609, 150],
  'art-moment-flawless': [826, 149],
  'art-moment-youwin': [789, 157],
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
