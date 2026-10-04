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

/** Page titles (§2): the founder-approved cast-color lettering (art-titlecast-*, 10-03), plus the VS share title. */
export type TitleArtName =
  | 'art-titlecast-friends'
  | 'art-titlecast-stats'
  | 'art-titlecast-records'
  | 'art-title-vs'
  | 'art-titlecast-puzzles'
  | 'art-titlecast-wotd'
  | 'art-titlecast-settings'
  | 'art-titlecast-howto'
  | 'art-titlecast-guides'
  | 'art-titlecast-strategy'
  | 'art-titlecast-words'
  | 'art-titlecast-faq'
  | 'art-titlecast-privacy'
  | 'art-titlecast-terms'
  | 'art-titlecast-gopro'
  | 'art-titlecast-moregames'
  // Second pass (§8): WELCOME! on the sign-in / signed-out landing, and the
  // LEADERBOARD title holidays show over their HEROES text.
  | 'art-titlecast-welcome'
  | 'art-titlecast-leaderboard'
  // §12: the Home section header above the daily games (§19.2: reads just DAILIES).
  | 'art-titlecast-dailies'
  // FINISH_SPEC O1: the Home VS BATTLE section title (lettering only).
  | 'art-titlecast-vsbattle'
  // FINISH_SPEC AS1 (night art 10-03): the ? menu sheet's MENU title.
  | 'art-titlecast-menu';

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
  | 'd-nostats'
  // celebration + popup art (OpenAI API, FINISH_SPEC §G)
  | 'pro-crown'
  | 'shield-guard'
  | 'flawless-star'
  | 'sweep-broom'
  | 'banner-sweep'
  | 'banner-flawless'
  // VS lobby hero banner and the ladder-cleared celebration (FINISH_SPEC D)
  | 'vs-faceoff'
  | 'ladder-cleared'
  // Gauntlet finish screen (FINISH_SPEC Q): S on the gold staircase with the trophy, D cheering
  | 'gauntlet-champion'
  // Unlimited (FINISH_SPEC R3): U floating with a loop of candy tiles orbiting her
  | 'unlimited-loop'
  // Friends invites + gifts (FINISH_SPEC T)
  | 'friends-match'
  | 'invite-sent'
  | 'gift-pro'
  // First-run onboarding (FINISH_SPEC W)
  | 'onboard-tiles'
  | 'onboard-score'
  // Night art 10-03: achievement unlocked (BF2: C + O1 presenting an empty pedestal — the badge goes on top),
  // first-run WELCOME (all ten waving) + ALL SET (all ten cheering, an empty spot for the player's mascot),
  // the Halloween Home banner (FINISH_SPEC X).
  | 'achievement'
  | 'welcome-cast'
  | 'all-set'
  | 'banner-halloween';
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

/**
 * Cast poses (finishing build, docs/FINISH_SPEC.md A7 / C5): single-character
 * pose images, 320 px square, transparent, `art-pose-<cast id>-<pose>`. Used
 * for secondary spots (popups, share footers, empty states) so a screen never
 * repeats the same character in the same image as its host.
 */
export const POSE_ART = {
  w: ['cheer', 'fly', 'goodgame', 'hips', 'lean', 'point', 'proud', 'ready', 'sit', 'victory', 'waiting', 'wave'],
  o1: ['cartwheel', 'cheer', 'goodgame', 'hug', 'jump', 'lean', 'ready', 'sit', 'victory', 'waiting'],
  r: ['cheer', 'cocoa', 'goodgame', 'lean', 'ready', 'sit', 'sleepwalk', 'victory', 'waiting', 'wake'],
  d: ['cheer', 'eureka', 'goodgame', 'lean', 'notes', 'ready', 'sit', 'skeptic', 'victory', 'waiting'],
  o2: ['cheer', 'gasp', 'goodgame', 'lean', 'ready', 'sit', 'strut', 'twirl', 'victory', 'waiting'],
  c: ['backpack', 'cheer', 'goodgame', 'lean', 'map', 'ready', 'sit', 'telescope', 'victory', 'waiting'],
  i: ['cheer', 'giggle', 'goodgame', 'lean', 'reach', 'ready', 'sit', 'victory', 'waiting', 'water'],
  o3: ['cushion', 'goodgame', 'handstand', 'laugh', 'mustache', 'ready', 'sit', 'sneak', 'victory', 'waiting'],
  u: ['goodgame', 'lotus', 'meditate', 'ready', 'spin', 'stretch', 'tea', 'upside', 'victory', 'waiting'],
  s: ['blocks', 'flex', 'goodgame', 'ready', 'sit', 'slide', 'stopwatch', 'trophy', 'victory', 'waiting'],
} as const;
type PoseTable = typeof POSE_ART;
export type PoseCastId = keyof PoseTable;
export type PoseArtName = { [K in PoseCastId]: `art-pose-${K}-${PoseTable[K][number]}` }[PoseCastId];
/** Every pose's art name, in table order. */
export const POSE_ART_NAMES: readonly PoseArtName[] = (Object.keys(POSE_ART) as PoseCastId[])
  .flatMap((id) => POSE_ART[id].map((pose) => `art-pose-${id}-${pose}` as PoseArtName));
/** Pose files are 320 px square. */
export const POSE_SIZE = 320;

/** A pose's art name, e.g. poseArt('s', 'trophy') → 'art-pose-s-trophy'. */
export function poseArt<K extends PoseCastId>(id: K, pose: PoseTable[K][number]): PoseArtName {
  return `art-pose-${id}-${pose}` as PoseArtName;
}

/** Public path of a pose image, e.g. poseSrc('u', 'lotus') → /art/art-pose-u-lotus.webp. */
export function poseSrc<K extends PoseCastId>(id: K, pose: PoseTable[K][number]): string {
  return artSrc(poseArt(id, pose));
}

/**
 * Starsweep pieces (FINISH_SPEC H): glossy candy star / cross images, 256 px
 * square, transparent — a placed (unchecked) star, a right star, a wrong star
 * and the lilac X — drawn at ~78% of a board cell in place of the ★ / × glyphs.
 */
export const STARSWEEP_PIECES = ['star-placed', 'star-correct', 'star-wrong', 'cross'] as const;
export type StarsweepPiece = (typeof STARSWEEP_PIECES)[number];
export type StarsweepArtName = `art-starsweep-${StarsweepPiece}`;

/** Public path of a Starsweep piece, e.g. starsweepSrc('cross') → /art/art-starsweep-cross.webp. */
export function starsweepSrc(piece: StarsweepPiece): string {
  return artSrc(`art-starsweep-${piece}`);
}

/**
 * Muddle coins (FINISH_SPEC I): glossy blank coins, 256 px square,
 * transparent; the letter is drawn on top in code. Empty = a gold ring (over
 * a frosted cell), filled = purple with a gold rim, hint = violet + sparkle,
 * punchline = gold (the punchline tray).
 */
export const MUDDLE_COINS = ['empty', 'filled', 'hint', 'punchline'] as const;
export type MuddleCoin = (typeof MUDDLE_COINS)[number];
export type MuddleCoinArtName = `art-muddle-coin-${MuddleCoin}`;

/** Public path of a Muddle coin, e.g. muddleCoinSrc('filled') → /art/art-muddle-coin-filled.webp. */
export function muddleCoinSrc(coin: MuddleCoin): string {
  return artSrc(`art-muddle-coin-${coin}`);
}

/**
 * Game pieces (FINISH_SPEC J): glossy blank pieces, 256 px square,
 * transparent — Hubbub's lilac hexagon and gold center hexagon (the letter is
 * drawn on top in code), Tic-Tac-Tile's purple X and pink O.
 */
export const GAME_PIECES = ['hex', 'hex-center', 'ttt-x', 'ttt-o'] as const;
export type GamePiece = (typeof GAME_PIECES)[number];
export type GamePieceArtName = `art-piece-${GamePiece}`;

/** Public path of a game piece, e.g. pieceSrc('hex-center') → /art/art-piece-hex-center.webp. */
export function pieceSrc(piece: GamePiece): string {
  return artSrc(`art-piece-${piece}`);
}

/** Medals (Stats Daily Medals, the ladder trophy): glossy 3D, 256 px square, transparent. */
export const MEDALS = ['gold', 'silver', 'bronze', 'trophy'] as const;
export type Medal = (typeof MEDALS)[number];
export type MedalArtName = `art-medal-${Medal}`;

/** Public path of a medal, e.g. medalSrc('gold') → /art/art-medal-gold.webp. */
export function medalSrc(medal: Medal): string {
  return artSrc(`art-medal-${medal}`);
}

/**
 * 3D badges (FINISH_SPEC V, AA): achievement icons (one per achievement-service
 * `icon` key), the level tiers + the Pro member mark, and the small gold crown
 * sprite Pro members wear. 256 px square, transparent.
 */
export const ACHIEVEMENT_BADGES = ['calendar', 'crown', 'flame', 'grid', 'group', 'key-round', 'medal', 'quote', 'shuffle', 'sparkles', 'star', 'swords', 'target', 'trending-up', 'trophy', 'zap'] as const;
export const LEVEL_BADGES = ['level-bronze', 'level-diamond', 'level-gold', 'level-platinum', 'level-pro', 'level-silver'] as const;
export type BadgeName = (typeof ACHIEVEMENT_BADGES)[number] | (typeof LEVEL_BADGES)[number] | 'pro-crown-sprite' | 'icon-star-sprite' | 'icon-zap-sprite' | 'icon-clock-sprite';
export type BadgeArtName = `art-badge-${BadgeName}`;

/** Public path of a badge, e.g. badgeSrc('flame') → /art/art-badge-flame.webp. */
export function badgeSrc(name: BadgeName): string {
  return artSrc(`art-badge-${name}`);
}

/**
 * Halloween cast skins (FINISH_SPEC X): one per cast member, 320 px square,
 * the same framing as the cast poses; they replace the hero cast during the
 * season (core currentSeason).
 */
export type HalloweenArtName = `art-halloween-${PoseCastId}`;

/** Public path of a cast member's Halloween skin. */
export function halloweenSrc(id: PoseCastId): string {
  return artSrc(`art-halloween-${id}`);
}

/**
 * Night art 2026-10-03 (docs/design/brand/NIGHT-ART-2026-10-03.md): a badge per achievement (art-ach-<key>, 256²),
 * the avatar maker parts (art-av-*, fixed canvases — see packages/core/src/avatar-parts.json), friend reactions,
 * rounded-square avatar frames, Halloween props, the Gauntlet header + stage medallions, the candy toggle sprites,
 * the podium pedestals + floor plate (docs/design/brand/podium/make-pedestals.py), and the cast-color titles
 * (art-titlecast-*) + three-slice button skins (art-btn-<color>-<s|m|l>[-pressed][-dark], caps = height / 2).
 */
export type NightArtName =
  | `art-ach-${string}`
  | `art-av-${string}`
  | `art-react-${'clap' | 'fire' | 'wow' | 'grr' | 'rematch' | 'heart'}`
  | `art-frame-${'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'}`
  | `art-halloween-prop-${'pumpkin' | 'bat' | 'candy' | 'ghost'}`
  | 'art-gauntlet-header'
  | `art-gauntlet-medal-${'locked' | 'current' | 'cleared'}`
  | `art-toggle-${'light' | 'dark'}-${'track' | 'switch' | 'thumb-on' | 'thumb-off' | 'knob' | 'switch-on'}`
  | `art-podium-${1 | 2 | 3}${'' | '-plain'}`
  | 'art-podium-floor'
  | `art-titlecast-${string}`
  | `art-btn-${string}`
  | `art-btnlabel-${string}`;

export type ArtName = DayArtName | TitleArtName | MomentArtName | SceneArtName | GameTitleArtName | BackgroundArtName | WallArtName | PoseArtName | StarsweepArtName | MuddleCoinArtName | GamePieceArtName | MedalArtName | BadgeArtName | HalloweenArtName | NightArtName;

/** Real pixel sizes of public/art/<name>.webp (width, height). */
export const ART_SIZE: Record<ArtName, readonly [number, number]> = {
  'art-day-sunday': [900, 540],
  'art-day-monday': [900, 861],
  'art-day-tuesday': [900, 540],
  'art-day-wednesday': [900, 840],
  'art-day-thursday': [879, 482],
  'art-day-friday': [853, 591],
  'art-day-saturday': [898, 502],
  'art-title-vs': [572, 95],
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
  'art-scene-pro-crown': [746, 939],
  'art-scene-shield-guard': [894, 775],
  'art-scene-flawless-star': [796, 914],
  'art-scene-sweep-broom': [900, 807],
  'art-scene-banner-sweep': [1200, 734],
  'art-scene-banner-flawless': [1200, 774],
  'art-game-practice': [1200, 305],
  'art-game-gauntlet': [1200, 273],
  'art-game-quordle': [1200, 275],
  'art-game-octordle': [1200, 255],
  'art-game-sequence': [1200, 290],
  'art-game-rescue': [1200, 254],
  'art-game-six': [1200, 268],
  'art-game-seven': [1200, 239],
  'art-game-propernoundle': [1200, 210],
  'art-game-sudoku': [1200, 436],
  'art-game-scramble': [1200, 329],
  'art-game-hub': [1200, 325],
  'art-game-crossword': [1200, 302],
  'art-game-groups': [1200, 321],
  'art-game-ladder': [1200, 252],
  'art-game-cryptogram': [1200, 237],
  'art-game-wordsearch': [1200, 314],
  'art-game-regions': [1200, 271],
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
  // FINISH_SPEC H: the Starsweep pieces, 256 px square.
  'art-starsweep-star-placed': [256, 256],
  'art-starsweep-star-correct': [256, 256],
  'art-starsweep-star-wrong': [256, 256],
  'art-starsweep-cross': [256, 256],
  // FINISH_SPEC I: the Muddle coins, 256 px square.
  'art-muddle-coin-empty': [256, 256],
  'art-muddle-coin-filled': [256, 256],
  'art-muddle-coin-hint': [256, 256],
  'art-muddle-coin-punchline': [256, 256],
  'art-scene-vs-faceoff': [1200, 638],
  'art-scene-ladder-cleared': [875, 926],
  'art-scene-gauntlet-champion': [1200, 815],
  'art-scene-unlimited-loop': [900, 759],
  'art-scene-friends-match': [1200, 832],
  'art-scene-invite-sent': [802, 870],
  'art-scene-gift-pro': [900, 755],
  'art-medal-gold': [256, 256],
  'art-medal-silver': [256, 256],
  'art-medal-bronze': [256, 256],
  'art-medal-trophy': [256, 256],
  // FINISH_SPEC V / AA badges, X Halloween skins, W onboarding scenes.
  'art-badge-calendar': [256, 256],
  'art-badge-crown': [256, 256],
  'art-badge-flame': [256, 256],
  'art-badge-grid': [256, 256],
  'art-badge-group': [256, 256],
  'art-badge-key-round': [256, 256],
  'art-badge-level-bronze': [256, 256],
  'art-badge-level-diamond': [256, 256],
  'art-badge-level-gold': [256, 256],
  'art-badge-level-platinum': [256, 256],
  'art-badge-level-pro': [256, 256],
  'art-badge-level-silver': [256, 256],
  'art-badge-medal': [256, 256],
  'art-badge-pro-crown-sprite': [256, 256],
  // FINISH_SPEC AL addendum 2: chip icons (points star, speed bolt).
  'art-badge-icon-star-sprite': [256, 256],
  'art-badge-icon-zap-sprite': [256, 256],
  'art-badge-quote': [256, 256],
  'art-badge-shuffle': [256, 256],
  'art-badge-sparkles': [256, 256],
  'art-badge-star': [256, 256],
  'art-badge-swords': [256, 256],
  'art-badge-target': [256, 256],
  'art-badge-trending-up': [256, 256],
  'art-badge-trophy': [256, 256],
  'art-badge-zap': [256, 256],
  'art-halloween-w': [320, 320],
  'art-halloween-o1': [320, 320],
  'art-halloween-r': [320, 320],
  'art-halloween-d': [320, 320],
  'art-halloween-o2': [320, 320],
  'art-halloween-c': [320, 320],
  'art-halloween-i': [320, 320],
  'art-halloween-o3': [320, 320],
  'art-halloween-u': [320, 320],
  'art-halloween-s': [320, 320],
  'art-scene-onboard-tiles': [1200, 565],
  'art-scene-onboard-score': [900, 809],
  // FINISH_SPEC J: game pieces, 256 px square.
  'art-piece-hex': [256, 256],
  'art-piece-hex-center': [256, 256],
  'art-piece-ttt-x': [256, 256],
  'art-piece-ttt-o': [256, 256],
  // Finishing build: the 62 cast poses, all 320 px square.
  ...(Object.fromEntries(POSE_ART_NAMES.map((n) => [n, [POSE_SIZE, POSE_SIZE] as const])) as Record<PoseArtName, readonly [number, number]>),
  // night art 2026-10-03
  'art-ach-all_modes': [256, 256],
  'art-ach-best_buds': [256, 256],
  'art-ach-blitz': [256, 256],
  'art-ach-boss_battle': [256, 256],
  'art-ach-called_it': [256, 256],
  'art-ach-centurion': [256, 256],
  'art-ach-century_club': [256, 256],
  'art-ach-chain_reaction': [256, 256],
  'art-ach-cheerleader': [256, 256],
  'art-ach-classic_master': [256, 256],
  'art-ach-close_call': [256, 256],
  'art-ach-code_cracker': [256, 256],
  'art-ach-crossword_first': [256, 256],
  'art-ach-crossword_regular': [256, 256],
  'art-ach-cryptogram_first': [256, 256],
  'art-ach-daily_debut': [256, 256],
  'art-ach-daily_devotee': [256, 256],
  'art-ach-daily_duelist': [256, 256],
  'art-ach-daily_regular': [256, 256],
  'art-ach-daily_sweep': [256, 256],
  'art-ach-dedicated': [256, 256],
  'art-ach-diamond_hands': [256, 256],
  'art-ach-dominant': [256, 256],
  'art-ach-dress_up': [256, 256],
  'art-ach-eagle_eye': [256, 256],
  'art-ach-early_bird': [256, 256],
  'art-ach-elite': [256, 256],
  'art-ach-endurance': [256, 256],
  'art-ach-extended_vocab': [256, 256],
  'art-ach-first_win': [256, 256],
  'art-ach-flawless_10': [256, 256],
  'art-ach-flawless_25': [256, 256],
  'art-ach-flawless_5': [256, 256],
  'art-ach-flawless_speed': [256, 256],
  'art-ach-flawless_streak': [256, 256],
  'art-ach-flawless_streak_5': [256, 256],
  'art-ach-flawless_victory': [256, 256],
  'art-ach-gauntlet_god': [256, 256],
  'art-ach-gauntlet_master': [256, 256],
  'art-ach-gold_rush': [256, 256],
  'art-ach-golden_touch': [256, 256],
  'art-ach-grand_sweep': [256, 256],
  'art-ach-groups_first': [256, 256],
  'art-ach-halfway_hero': [256, 256],
  'art-ach-hat_trick': [256, 256],
  'art-ach-hive_mind': [256, 256],
  'art-ach-hub_first': [256, 256],
  'art-ach-iron_will': [256, 256],
  'art-ach-kindred_regular': [256, 256],
  'art-ach-kindred_spirit': [256, 256],
  'art-ach-ladder_climber': [256, 256],
  'art-ach-lightning_round': [256, 256],
  'art-ach-linguist': [256, 256],
  'art-ach-lucky_seven': [256, 256],
  'art-ach-marathon_runner': [256, 256],
  'art-ach-medal_10': [256, 256],
  'art-ach-medal_50': [256, 256],
  'art-ach-medal_wall': [256, 256],
  'art-ach-meet_the_cast': [256, 256],
  'art-ach-muddle_master': [256, 256],
  'art-ach-night_owl': [256, 256],
  'art-ach-no_sweat': [256, 256],
  'art-ach-obsessed': [256, 256],
  'art-ach-octo_boss': [256, 256],
  'art-ach-pangram_hunter': [256, 256],
  'art-ach-perfect_constellation': [256, 256],
  'art-ach-perfectionist': [256, 256],
  'art-ach-pocket_pro': [256, 256],
  'art-ach-proper_scholar': [256, 256],
  'art-ach-punchline_pro': [256, 256],
  'art-ach-puzzle_sweep': [256, 256],
  'art-ach-puzzle_week': [256, 256],
  'art-ach-quad_king': [256, 256],
  'art-ach-quick_draw': [256, 256],
  'art-ach-race_day': [256, 256],
  'art-ach-regions_first': [256, 256],
  'art-ach-rescue_hero': [256, 256],
  'art-ach-ride_or_die': [256, 256],
  'art-ach-rising_star': [256, 256],
  'art-ach-rival': [256, 256],
  'art-ach-rock_solid': [256, 256],
  'art-ach-self_portrait': [256, 256],
  'art-ach-sequence_ace': [256, 256],
  'art-ach-sharp_spotter': [256, 256],
  'art-ach-sharpshooter': [256, 256],
  'art-ach-six_shooter': [256, 256],
  'art-ach-speed_demon': [256, 256],
  'art-ach-speed_sweep': [256, 256],
  'art-ach-spooky_season': [256, 256],
  'art-ach-spooky_speller': [256, 256],
  'art-ach-squad_goals': [256, 256],
  'art-ach-starstruck': [256, 256],
  'art-ach-streak_14': [256, 256],
  'art-ach-streak_30': [256, 256],
  'art-ach-streak_7': [256, 256],
  'art-ach-streak_master': [256, 256],
  'art-ach-sudoku_first': [256, 256],
  'art-ach-sudoku_scholar': [256, 256],
  'art-ach-sweep_streak_60': [256, 256],
  'art-ach-sweep_streak_7': [256, 256],
  'art-ach-team_player': [256, 256],
  'art-ach-the_natural': [256, 256],
  'art-ach-thousand_words': [256, 256],
  'art-ach-three_in_a_row': [256, 256],
  'art-ach-triple_threat': [256, 256],
  'art-ach-unbreakable': [256, 256],
  'art-ach-under_par': [256, 256],
  'art-ach-unstoppable': [256, 256],
  'art-ach-untouchable': [256, 256],
  'art-ach-versatile_victor': [256, 256],
  'art-ach-vs_centurion': [256, 256],
  'art-ach-vs_marathoner': [256, 256],
  'art-ach-vs_veteran': [256, 256],
  'art-ach-wake_up_call': [256, 256],
  'art-ach-wordsearch_first': [256, 256],
  'art-ach-wordsmith': [256, 256],
  'art-ach-year_one': [256, 256],
  'art-av-acc-astronaut': [384, 335],
  'art-av-acc-backpack': [640, 599],
  'art-av-acc-beanie': [384, 342],
  'art-av-acc-bearears': [384, 221],
  'art-av-acc-beret': [384, 240],
  'art-av-acc-bigbow': [384, 236],
  'art-av-acc-bow': [384, 237],
  'art-av-acc-bowtie': [384, 236],
  'art-av-acc-bubbletea': [263, 384],
  'art-av-acc-bucket': [384, 247],
  'art-av-acc-bunnyears': [375, 384],
  'art-av-acc-cap': [384, 257],
  'art-av-acc-cape': [640, 390],
  'art-av-acc-catears': [384, 257],
  'art-av-acc-chain': [384, 313],
  'art-av-acc-chef': [384, 353],
  'art-av-acc-cowboy': [384, 214],
  'art-av-acc-crown': [384, 324],
  'art-av-acc-curlymustache': [384, 141],
  'art-av-acc-eyepatch': [384, 175],
  'art-av-acc-facepaint': [384, 111],
  'art-av-acc-fairywings': [640, 474],
  'art-av-acc-flower': [384, 363],
  'art-av-acc-flowercrown': [384, 166],
  'art-av-acc-grad': [384, 264],
  'art-av-acc-guitar': [640, 555],
  'art-av-acc-halo': [384, 151],
  'art-av-acc-headphones': [384, 290],
  'art-av-acc-heart-glasses': [384, 149],
  'art-av-acc-mask': [384, 174],
  'art-av-acc-medal': [342, 384],
  'art-av-acc-minicrown': [384, 297],
  'art-av-acc-mohawk': [384, 322],
  'art-av-acc-monocle': [360, 384],
  'art-av-acc-mustache': [384, 126],
  'art-av-acc-nightcap': [384, 284],
  'art-av-acc-party': [311, 384],
  'art-av-acc-pirate': [384, 226],
  'art-av-acc-pombeanie': [384, 338],
  'art-av-acc-propeller': [384, 337],
  'art-av-acc-roundglasses': [384, 170],
  'art-av-acc-santa': [384, 281],
  'art-av-acc-scarf': [384, 323],
  'art-av-acc-sprout': [384, 264],
  'art-av-acc-starglasses': [384, 173],
  'art-av-acc-supercape': [640, 355],
  'art-av-acc-sweatband': [384, 156],
  'art-av-acc-tiara': [384, 236],
  'art-av-acc-tophat': [384, 284],
  'art-av-acc-viking': [384, 248],
  'art-av-acc-wings': [640, 341],
  'art-av-acc-witch': [384, 309],
  'art-av-acc-wizard': [384, 320],
  'art-av-body-bean': [640, 640],
  'art-av-body-blob': [640, 640],
  'art-av-body-chunky': [640, 640],
  'art-av-body-classic': [640, 640],
  'art-av-body-cloud': [640, 640],
  'art-av-body-drop': [640, 640],
  'art-av-body-hex': [640, 640],
  'art-av-body-mini': [640, 640],
  'art-av-body-pear': [640, 640],
  'art-av-body-star': [640, 640],
  'art-av-body-tall': [640, 640],
  'art-av-body-wide': [640, 640],
  'art-av-cheeks-bandage': [384, 262],
  'art-av-cheeks-blush': [384, 103],
  'art-av-cheeks-freckles': [384, 82],
  'art-av-cheeks-hearts': [384, 117],
  'art-av-cheeks-sparkle': [384, 121],
  'art-av-cheeks-starfreckles': [384, 172],
  'art-av-eyes-anime': [384, 193],
  'art-av-eyes-beady': [384, 128],
  'art-av-eyes-biground': [384, 193],
  'art-av-eyes-cyclops': [384, 384],
  'art-av-eyes-determined': [384, 167],
  'art-av-eyes-dizzy': [384, 198],
  'art-av-eyes-droopy': [384, 183],
  'art-av-eyes-glasses': [384, 170],
  'art-av-eyes-happy': [384, 111],
  'art-av-eyes-hearts': [384, 157],
  'art-av-eyes-joy': [384, 95],
  'art-av-eyes-sideglance': [384, 183],
  'art-av-eyes-sleepy': [384, 147],
  'art-av-eyes-sparkly': [384, 166],
  'art-av-eyes-stars': [384, 190],
  'art-av-eyes-sunglasses': [384, 143],
  'art-av-eyes-wink': [384, 133],
  'art-av-mouth-braces': [384, 203],
  'art-av-mouth-cat': [384, 144],
  'art-av-mouth-fang': [384, 166],
  'art-av-mouth-gasp': [320, 384],
  'art-av-mouth-grin': [384, 212],
  'art-av-mouth-kissy': [384, 334],
  'art-av-mouth-laugh': [384, 241],
  'art-av-mouth-o': [355, 384],
  'art-av-mouth-oops': [384, 366],
  'art-av-mouth-smile': [384, 153],
  'art-av-mouth-smirk': [384, 180],
  'art-av-mouth-teeth': [384, 185],
  'art-av-mouth-tiny': [384, 194],
  'art-av-mouth-tongue': [384, 270],
  'art-av-mouth-tongueside': [384, 197],
  'art-av-mouth-toothy': [384, 181],
  'art-av-mouth-whistle': [384, 356],
  'art-av-nose-bignose': [384, 368],
  'art-av-nose-button': [384, 294],
  'art-av-nose-cat': [384, 270],
  'art-av-nose-clownstar': [384, 356],
  'art-av-nose-piggy': [384, 289],
  'art-av-nose-pointy': [384, 257],
  'art-av-nose-red': [384, 382],
  'art-podium-1': [300, 261],
  'art-podium-1-plain': [300, 261],
  'art-podium-2': [300, 200],
  'art-podium-2-plain': [300, 200],
  'art-podium-3': [300, 159],
  'art-podium-3-plain': [300, 159],
  'art-podium-floor': [1080, 184],
  // Cast-color titles + button skins (founder 10-03; not wired yet — the menu mapping is pending)
  'art-titlecast-about': [683, 208],
  'art-titlecast-achievement': [947, 262],
  'art-titlecast-alreadyplayed': [1080, 117],
  'art-titlecast-archetypes': [1052, 164],
  'art-titlecast-bots': [951, 389],
  'art-titlecast-challenge': [901, 191],
  'art-titlecast-dailies': [894, 260],
  'art-titlecast-dailychallenge': [1080, 128],
  'art-titlecast-deleteaccount': [910, 156],
  'art-titlecast-editprofile': [907, 160],
  'art-titlecast-faq': [573, 276],
  'art-titlecast-findingrival': [1080, 167],
  'art-titlecast-freeweek': [1080, 125],
  'art-titlecast-friends': [921, 257],
  'art-titlecast-gauntletcleared': [1080, 117],
  'art-titlecast-giftpro': [1080, 120],
  'art-titlecast-gopro': [823, 256],
  'art-titlecast-guides': [816, 254],
  'art-titlecast-h2h': [953, 204],
  'art-titlecast-howto': [947, 225],
  'art-titlecast-invite': [1080, 139],
  'art-titlecast-invited': [990, 160],
  'art-titlecast-invitesent': [1080, 182],
  'art-titlecast-jointhefun': [1080, 201],
  'art-titlecast-laddercleared': [1080, 116],
  'art-titlecast-leaderboard': [974, 242],
  'art-titlecast-letsplay': [785, 136],
  'art-titlecast-levelup': [1080, 293],
  'art-titlecast-makeprofile': [1080, 134],
  'art-titlecast-mascot': [1080, 106],
  'art-titlecast-matchfound': [1080, 182],
  'art-titlecast-menu': [719, 261],
  'art-titlecast-moregames': [956, 247],
  'art-titlecast-newfriends': [1080, 168],
  'art-titlecast-newpassword': [1080, 149],
  'art-titlecast-notfound': [936, 158],
  'art-titlecast-nottoday': [1020, 198],
  'art-titlecast-nudge': [760, 197],
  'art-titlecast-onastreak': [1080, 184],
  'art-titlecast-oops': [599, 167],
  'art-titlecast-overview': [975, 204],
  'art-titlecast-pick-friend': [1080, 185],
  'art-titlecast-playedtoday': [916, 161],
  'art-titlecast-pocket-chain': [1080, 202],
  'art-titlecast-pocket-coin': [735, 268],
  'art-titlecast-pocket-ghost': [842, 250],
  'art-titlecast-pocket-pass': [989, 230],
  'art-titlecast-pocket-rps': [993, 228],
  'art-titlecast-pocket-ttt': [983, 267],
  'art-titlecast-podium': [654, 188],
  'art-titlecast-privacy': [866, 257],
  'art-titlecast-privatematch': [1080, 130],
  'art-titlecast-profile': [758, 190],
  'art-titlecast-properk': [886, 187],
  'art-titlecast-prounlocked': [958, 165],
  'art-titlecast-puzzles': [909, 251],
  'art-titlecast-records': [976, 247],
  'art-titlecast-resetpassword': [1080, 159],
  'art-titlecast-rotate': [1080, 96],
  'art-titlecast-savestreak': [1080, 133],
  'art-titlecast-settings': [943, 265],
  'art-titlecast-share': [661, 190],
  'art-titlecast-shields': [839, 204],
  'art-titlecast-solved': [820, 216],
  'art-titlecast-stats': [740, 273],
  'art-titlecast-strategy': [957, 265],
  'art-titlecast-streakcal': [1017, 163],
  'art-titlecast-streaksaved': [1080, 164],
  'art-titlecast-support': [877, 204],
  'art-titlecast-sweep': [1029, 172],
  'art-titlecast-terms': [782, 273],
  'art-titlecast-tour-daily': [915, 162],
  'art-titlecast-tour-score': [742, 163],
  'art-titlecast-tour-streak': [1080, 142],
  'art-titlecast-tour-together': [1080, 163],
  'art-titlecast-trophycase': [1001, 211],
  'art-titlecast-username': [1080, 137],
  'art-titlecast-vsbattle': [940, 244],
  'art-titlecast-vsused': [932, 162],
  'art-titlecast-welcome': [949, 249],
  'art-titlecast-welcomeback': [1080, 170],
  'art-titlecast-welcomepro': [1066, 148],
  'art-titlecast-words': [809, 265],
  'art-titlecast-wotd': [973, 195],
  'art-titlecast-yourein': [807, 191],
  'art-titlecast-yourepro': [774, 149],
  'art-btn-blue-l': [342, 168],
  'art-btn-blue-l-dark': [342, 168],
  'art-btn-blue-l-pressed': [350, 168],
  'art-btn-blue-l-pressed-dark': [350, 168],
  'art-btn-blue-m': [269, 132],
  'art-btn-blue-m-dark': [269, 132],
  'art-btn-blue-m-pressed': [275, 132],
  'art-btn-blue-m-pressed-dark': [275, 132],
  'art-btn-blue-s': [195, 96],
  'art-btn-blue-s-dark': [195, 96],
  'art-btn-blue-s-pressed': [200, 96],
  'art-btn-blue-s-pressed-dark': [200, 96],
  'art-btn-gold-l': [313, 168],
  'art-btn-gold-l-dark': [313, 168],
  'art-btn-gold-l-pressed': [313, 168],
  'art-btn-gold-l-pressed-dark': [313, 168],
  'art-btn-gold-m': [246, 132],
  'art-btn-gold-m-dark': [246, 132],
  'art-btn-gold-m-pressed': [246, 132],
  'art-btn-gold-m-pressed-dark': [246, 132],
  'art-btn-gold-s': [179, 96],
  'art-btn-gold-s-dark': [179, 96],
  'art-btn-gold-s-pressed': [179, 96],
  'art-btn-gold-s-pressed-dark': [179, 96],
  'art-btn-green-l': [339, 168],
  'art-btn-green-l-dark': [339, 168],
  'art-btn-green-l-pressed': [348, 168],
  'art-btn-green-l-pressed-dark': [348, 168],
  'art-btn-green-m': [266, 132],
  'art-btn-green-m-dark': [266, 132],
  'art-btn-green-m-pressed': [274, 132],
  'art-btn-green-m-pressed-dark': [274, 132],
  'art-btn-green-s': [194, 96],
  'art-btn-green-s-dark': [194, 96],
  'art-btn-green-s-pressed': [199, 96],
  'art-btn-green-s-pressed-dark': [199, 96],
  'art-btn-orange-l': [314, 168],
  'art-btn-orange-l-dark': [314, 168],
  'art-btn-orange-l-pressed': [314, 168],
  'art-btn-orange-l-pressed-dark': [314, 168],
  'art-btn-orange-m': [247, 132],
  'art-btn-orange-m-dark': [247, 132],
  'art-btn-orange-m-pressed': [247, 132],
  'art-btn-orange-m-pressed-dark': [247, 132],
  'art-btn-orange-s': [179, 96],
  'art-btn-orange-s-dark': [179, 96],
  'art-btn-orange-s-pressed': [179, 96],
  'art-btn-orange-s-pressed-dark': [179, 96],
  'art-btn-pink-l': [315, 168],
  'art-btn-pink-l-dark': [315, 168],
  'art-btn-pink-l-pressed': [315, 168],
  'art-btn-pink-l-pressed-dark': [315, 168],
  'art-btn-pink-m': [248, 132],
  'art-btn-pink-m-dark': [248, 132],
  'art-btn-pink-m-pressed': [248, 132],
  'art-btn-pink-m-pressed-dark': [248, 132],
  'art-btn-pink-s': [180, 96],
  'art-btn-pink-s-dark': [180, 96],
  'art-btn-pink-s-pressed': [180, 96],
  'art-btn-pink-s-pressed-dark': [180, 96],
  'art-btn-purple-l': [315, 168],
  'art-btn-purple-l-dark': [315, 168],
  'art-btn-purple-l-pressed': [315, 168],
  'art-btn-purple-l-pressed-dark': [315, 168],
  'art-btn-purple-m': [248, 132],
  'art-btn-purple-m-dark': [248, 132],
  'art-btn-purple-m-pressed': [248, 132],
  'art-btn-purple-m-pressed-dark': [248, 132],
  'art-btn-purple-s': [180, 96],
  'art-btn-purple-s-dark': [180, 96],
  'art-btn-purple-s-pressed': [180, 96],
  'art-btn-purple-s-pressed-dark': [180, 96],
  'art-btn-slate-l': [313, 168],
  'art-btn-slate-l-dark': [313, 168],
  'art-btn-slate-l-pressed': [312, 168],
  'art-btn-slate-l-pressed-dark': [312, 168],
  'art-btn-slate-m': [246, 132],
  'art-btn-slate-m-dark': [246, 132],
  'art-btn-slate-m-pressed': [245, 132],
  'art-btn-slate-m-pressed-dark': [245, 132],
  'art-btn-slate-s': [179, 96],
  'art-btn-slate-s-dark': [179, 96],
  'art-btn-slate-s-pressed': [178, 96],
  'art-btn-slate-s-pressed-dark': [178, 96],
  'art-btn-teal-l': [340, 168],
  'art-btn-teal-l-dark': [340, 168],
  'art-btn-teal-l-pressed': [350, 168],
  'art-btn-teal-l-pressed-dark': [350, 168],
  'art-btn-teal-m': [267, 132],
  'art-btn-teal-m-dark': [267, 132],
  'art-btn-teal-m-pressed': [275, 132],
  'art-btn-teal-m-pressed-dark': [275, 132],
  'art-btn-teal-s': [194, 96],
  'art-btn-teal-s-dark': [194, 96],
  'art-btn-teal-s-pressed': [200, 96],
  'art-btn-teal-s-pressed-dark': [200, 96],
  // BJ13: the pocket-game titles over the quick-play friend picker (cast-colors/pocket-<kind>.png).
  'art-badge-icon-clock-sprite': [256, 256],
  'art-frame-bronze': [256, 256],
  'art-frame-diamond': [256, 256],
  'art-frame-gold': [256, 256],
  'art-frame-platinum': [256, 256],
  'art-frame-silver': [256, 256],
  'art-gauntlet-header': [1200, 416],
  'art-gauntlet-medal-cleared': [256, 256],
  'art-gauntlet-medal-current': [256, 256],
  'art-gauntlet-medal-locked': [256, 256],
  'art-halloween-prop-bat': [256, 256],
  'art-halloween-prop-candy': [256, 256],
  'art-halloween-prop-ghost': [256, 256],
  'art-halloween-prop-pumpkin': [256, 256],
  'art-react-clap': [256, 256],
  'art-react-fire': [256, 256],
  'art-react-grr': [256, 256],
  'art-react-heart': [256, 256],
  'art-react-rematch': [256, 256],
  'art-react-wow': [256, 256],
  'art-scene-achievement': [1200, 519],
  'art-scene-all-set': [1200, 381],
  'art-scene-banner-halloween': [905, 570],
  'art-scene-welcome-cast': [1200, 402],
  'art-toggle-dark-knob': [243, 245],
  'art-toggle-dark-switch': [340, 200],
  'art-toggle-dark-switch-on': [438, 202],
  'art-toggle-dark-thumb-off': [428, 216],
  'art-toggle-dark-thumb-on': [382, 201],
  'art-toggle-dark-track': [480, 166],
  'art-toggle-light-knob': [244, 246],
  'art-toggle-light-switch': [341, 199],
  'art-toggle-light-switch-on': [437, 202],
  'art-toggle-light-thumb-off': [421, 217],
  'art-toggle-light-thumb-on': [375, 196],
  'art-toggle-light-track': [480, 167],
  // FINISH_SPEC BJ15: cast-button label art (docs/design/brand/buttons/labels/ship-labels.py), all 96 px tall.
  'art-btnlabel-play': [300, 96],
  'art-btnlabel-signin': [441, 96],
  'art-btnlabel-done': [334, 96],
  'art-btnlabel-gopro': [455, 96],
  'art-btnlabel-rematch': [574, 96],
  'art-btnlabel-hint': [269, 96],
  'art-btnlabel-addfriend': [568, 96],
  'art-btnlabel-tour': [799, 96],
  'art-btnlabel-seeall': [414, 96],
  'art-btnlabel-shareresults': [814, 96],
  'art-btnlabel-share': [350, 96],
  'art-btnlabel-accept': [409, 96],
  'art-btnlabel-next': [271, 96],
  'art-btnlabel-playagain': [620, 96],
  'art-btnlabel-tryagain': [567, 96],
  'art-btnlabel-decline': [445, 96],
  'art-btnlabel-sendgift': [649, 96],
  'art-btnlabel-upgrade': [915, 96],
  'art-btnlabel-gotit': [353, 96],
  'art-btnlabel-seepro': [442, 96],
  'art-btnlabel-letsplay': [502, 96],
  'art-btnlabel-challengethem': [892, 96],
  'art-btnlabel-seefriends': [587, 96],
  'art-btnlabel-startplaying': [715, 96],
  'art-btnlabel-undo': [280, 96],
  'art-btnlabel-continue': [473, 96],
  'art-btnlabel-howtoplay': [685, 96],
  'art-btnlabel-skip': [238, 96],
  'art-btnlabel-sharelink': [626, 96],
  'art-btnlabel-erase': [328, 96],
  'art-btnlabel-keepplaying': [646, 96],
  'art-btnlabel-save': [268, 96],
  'art-btnlabel-notnow': [494, 96],
  'art-btnlabel-start': [331, 96],
  'art-btnlabel-signup': [372, 96],
  'art-btnlabel-invite': [306, 96],
  'art-btnlabel-heads': [303, 96],
  'art-btnlabel-tails': [262, 96],
  'art-btnlabel-copied': [351, 96],
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
 * FINISH_SPEC AB: the words each whole-cast page title (art-title-*) draws, its
 * accessible name. Lettering images don't scale with Larger Text; their labels do.
 */
export const TITLE_ART_LABEL: Record<TitleArtName, string> = {
  'art-titlecast-friends': 'Friends',
  'art-titlecast-stats': 'Stats',
  'art-titlecast-records': 'All-Time Records',
  'art-title-vs': 'VS Battle',
  'art-titlecast-puzzles': 'Puzzles',
  'art-titlecast-wotd': 'Word of the Day',
  'art-titlecast-settings': 'Settings',
  'art-titlecast-howto': 'How to Play',
  'art-titlecast-guides': 'Guides',
  'art-titlecast-strategy': 'Strategy',
  'art-titlecast-words': 'Words',
  'art-titlecast-faq': 'FAQ',
  'art-titlecast-privacy': 'Privacy',
  'art-titlecast-terms': 'Terms',
  'art-titlecast-gopro': 'Go Pro',
  'art-titlecast-moregames': 'More Games',
  'art-titlecast-welcome': 'Welcome!',
  'art-titlecast-leaderboard': 'Leaderboard',
  'art-titlecast-dailies': 'Dailies',
  'art-titlecast-vsbattle': 'VS Battle',
  'art-titlecast-menu': 'Menu',
};

/** The Leaderboard day titles' words (core leaderboardTitle's weekday names), Sunday first. */
export const DAY_ART_LABEL: Record<DayArtName, string> = {
  'art-day-sunday': 'Sunday Superstars',
  'art-day-monday': 'Monday Masters',
  'art-day-tuesday': 'Tuesday Titans',
  'art-day-wednesday': 'Wednesday Wizards',
  'art-day-thursday': 'Thursday Thunder',
  'art-day-friday': 'Friday’s Finest',
  'art-day-saturday': 'Saturday Stars',
};

/** Lettering art: an image whose job is to show words (page / day / game titles, moments). */
export type LetteringArtName = TitleArtName | DayArtName | GameTitleArtName | MomentArtName;

/** True for lettering art (it needs a label and the heading trait); everything else is decorative. */
export function isLetteringArt(name: string): name is LetteringArtName {
  return (/^art-(title|day|game|moment)-/.test(name) || name in TITLE_ART_LABEL) && !name.endsWith('-wide');
}

/**
 * FINISH_SPEC AB: the accessible name of any lettering art (the words it shows),
 * or '' for decorative art (poses, scenes, props, wallpaper, badges), which
 * renders with alt="" and aria-hidden.
 */
export function artLabel(name: string): string {
  if (name in TITLE_ART_LABEL) return TITLE_ART_LABEL[name as TitleArtName];
  if (name in DAY_ART_LABEL) return DAY_ART_LABEL[name as DayArtName];
  if (name.startsWith('art-moment-')) return MOMENT_LABEL[name.slice('art-moment-'.length) as MomentName] ?? '';
  if (name.startsWith('art-game-') && GAME_TITLE_ART_SET.has(name.slice('art-game-'.length))) return gameTitleArtLabel(name as GameTitleArtName);
  return '';
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
  /** BA1: ~56 on short phones (was 84). */
  headerShort: 56,
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
 * is `side`, px-2), so its height is (100vw − inset) × the art's aspect ratio
 * (on desktop web the 560 px game column's width instead: --game-col-w, FINISH_SPEC AG).
 * The guess / timer status line follows the art; `pad` px under the header.
 */
export const GAME_HEADER = { pad: 6, side: 8, button: 44, gap: 2, inset: 32 } as const;

/** Where the title art starts, px from the header top: under the corner-button row (§19.3). */
export const GAME_TITLE_TOP = GAME_HEADER.pad + GAME_HEADER.button + GAME_HEADER.gap;

/**
 * A header art's rendered height as CSS (§19.3): the full width minus 32 times
 * the art's aspect ratio, clamped to [headerMin, cap], where the cap is
 * `--game-title-cap` (globals.css .game-art-header: 120, or 56 when the
 * viewport is under 700 tall).
 */
export function gameHeaderArtHeight(name: GameTitleArtName): string {
  const [w, h] = ART_SIZE[name];
  return `clamp(${GAME_TITLE_ART_HEIGHT.headerMin}px, calc((var(--game-col-w, 100vw) - ${GAME_HEADER.inset}px) * ${(h / w).toFixed(4)}), var(--game-title-cap, ${GAME_TITLE_ART_HEIGHT.header}px))`;
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
  // FINISH_SPEC C2b: the glossy broom for the Sweep board's picker tile.
  'sweep',
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
 * How a title art animates when its page appears (§16; FINISH_SPEC A6): page
 * titles (art-title-*), day titles (art-day-*) and game title art (art-game-*)
 * pop in once (scale 0.94 → 1.03 → 1, fade in, 420 ms) and then stay put — the
 * old idle float is gone; everything else (moments, scenes) is left alone.
 * Reduce Motion (OS or the in-app toggle) turns it off in globals.css.
 */
export type ArtMotion = 'float' | 'pop' | 'none';
export function artMotion(name: string): ArtMotion {
  // FINISH_SPEC A6: page and day titles are headlines on the wallpaper — they
  // pop in once and no longer float.
  if (name.startsWith('art-title-') || name.startsWith('art-titlecast-') || name.startsWith('art-day-')) return 'pop';
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
