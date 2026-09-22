'use client';

import { memo } from 'react';
import { Star, X } from 'lucide-react';
import type { RegionsState } from '@wordle-duel/core';

// The Starsweep board (More Games §18b): ONE continuous ruled board like the
// Sudoku board — heavy rules between regions, hairlines within a region,
// regions washed in soft Wordocious tints (never colour alone: the heavy
// region borders carry the shape). A star is drawn in the dark text colour, a
// wrong star in the invalid-word red, a hint star in the violet hint colour, a
// cross-out as a small muted ×. The focused cell wears a thin accent inset ring
// so keyboard players can see where Space and Backspace will land.

export const REGION_TINTS = [
  '#ede9fe', // lilac
  '#d1fae5', // mint
  '#e0f2fe', // sky
  '#fce7f3', // rose
  '#fef9c3', // straw
  '#ccfbf1', // teal
  '#ffedd5', // peach
  '#ecfccb', // lime
  '#e2e8f0', // slate (9 × 9 only)
];
const STAR = 'var(--color-text)';
const WRONG = '#dc2626';
const HINT = '#8b5cf6';
const CROSS = '#6b7280';
const RULE = 'rgba(76, 29, 149, 0.22)';   // hairline within a region
const HEAVY = '#4c1d95';                  // region + outer rules
const FOCUS = '#ca8a04';

interface RegionsBoardProps {
  state: RegionsState;
  focused: number | null;
  onTap: (cell: number) => void;
  /** After a loss: show the missing stars, muted, so nobody leaves without the answer. */
  revealSolution?: boolean;
  maxSize?: number;
}

export const RegionsBoard = memo(function RegionsBoard({ state, focused, onTap, revealSolution = false, maxSize = 420 }: RegionsBoardProps) {
  const n = state.n;
  const reg = state.regions;
  const solutionStars = new Set<number>();
  if (revealSolution) for (let r = 0; r < n; r++) solutionStars.add(r * n + (state.solution.charCodeAt(r) - 48));

  return (
    <div className="w-full mx-auto select-none" style={{ maxWidth: maxSize, aspectRatio: '1 / 1' }} role="grid" aria-label="Starsweep board">
      <div
        className="grid w-full h-full overflow-hidden"
        style={{
          gridTemplateColumns: `repeat(${n}, 1fr)`,
          gridTemplateRows: `repeat(${n}, 1fr)`,
          border: `2.5px solid ${HEAVY}`,
          borderRadius: '14px',
          background: 'var(--color-surface)',
        }}
      >
        {Array.from({ length: n * n }, (_, i) => {
          const r = Math.floor(i / n), c = i % n;
          const g = reg.charCodeAt(i) - 48;
          const mark = state.board[i];
          const wrong = state.wrongMask[i] === '1';
          const hinted = state.hintMask[i] === '1';
          const missing = revealSolution && mark !== '*' && solutionStars.has(i);
          const rightHeavy = c < n - 1 && reg[i + 1] !== reg[i];
          const bottomHeavy = r < n - 1 && reg[i + n] !== reg[i];
          const color = wrong ? WRONG : hinted ? HINT : STAR;
          const label = `Row ${r + 1} column ${c + 1}, region ${g + 1}, ${mark === '*' ? (wrong ? 'wrong star' : 'star') : mark === 'x' ? 'crossed out' : 'empty'}`;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onTap(i)}
              className="relative flex items-center justify-center leading-none transition-colors duration-100"
              style={{
                background: REGION_TINTS[g % REGION_TINTS.length],
                borderRight: c === n - 1 ? 'none' : `${rightHeavy ? 2.5 : 1}px solid ${rightHeavy ? HEAVY : RULE}`,
                borderBottom: r === n - 1 ? 'none' : `${bottomHeavy ? 2.5 : 1}px solid ${bottomHeavy ? HEAVY : RULE}`,
                boxShadow: i === focused ? `inset 0 0 0 2px ${FOCUS}` : undefined,
                padding: 0,
              }}
              role="gridcell"
              aria-label={label}
            >
              {mark === '*' ? (
                <Star className="w-[62%] h-[62%]" style={{ color, fill: color }} strokeWidth={1.5} />
              ) : mark === 'x' ? (
                <X className="w-[42%] h-[42%]" style={{ color: CROSS }} strokeWidth={2.5} />
              ) : missing ? (
                <Star className="w-[62%] h-[62%]" style={{ color: 'var(--color-text-muted)', opacity: 0.55 }} strokeWidth={1.5} />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
});
