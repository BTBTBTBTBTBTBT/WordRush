import type { MuddleCoin } from './art';

// Muddle letters (docs/FINISH_SPEC.md I). Pure: which coin or tile each slot
// draws, and the letter ink on it. The coins are glossy blank art
// (public/art/art-muddle-coin-*.webp); the letter is drawn on top in code.

/** What an answer / punchline slot draws. */
export type MuddleSlotLook =
  /** A round coin (circled slots, the punchline tray); `frosted` = the frosted empty cell under the gold ring. */
  | { kind: 'coin'; coin: MuddleCoin; frosted: boolean }
  /** The B1 square glossy tile (uncircled slots). */
  | { kind: 'tile'; look: 'empty' | 'correct' | 'hint' };

/**
 * I1: an answer slot. Circled → a coin (empty: the gold ring on frosted;
 * a revealed hint letter: the violet hint coin; otherwise the purple filled
 * coin); uncircled → the square tile (purple once filled, the hint violet
 * for a pinned hint letter while unsolved, frosted when empty).
 */
export function answerSlotLook({ circled, filled, pinned, solved }: { circled: boolean; filled: boolean; pinned: boolean; solved: boolean }): MuddleSlotLook {
  const hint = !solved && filled && pinned;
  if (circled) {
    if (!filled && !solved) return { kind: 'coin', coin: 'empty', frosted: true };
    return { kind: 'coin', coin: hint ? 'hint' : 'filled', frosted: false };
  }
  if (!filled && !solved) return { kind: 'tile', look: 'empty' };
  return { kind: 'tile', look: hint ? 'hint' : 'correct' };
}

/** I2: a punchline tray slot — a gold coin, or the gold ring on frosted while empty. */
export function punchlineSlotLook(filled: boolean): MuddleSlotLook {
  return filled ? { kind: 'coin', coin: 'punchline', frosted: false } : { kind: 'coin', coin: 'empty', frosted: true };
}

/** The letter ink on a coin: white (with the tile text-shadow), dark amber on the gold punchline coin. */
export function coinInk(coin: MuddleCoin): string {
  return coin === 'punchline' ? '#7a3d00' : '#ffffff';
}

/** The letter's size on a coin: ~52% of the coin. */
export const COIN_LETTER = 0.52;

/** I3: the scramble chip's size, ~70% of the answer tile. */
export function chipSize(tile: number): number {
  return Math.round(tile * 0.7);
}

/** Which scramble letters are used, left to right by multiset (the remaining letters are unused). */
export function usedLetters(letters: string, remaining: string): boolean[] {
  const left = [...remaining];
  return [...letters].map((ch) => {
    const k = left.indexOf(ch);
    if (k >= 0) { left.splice(k, 1); return false; }
    return true;
  });
}
