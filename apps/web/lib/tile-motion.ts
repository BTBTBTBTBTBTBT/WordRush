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
 * B3 timings (ms). FINISH_SPEC AQ1 shortened the win hop and made the not-a-word
 * reject never block typing (a key pressed during it cuts it short —
 * hooks/use-reject-row.ts). FINISH_SPEC BI5 (founder 10-02 on 2.7: "it seemed
 * really rushed … way too zippy"; "the older builds before the aesthetic updates
 * had much better flow"): the pre-overhaul reveal pacing is back — a single board
 * 500 ms flips, 150 ms apart (a 5-letter row ≈ 1.1 s); a multi-board ("mini")
 * board 300 ms, 80 ms apart (the old tile-flip / tile-flip-mini). (B3 was
 * 720 / 300; AQ1 220 / 70.) The keyframes in globals.css `.gt-*` use the same
 * numbers (tile-motion.test.ts keeps them in step).
 */
export const REVEAL = {
  /** Each tile turns over in 500 ms (single board)… */
  flipMs: 500,
  /** …150 ms after the one before it. */
  stagger: 150,
  /** A multi-board ("mini") tile turns over in 300 ms… */
  miniFlipMs: 300,
  /** …80 ms after the one before it (every board of a multi-board reveal at once). */
  miniStagger: 80,
  /** The pre-overhaul beat between the board settling and the result popup. */
  finishBeatMs: 200,
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
  /** One tile's turn-over: single board or mini (multi-board). */
  flipFor(mini = false): number {
    return mini ? this.miniFlipMs : this.flipMs;
  },
  /** The gap between neighboring tiles: single board or mini (multi-board). */
  staggerFor(mini = false): number {
    return mini ? this.miniStagger : this.stagger;
  },
  /** When tile `index` of a revealing row has landed (its keyboard key takes its color then). */
  landMs(index: number, mini = false): number {
    return Math.max(0, index) * this.staggerFor(mini) + this.flipFor(mini);
  },
  /** When a row's reveal has finished: the last tile lands. */
  end(tiles: number, mini = false): number {
    return Math.max(0, tiles - 1) * this.staggerFor(mini) + this.flipFor(mini);
  },
  /** The win hop wave over a row of `tiles`. */
  hopWaveMs(tiles: number): number {
    return Math.max(0, tiles - 1) * this.hopStagger + this.hopMs;
  },
  /**
   * BI5: how long a finished board holds before the result popup — the final
   * row's whole reveal, then (a win) its hop wave, then the 200 ms beat. Never cut
   * short: the popup always waits for the row to finish.
   */
  finishHoldMs(tiles: number, win: boolean, mini = false): number {
    return this.end(tiles, mini) + (win ? this.hopWaveMs(tiles) : 0) + this.finishBeatMs;
  },
} as const;

/** A key pressed while a not-a-word reject is running: letters start the fresh row; Enter / Delete only cut the reject short (the row is already empty). */
export function keyDuringReject(key: string): 'type' | 'swallow' {
  return /^[A-Z]$/.test(key) ? 'type' : 'swallow';
}
