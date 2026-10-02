// The game kit's motion timings and tile looks (docs/FINISH_SPEC.md B1, B3;
// keyframes in globals.css `.gt-*`). Pure, so the board components and tests
// share one source.

/** The tile looks globals.css draws (`.gtile[data-s=…]`). */
export type TileLook = 'empty' | 'typed' | 'correct' | 'present' | 'absent' | 'given' | 'conflict' | 'gap';

/**
 * A game tile state (core TileState: CORRECT / PRESENT / ABSENT / EMPTY /
 * HINT_USED, or lowercase) plus whether it holds a letter → the tile look.
 * An empty-state tile with a letter is a typed tile; a hint gap is quiet.
 */
export function tileLook(state: string | null | undefined, letter?: string | null): TileLook {
  switch (String(state ?? '').toUpperCase()) {
    case 'CORRECT': return 'correct';
    case 'PRESENT': return 'present';
    case 'ABSENT': return 'absent';
    case 'HINT_USED': return 'gap';
    default: return letter && letter.trim() ? 'typed' : 'empty';
  }
}

/**
 * B3 timings (ms), tightened by FINISH_SPEC AQ1 (founder 10-02: "feels a little
 * slow … when I am trying to go through it fast"): flip ≤ 220, stagger ≤ 70,
 * a shorter win hop, and a not-a-word reject that never blocks typing (a key
 * pressed during it cuts it short — hooks/use-reject-row.ts). The keyframes in
 * globals.css `.gt-*` use the same numbers (tile-motion.test.ts keeps them in step).
 */
export const REVEAL = {
  /** Each tile turns over in 220 ms… */
  flipMs: 220,
  /** …70 ms after the one before it (every board of a multi-board reveal at once). */
  stagger: 70,
  /** The glow after a tile lands. */
  bloomMs: 600,
  /** Win: the hop wave, 400 ms each, 60 ms apart. */
  hopMs: 400,
  hopStagger: 60,
  /** Out of guesses: the wobble that settles the last row. */
  sinkMs: 500,
  /** Not a word: the row nudge. */
  nudgeMs: 360,
  /**
   * Not a word (iOS parity): the rejected letters hold ~0.7 s in red with the
   * red glow, then clear right to left, 60 ms apart, each letter shrinking
   * out in `outMs`. Typing during it cuts it short; it never drops a key.
   */
  badMs: 700,
  outStart: 700,
  outStagger: 60,
  outMs: 160,
  /** How long a not-a-word reject runs for a row of `tiles` letters: glow + the right-to-left clear. */
  rejectMs(tiles: number): number {
    return this.outStart + Math.max(0, tiles - 1) * this.outStagger + this.outMs;
  },
  /** When tile `index` of a revealing row has landed (its keyboard key takes its color then). */
  landMs(index: number): number {
    return Math.max(0, index) * this.stagger + this.flipMs;
  },
  /** When a row's reveal has finished: the last tile lands. */
  end(tiles: number): number {
    return Math.max(0, tiles - 1) * this.stagger + this.flipMs;
  },
} as const;

/** A key pressed while a not-a-word reject is running: letters start the fresh row; Enter / Delete only cut the reject short (the row is already empty). */
export function keyDuringReject(key: string): 'type' | 'swallow' {
  return /^[A-Z]$/.test(key) ? 'type' : 'swallow';
}
