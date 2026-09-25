'use client';

import { memo } from 'react';
import type { SudokuState } from '@wordle-duel/core';

// The board (More Games §8, founder round 5): ONE continuous ruled grid, like a
// printed Sudoku, in Wordocious colors — hairline lilac rules between cells,
// heavy rules around each 3×3 box and the outer edge, no per-cell radius or
// shadow. Givens in the dark text color at the heaviest weight, the player's
// digits in Wordocious purple, hint digits in the violet hint color, a wrong
// digit in the invalid-word red. The selected cell takes the stronger lilac
// fill with its row, column and box washed in the light tint; every cell
// holding the selected digit is emphasised. Pencil marks are the standard
// 3×3 mini-grid (1 top-left … 9 bottom-right) so each digit always sits in
// the same spot.

export const SUDOKU_ACCENT = '#1e40af';
const GIVEN = 'var(--color-text)';
const PLAYER = '#7c3aed';
const HINT = '#8b5cf6';
const WRONG = '#dc2626';
const RULE = '#c4b5fd';          // hairline between cells
const HEAVY = '#4c1d95';         // box + outer rules
const SELECTED = '#ddd6fe';
const WASH = 'var(--color-win-bg)';
const SAME = '#ede9fe';

interface SudokuBoardProps {
  state: SudokuState;
  selected: number | null;
  onSelect: (cell: number) => void;
  /** After a loss: fill the unsolved cells with the solution, muted. */
  revealSolution?: boolean;
  /** Max board size in px; the board is square and fills its parent up to this. */
  maxSize?: number;
}

const boxOf = (i: number) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);

export const SudokuBoard = memo(function SudokuBoard({ state, selected, onSelect, revealSolution = false, maxSize = 420 }: SudokuBoardProps) {
  const selRow = selected != null ? Math.floor(selected / 9) : -1;
  const selCol = selected != null ? selected % 9 : -1;
  const selBox = selected != null ? boxOf(selected) : -1;
  const selDigit = selected != null && state.board[selected] !== '0' ? state.board[selected] : null;

  return (
    <div
      className="w-full mx-auto select-none"
      style={{ maxWidth: maxSize, aspectRatio: '1 / 1' }}
      role="grid"
      aria-label="Sudocious board"
    >
      <div
        className="grid w-full h-full overflow-hidden"
        style={{
          gridTemplateColumns: 'repeat(9, 1fr)',
          gridTemplateRows: 'repeat(9, 1fr)',
          border: `2.5px solid ${HEAVY}`,
          borderRadius: '14px',
          background: 'var(--color-surface)',
        }}
      >
        {Array.from({ length: 81 }, (_, i) => {
          const r = Math.floor(i / 9), c = i % 9;
          const given = state.givens[i] !== '0';
          const value = state.board[i] !== '0' ? state.board[i] : revealSolution ? state.solution[i] : '';
          const isRevealed = revealSolution && state.board[i] === '0';
          const wrong = state.wrongMask[i] === '1';
          const hinted = state.hintMask[i] === '1';
          const isSelected = i === selected;
          const inWash = r === selRow || c === selCol || boxOf(i) === selBox;
          const sameDigit = selDigit != null && value === selDigit && !isSelected;
          const color = isRevealed ? 'var(--color-text-muted)' : wrong ? WRONG : hinted ? HINT : given ? GIVEN : PLAYER;
          const bg = isSelected ? SELECTED : sameDigit ? SAME : inWash ? WASH : 'transparent';
          // Rules: hairline everywhere, heavy on box boundaries (right of col 2/5, below row 2/5).
          const rightHeavy = c === 2 || c === 5;
          const bottomHeavy = r === 2 || r === 5;
          const notes = state.notes[i];
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              className="relative flex items-center justify-center font-black leading-none transition-colors duration-100"
              style={{
                background: bg,
                color,
                borderRight: c === 8 ? 'none' : `${rightHeavy ? 2 : 1}px solid ${rightHeavy ? HEAVY : RULE}`,
                borderBottom: r === 8 ? 'none' : `${bottomHeavy ? 2 : 1}px solid ${bottomHeavy ? HEAVY : RULE}`,
                fontSize: 'clamp(16px, 4.6vw, 24px)',
                fontWeight: given ? 900 : 800,
                padding: 0,
              }}
              role="gridcell"
              aria-selected={isSelected}
              aria-label={`Row ${r + 1} column ${c + 1}${value ? `, ${value}` : ', empty'}${given ? ', given' : ''}${wrong ? ', wrong' : ''}`}
            >
              {value ? value : notes ? (
                <span
                  className="grid w-full h-full p-[9%]"
                  style={{ gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', color: 'var(--color-text-secondary)' }}
                  aria-label={`Notes ${Array.from({ length: 9 }, (_, d) => (notes & (1 << d) ? d + 1 : null)).filter(Boolean).join(' ')}`}
                >
                  {Array.from({ length: 9 }, (_, d) => (
                    <span key={d} className="flex items-center justify-center font-bold" style={{ fontSize: 'clamp(8px, 1.9vw, 10px)' }}>
                      {notes & (1 << d) ? d + 1 : ''}
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
});
