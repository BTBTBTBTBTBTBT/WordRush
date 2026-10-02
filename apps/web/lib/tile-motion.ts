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

/** B3 timings (ms). */
export const REVEAL = {
  /** Each tile turns over in 720 ms… */
  flipMs: 720,
  /** …300 ms after the one before it. */
  stagger: 300,
  /** The glow after a tile lands. */
  bloomMs: 900,
  /** Win: the hop wave, 560 ms each, 90 ms apart. */
  hopMs: 560,
  hopStagger: 90,
  /** Not a word: the row nudge. */
  nudgeMs: 520,
  /**
   * Not a word: the red glow, then the letters clear right to left. The games
   * clear the row after 600 ms (their own logic, unchanged), so the glow and
   * the right-to-left clear are fitted inside that window.
   */
  badMs: 600,
  outStart: 240,
  outStagger: 60,
  /** When a row's reveal has finished: the last tile lands. */
  end(tiles: number): number {
    return Math.max(0, tiles - 1) * this.stagger + this.flipMs;
  },
} as const;
