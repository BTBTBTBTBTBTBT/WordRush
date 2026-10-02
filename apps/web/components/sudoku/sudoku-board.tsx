'use client';

import { memo } from 'react';
import type { SudokuState } from '@wordle-duel/core';

// The board (More Games §8; FINISH_SPEC B1 "the same tiles carry digits 0–9"):
// nine 3×3 boxes, each a soft frosted panel with a lilac border, holding the
// shared glossy tiles. A given is a plain light tile with a dark purple digit;
// the player's digits are purple tiles, hint digits gold, a wrong digit the
// red conflict tile; an empty cell is frosted glass. The selected cell takes a
// purple ring with its row, column and box washed lilac; every cell holding
// the selected digit gets a gold ring. Pencil marks stay the standard 3×3
// mini-grid (1 top-left … 9 bottom-right) so each digit always sits in the
// same spot. A newly placed digit swells in (B3: same as typing).

export const SUDOKU_ACCENT = '#1e40af';
/** Washes for the selection (row / column / box) and the selected cell. */
const WASH_FACE = 'rgba(221, 214, 254, 0.85)';
const SELECTED_RING = 'inset 0 0 0 3px #7c3aed';
const SAME_RING = 'inset 0 0 0 2.5px #f5a524';

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

/** The cell index at (box, slot): box 0–8 left to right, top to bottom; slot 0–8 inside it. */
const cellAt = (box: number, slot: number) => (Math.floor(box / 3) * 3 + Math.floor(slot / 3)) * 9 + (box % 3) * 3 + (slot % 3);

export const SudokuBoard = memo(function SudokuBoard({ state, selected, onSelect, revealSolution = false, maxSize = 420 }: SudokuBoardProps) {
  const selRow = selected != null ? Math.floor(selected / 9) : -1;
  const selCol = selected != null ? selected % 9 : -1;
  const selBox = selected != null ? boxOf(selected) : -1;
  const selDigit = selected != null && state.board[selected] !== '0' ? state.board[selected] : null;

  const cell = (i: number) => {
    const r = Math.floor(i / 9), c = i % 9;
    const given = state.givens[i] !== '0';
    const value = state.board[i] !== '0' ? state.board[i] : revealSolution ? state.solution[i] : '';
    const isRevealed = revealSolution && state.board[i] === '0';
    const wrong = state.wrongMask[i] === '1';
    const hinted = state.hintMask[i] === '1';
    const isSelected = i === selected;
    const inWash = r === selRow || c === selCol || boxOf(i) === selBox;
    const sameDigit = selDigit != null && value === selDigit && !isSelected;
    const notes = state.notes[i];
    const look = isRevealed ? 'gap' : !value ? 'empty' : given ? 'given' : wrong ? 'conflict' : hinted ? 'present' : 'correct';
    const vars: Record<string, string> = {};
    if (isSelected) vars['--gt-ring'] = SELECTED_RING;
    else if (sameDigit) vars['--gt-ring'] = SAME_RING;
    if (inWash && (look === 'empty' || look === 'given')) vars['--gt-face'] = WASH_FACE;
    if (isRevealed) vars['--gt-glyph'] = '#9ca3af';
    return (
      <button
        key={i}
        type="button"
        onClick={() => onSelect(i)}
        className={`gtile ${value && !given && !isRevealed ? 'gt-pop' : ''}`}
        data-s={look}
        style={{ ...(vars as React.CSSProperties), padding: 0, border: 0, fontWeight: given ? 900 : 800 }}
        role="gridcell"
        aria-selected={isSelected}
        aria-label={`Row ${r + 1} column ${c + 1}${value ? `, ${value}` : ', empty'}${given ? ', given' : ''}${wrong ? ', wrong' : ''}`}
      >
        <b>{value}</b>
        {!value && notes ? (
          <span
            className="absolute grid p-[9%]"
            style={{ inset: '0 0 7% 0', zIndex: 2, gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', color: '#8a78ad' }}
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
  };

  return (
    <div
      className="w-full mx-auto select-none"
      style={{ maxWidth: maxSize, aspectRatio: '1 / 1', ['--gt-font' as string]: `min(${Math.round(maxSize / 9 * 0.56)}px, 5.4vw)` } as React.CSSProperties}
      role="grid"
      aria-label="Sudocious board"
    >
      <div className="grid w-full h-full" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', gap: '1.6%' }}>
        {Array.from({ length: 9 }, (_, box) => (
          <div
            key={box}
            className="grid"
            style={{
              gridTemplateColumns: 'repeat(3, 1fr)',
              gridTemplateRows: 'repeat(3, 1fr)',
              gap: '4%',
              padding: '4%',
              borderRadius: 14,
              background: 'rgba(245, 238, 255, 0.55)',
              border: '2px solid rgba(124, 58, 237, 0.25)',
            }}
          >
            {Array.from({ length: 9 }, (_, slot) => cell(cellAt(box, slot)))}
          </div>
        ))}
      </div>
    </div>
  );
});
