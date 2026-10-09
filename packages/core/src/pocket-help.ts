// Pocket-game How to Play + first-play welcome (FRIDAY-QUEUE items 9c + 12, 2.8 wave 3).
//
// Every pocket game gets the same "?" and How to Play card the other games have:
// three short steps (each with a tiny picture built from the shipped art-pocket-*
// pieces), the win rule, and how turns work with a friend. The first time a
// player opens ANY game (the 18 main games and the six pocket games), the same
// card opens by itself once, with "Let's play!" instead of "Got it"; "seen" is
// kept per player (profiles.tutorials_seen, synced, plus a local copy for
// guests) so a new device does not show it again.
//
// Pure so web, iOS and Android read the SAME words and the SAME decision; the
// ports assert against pocket-help-fixtures.json (scripts/gen-parity-fixtures.ts).

import type { FriendlyKind } from './friendly-games';

/** Off-switch (feature-switches.ts): fail-open, so an outage never hides a tutorial it already decided on. */
export const FIRST_PLAY_FLAG = 'first_play_tutorials';

/** The synced column on profiles (supabase/manual-migrations/20261010000001_tutorials_seen.sql). */
export const TUTORIALS_SEEN_COLUMN = 'tutorials_seen';

/** One picture on a help step: art names (art-pocket-*), shown left to right. */
export interface PocketHelpPicture {
  /** Shipped art names in order. */
  art: string[];
  /** A short caption under the picture ("beats", "wins"), same length as `art` minus 1, or empty. */
  joiners: string[];
}

export interface PocketHelpStep {
  text: string;
  picture: PocketHelpPicture;
}

export interface PocketHelp {
  kind: FriendlyKind;
  /** The tutorial key, "pocket-rps". */
  key: string;
  title: string;
  steps: PocketHelpStep[];
  /** How the game is won, one line. */
  win: string;
  /** How turns work with a friend (the same promise on every game). */
  turns: string;
}

export const POCKET_TURNS_LINE = 'Take your turn any time. Your friend gets a ping, and the game waits for you both for 3 days.';

const p = (art: string[], joiners: string[] = []): PocketHelpPicture => ({ art, joiners });

export const POCKET_HELP: Record<FriendlyKind, PocketHelp> = {
  rps: {
    kind: 'rps', key: 'pocket-rps', title: 'Rock Paper Scissors',
    steps: [
      { text: 'Pick rock, paper or scissors. Your pick stays hidden.', picture: p(['art-pocket-rps-rock', 'art-pocket-rps-paper', 'art-pocket-rps-scissors']) },
      { text: 'When you both have picked, the hands flip over together.', picture: p(['art-pocket-rps-rock', 'art-pocket-clash-burst', 'art-pocket-rps-scissors']) },
      { text: 'Rock beats scissors, scissors beat paper, paper beats rock.', picture: p(['art-pocket-rps-rock', 'art-pocket-rps-scissors'], ['beats']) },
    ],
    win: 'First to win 2 rounds takes the match.',
    turns: POCKET_TURNS_LINE,
  },
  ttt: {
    kind: 'ttt', key: 'pocket-ttt', title: 'Tic-Tac-Tile',
    steps: [
      { text: 'Take turns placing your tile on the 3 by 3 board. You are the purple X.', picture: p(['art-pocket-ttt-x', 'art-pocket-ttt-o']) },
      { text: 'Three of your tiles in a row, across, down or corner to corner, wins the game.', picture: p(['art-pocket-ttt-x', 'art-pocket-ttt-x', 'art-pocket-ttt-x']) },
      { text: 'Fill the board with no line and the game is a draw.', picture: p(['art-pocket-ttt-board']) },
    ],
    win: 'Win 2 games, out of at most 5, to take the match.',
    turns: POCKET_TURNS_LINE,
  },
  coin: {
    kind: 'coin', key: 'pocket-coin', title: 'Call It',
    steps: [
      { text: 'Call heads or tails before the flip.', picture: p(['art-pocket-coin-heads-w', 'art-pocket-coin-tails-crest']) },
      { text: 'The coin flips. Call it right and the round is yours.', picture: p(['art-pocket-coin-heads-w', 'art-pocket-coin-tilt', 'art-pocket-coin-tails-crest']) },
      { text: 'You swap who calls each round. Heads is the W, tails is the crest.', picture: p(['art-pocket-coin-sparkle-ring']) },
    ],
    win: 'First to win 3 flips takes the match, and the stake you picked.',
    turns: POCKET_TURNS_LINE,
  },
  pass: {
    kind: 'pass', key: 'pocket-pass', title: 'Pass the Puzzle',
    steps: [
      { text: 'You and your friend share one hidden word and one board.', picture: p(['art-pocket-tile-white', 'art-pocket-tile-white', 'art-pocket-tile-white', 'art-pocket-tile-white', 'art-pocket-tile-white']) },
      { text: 'Take turns guessing. Purple is the right spot, gold is the wrong spot.', picture: p(['art-pocket-tile-purple', 'art-pocket-tile-gold', 'art-pocket-tile-white']) },
      { text: 'Use what the last guess showed. There are 6 guesses in all.', picture: p(['art-pocket-puzzle-piece']) },
    ],
    win: 'Whoever finds the word wins. Nobody finds it in 6, it is a draw.',
    turns: POCKET_TURNS_LINE,
  },
  ghost: {
    kind: 'ghost', key: 'pocket-ghost', title: 'Ghost',
    steps: [
      { text: 'Take turns adding one letter to a growing word fragment.', picture: p(['art-pocket-tile-purple', 'art-pocket-tile-gold', 'art-pocket-tile-purple']) },
      { text: 'Every fragment must still be able to become a real word.', picture: p(['art-pocket-tile-white', 'art-pocket-tile-white', 'art-pocket-tile-white']) },
      { text: 'Finish a real word, or play a dead end, and you lose the round.', picture: p(['art-pocket-ghost-marker']) },
    ],
    win: 'Win 2 rounds, out of at most 5, to take the match.',
    turns: POCKET_TURNS_LINE,
  },
  chain: {
    kind: 'chain', key: 'pocket-chain', title: 'Word Chain',
    steps: [
      { text: 'Play a word that starts with the last letter of the word before it.', picture: p(['art-pocket-tile-purple', 'art-pocket-chain-connector', 'art-pocket-tile-gold']) },
      { text: 'Longer words score more points. No word can be played twice.', picture: p(['art-pocket-chain-links']) },
      { text: 'Build the chain back and forth with your friend.', picture: p(['art-pocket-tile-purple', 'art-pocket-tile-gold', 'art-pocket-tile-purple']) },
    ],
    win: 'First to 30 points wins.',
    turns: POCKET_TURNS_LINE,
  },
};

/** The tutorial key for a pocket kind ("pocket-rps"); main games use their mode id ("practice", "hub"). */
export const pocketTutorialKey = (kind: FriendlyKind): string => `pocket-${kind}`;

/** The first-play card's button, and the reopened card's button. */
export const TUTORIAL_BUTTON_FIRST = "Let's play!";
export const TUTORIAL_BUTTON_AGAIN = 'Got it';

/**
 * Whether the welcome card opens by itself: the switch is live and this game's
 * key is not in the player's seen list. `seen` is null while it is still loading
 * (never show on a guess: wait). `hasResults` = the player already has results in
 * this game (an existing player): the card never opens by itself, and the caller
 * quietly records the key as seen (tutorialShouldRecordSeen) so it stays synced.
 */
export function shouldAutoShowTutorial(i: { live: boolean; seen: readonly string[] | null; key: string; hasResults?: boolean }): boolean {
  if (!i.live || i.seen === null) return false;
  if (i.hasResults) return false;
  return !i.seen.includes(i.key);
}

/** An existing player (results in this game) whose key is not yet recorded: record it silently, show nothing. */
export function tutorialShouldRecordSeen(i: { live: boolean; seen: readonly string[] | null; key: string; hasResults?: boolean }): boolean {
  return i.live && i.seen !== null && !!i.hasResults && !i.seen.includes(i.key);
}

/** The seen list after the card closes: the key added once, kept sorted (stable for sync). */
export function withTutorialSeen(seen: readonly string[], key: string): string[] {
  return seen.includes(key) ? [...seen] : [...seen, key].sort();
}

/** Two devices both added keys: the union, sorted. */
export function mergeTutorialsSeen(a: readonly string[], b: readonly string[]): string[] {
  return Array.from(new Set([...a, ...b])).sort();
}
