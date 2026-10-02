import { memo } from 'react';
import type { CSSProperties } from 'react';
import { REVEAL, type TileLook } from '@/lib/tile-motion';

export { tileLook, type TileLook } from '@/lib/tile-motion';

// The one game tile (docs/FINISH_SPEC.md B1; ART_SPEC §20 recipe; mockup
// game-kit.html §1): a rounded square with a thick bottom lip, a gloss, and
// white Nunito Black letters — purple right spot, gold wrong spot, slate gray
// not in the word, frosted-glass empty, typed = white face + purple border +
// dark purple letter. The same tile carries digits (Sudocious givens = plain
// light tile). The look is CSS (globals.css `.gtile`); the motion kit (B3) is
// driven by the props below (timings in lib/tile-motion.ts). No hooks.

export interface LetterTileProps {
  letter?: string;
  look: TileLook;
  /** Reveal this tile: it turns over (720 ms) after `index × 300 ms`, its color swaps at the half, then a glow blooms. */
  flipIndex?: number;
  /** Swell in (type a letter / place a number). Defaults to on for typed tiles. */
  pop?: boolean;
  /** Not a word: red letters with a red glow, then the letter clears (right to left through `outIndex`). */
  bad?: boolean;
  /** Position from the right end for the right-to-left clear (0 = rightmost). */
  outIndex?: number;
  /** Win hop wave: this tile's place in the row (hops after the reveal, 90 ms apart). */
  hopIndex?: number;
  /** Tiles in the row (sets when the hop wave starts). */
  rowLength?: number;
  /** Out of guesses: wobble and settle lower after the reveal. */
  sink?: boolean;
  /** Hint: flips in purple with a gold glow, twice. */
  hint?: boolean;
  /** Pre-submit "not a word" ink (the typed row turns red before Enter). */
  invalid?: boolean;
  className?: string;
  style?: CSSProperties;
  role?: string;
  'aria-label'?: string;
  'aria-hidden'?: boolean;
}

export const LetterTile = memo(function LetterTile({
  letter = '', look, flipIndex, pop, bad = false, outIndex = 0, hopIndex, rowLength = 5, sink = false, hint = false, invalid = false,
  className = '', style, role, ...aria
}: LetterTileProps) {
  const flip = flipIndex != null;
  const popOn = pop ?? (look === 'typed' && !flip);
  const vars: Record<string, string> = {};
  if (flip) vars['--gt-d'] = `${flipIndex * REVEAL.stagger}ms`;
  if (hopIndex != null) vars['--gt-hop-d'] = `${REVEAL.end(rowLength) + hopIndex * REVEAL.hopStagger}ms`;
  if (sink) vars['--gt-sink-d'] = `${REVEAL.end(rowLength)}ms`;
  if (bad) {
    vars['--gt-bad-ms'] = `${REVEAL.badMs}ms`;
    vars['--gt-out-d'] = `${REVEAL.outStart + outIndex * REVEAL.outStagger}ms`;
  }
  const cls = [
    'gtile',
    popOn ? 'gt-pop' : '',
    flip ? 'gt-flip' : '',
    hopIndex != null ? 'gt-hop' : '',
    sink ? 'gt-sink' : '',
    bad ? 'gt-bad gt-out' : '',
    hint ? 'gt-hint' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      data-s={look}
      role={role}
      style={{ ...(vars as CSSProperties), ...(invalid && !bad ? { ['--gt-glyph' as string]: '#c2183a' } : null), ...style }}
      {...aria}
    >
      <b>{letter}</b>
      {flip && look !== 'typed' && look !== 'empty' && (
        <span className="gt-cover" aria-hidden="true"><b>{letter}</b></span>
      )}
    </div>
  );
});
