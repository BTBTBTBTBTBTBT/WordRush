// The WORDOCIOUS cast (founder-approved 2026-10-02; spec docs/MASCOT_SPEC.md).
// Ten letter characters spelling WORDOCIOUS. Every image is decorative (hidden
// from screen readers) and every motion stops under Reduce Motion (globals.css).
// This file is the ONE web table of who hosts what: pages (§1), game modes keyed
// by the mode db key (§5) and the moments (§3, §6). iOS keeps Mascots.swift and
// Android ui/Mascots.kt in step with it.

import { MODES } from './modes.generated';

export type MascotId = 'w' | 'o1' | 'r' | 'd' | 'o2' | 'c' | 'i' | 'o3' | 'u' | 's';

/** The cast in WORDOCIOUS order. */
export const CAST: readonly MascotId[] = ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's'];

/** The letter each character wears. */
export const MASCOT_LETTER: Record<MascotId, string> = {
  w: 'W', o1: 'O', r: 'R', d: 'D', o2: 'O', c: 'C', i: 'I', o3: 'O', u: 'U', s: 'S',
};

/** Public path of a character's art (512 px, transparent). */
export function mascotSrc(id: MascotId): string {
  return `/mascots/${id}.png`;
}

/** §1 + §6: one host per page or place. */
export const PAGE_HOSTS = {
  home: 'w',
  puzzles: 'c',
  wordOfTheDay: 'i',
  leaderboard: 'o2',
  records: 'o2',
  stats: 'd',
  friends: 'o1',
  vs: 's',
  /** Empty states: nobody on, nothing yet. */
  empty: 'r',
  /** "All done for today / new puzzles in". */
  allDone: 'u',
  /** Empty friends list: "Add a friend and the race begins." */
  addFriend: 'i',
  /** Friends pocket game wins. */
  pocketWin: 'o3',
  settings: 'r',
  pro: 'w',
  guides: 'c',
  offline: 'r',
  notFound: 'o3',
  loss: 'r',
  /** Loading tips are voiced by D. */
  tips: 'd',
} as const satisfies Record<string, MascotId>;

/** §5: every game has a host, keyed by the mode db key. */
export const GAME_HOSTS: Record<string, MascotId> = {
  DUEL: 'w',            // Classic: the original, the leader
  GAUNTLET: 's',        // endurance and speed
  QUORDLE: 'o1',        // QuadWord: four arms, four boards
  OCTORDLE: 'd',        // OctoWord: big brain for eight boards
  SEQUENCE: 'i',        // Succession: grows one step at a time
  RESCUE: 'c',          // Deliverance: the explorer on a rescue mission
  DUEL_6: 'o2',         // Classic Six: the star of the bigger stage
  DUEL_7: 'u',          // Classic Seven: calm under the longest words
  SUDOKU: 'u',          // Sudocious: zen logic
  SCRAMBLE: 'r',        // Muddle: groggy, everything's muddled
  HUB: 'o1',            // Hubbub: all the words at once
  CROSSWORD: 'd',       // Crosswordocious: glasses and a pencil
  GROUPS: 'o2',         // Kindred: heart sunglasses, connections
  LADDER: 'i',          // Letter Ladder: tall, climbing
  CRYPTOGRAM: 'c',      // Codebreaker: the detective
  WORDSEARCH: 'o3',     // Spyglass: one big eye
  REGIONS: 's',         // Starsweep: the gold star
  PROPERNOUNDLE: 'w',   // ProperNoundle: proper names, the leader
};

/** The host of a game mode (db key), or null for a key without a game (SWEEP, VS). */
export function gameHost(dbKey: string | null | undefined): MascotId | null {
  if (!dbKey) return null;
  return GAME_HOSTS[dbKey] ?? null;
}

/** Guide slug → host, through the catalog's guideSlug → dbKey. */
export const GUIDE_HOSTS: Record<string, MascotId> = Object.fromEntries(
  MODES.filter((m) => m.guideSlug && m.dbKey && GAME_HOSTS[m.dbKey])
    .map((m) => [m.guideSlug as string, GAME_HOSTS[m.dbKey as string]]),
);

/** The host of a game's guide (how to play) by guide slug. */
export function guideHost(slug: string | null | undefined): MascotId | null {
  if (!slug) return null;
  return GUIDE_HOSTS[slug] ?? null;
}

/** A stable cast member for a seed (FNV-1a over the string). */
export function castMemberFor(seed: string): MascotId {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return CAST[(h >>> 0) % CAST.length];
}

/**
 * §3 + §5: who pops above VICTORY. The game's host; a mode without one gets a
 * cast member seeded by the day + mode, so it's stable for the day.
 */
export function victoryHost(dbKey: string | null | undefined, day: string): MascotId {
  return gameHost(dbKey) ?? castMemberFor(`${day}:${dbKey ?? ''}`);
}

export type VsOutcome = 'win' | 'loss' | 'draw';

/** §3 VS result: YOU WIN → S (pops), a loss → R, a draw → U. */
export function vsResultHost(outcome: VsOutcome): MascotId {
  return outcome === 'win' ? 's' : outcome === 'draw' ? 'u' : 'r';
}

/** §3 Friends pocket game result: a win → O3 (pops), a loss → R, a draw → U. */
export function pocketResultHost(outcome: VsOutcome): MascotId {
  return outcome === 'win' ? 'o3' : outcome === 'draw' ? 'u' : 'r';
}

/** §6: the one-line voices (American spelling, short, warm, never mean). */
export const MASCOT_LINES = {
  nobodyOn: "Nobody's on yet. Wake the crew with an invite.",
  addFriend: 'Add a friend and the race begins.',
  statsEmpty: "Play a game and I'll crunch the numbers.",
  offline: 'Lost the connection. Give it a sec.',
  notFound: "Couldn't find that page.",
  noResults: 'Quiet in here. Be the first on the board.',
} as const;

/** U's "all done" line with the live reset clock. */
export function allDoneLine(clock: string): string {
  return `All done for today. Fresh puzzles in ${clock}.`;
}

/** §6 loading tips, voiced by D under the CastRow loader. */
export const LOADING_TIPS: readonly string[] = [
  'Tip: start with a word that has three vowels.',
  'Tip: a gray letter is gone for good, so skip it next time.',
  'Tip: yellow means right letter, wrong spot. Move it.',
  'Tip: in VS, solving always beats a faster miss.',
  'Tip: finish every daily to sweep the day.',
];

/** The tip for a given tick (rotates through the list). */
export function loadingTip(tick: number): string {
  const n = LOADING_TIPS.length;
  return LOADING_TIPS[((tick % n) + n) % n];
}
