'use client';

import { memo } from 'react';
import type { SudokuState } from '@wordle-duel/core';
import { GameTray } from '@/components/ui/game-tray';
import { traySeam } from '@/lib/game-tray';
import { trayStateFor } from '@/lib/tray-fit';

// The board (More Games §8; FINISH_SPEC B1 "the same tiles carry digits 0–9"):
// nine 3×3 boxes on the shared game tray (FINISH_SPEC L), split by soft seams,
// holding the shared glossy tiles. A given is a plain light tile with a dark purple digit;
// the player's digits are purple tiles, hint digits gold, a wrong digit the
// red conflict tile; an empty cell is frosted glass. Selection (BI6, globals.css
// `.sdk-cell[data-sdk]`): the selected cell is the solid purple tile with a deep
// ring; every other cell holding its digit a medium lavender tile with a deep
// purple digit; its row, column and box pale lavender. Pencil marks stay the
// standard 3×3 mini-grid (1 top-left … 9 bottom-right) so each digit always
// sits in the same spot; the selected digit's mark goes bold purple. A newly
// placed digit swells in (B3: same as typing).

export const SUDOKU_ACCENT = '#1e40af';

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
    const baseLook = isRevealed ? 'gap' : !value ? 'empty' : given ? 'given' : wrong ? 'conflict' : hinted ? 'present' : 'correct';
    // BI6: the selected cell becomes the solid purple tile (a wrong one stays red).
    const look = isSelected && baseLook !== 'conflict' && !isRevealed ? 'correct' : baseLook;
    const hl = isSelected ? 'sel' : sameDigit && !wrong ? 'same' : inWash ? 'wash' : undefined;
    const vars: Record<string, string> = {};
    if (isRevealed) vars['--gt-glyph'] = '#9ca3af';
    return (
      <button
        key={i}
        type="button"
        onClick={() => onSelect(i)}
        className={`gtile sdk-cell ${value && !given && !isRevealed ? 'gt-pop' : ''}`}
        data-s={look}
        data-sdk={hl}
        style={{ ...(vars as React.CSSProperties), padding: 0, border: 0, fontWeight: given ? 900 : 800 }}
        role="gridcell"
        aria-selected={isSelected}
        aria-label={`Row ${r + 1} column ${c + 1}${value ? `, ${value}` : ', empty'}${given ? ', given' : ''}${wrong ? ', wrong' : ''}`}
      >
        <b>{value}</b>
        {!value && notes ? (
          <span
            className="absolute grid p-[9%]"
            style={{ inset: '0 0 7% 0', zIndex: 2, gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', color: isSelected ? '#ffffff' : '#8a78ad' }}
            aria-label={`Notes ${Array.from({ length: 9 }, (_, d) => (notes & (1 << d) ? d + 1 : null)).filter(Boolean).join(' ')}`}
          >
            {Array.from({ length: 9 }, (_, d) => {
              // BI6: the selected digit's pencil mark goes bold purple.
              const match = selDigit === String(d + 1) && (notes & (1 << d)) !== 0;
              return (
                <span
                  key={d}
                  className="flex items-center justify-center font-bold"
                  style={match ? { fontSize: 'clamp(9px, 2.1vw, 11px)', fontWeight: 900, color: '#6d28d9' } : { fontSize: 'clamp(8px, 1.9vw, 10px)' }}
                >
                  {notes & (1 << d) ? d + 1 : ''}
                </span>
              );
            })}
          </span>
        ) : null}
      </button>
    );
  };

  // FINISH_SPEC L: the board sits on the shared game tray; the 3×3 boxes are
  // split by soft darker seams in the tray's color (traySeam), never black lines.
  const trayState = trayStateFor(state.status);
  const seam = `2px solid ${traySeam(trayState === 'won' ? '#7c3aed' : trayState === 'lost' ? '#6b7891' : SUDOKU_ACCENT, 0.4)}`;
  return (
    <GameTray accent={SUDOKU_ACCENT} state={trayState} className="w-full mx-auto" style={{ maxWidth: maxSize }}>
      <div
        className="w-full select-none"
        style={{ aspectRatio: '1 / 1', ['--gt-font' as string]: `min(${Math.round(maxSize / 9 * 0.56)}px, 5.4vw)` } as React.CSSProperties}
        role="grid"
        aria-label="Sudocious board"
      >
        <div className="grid w-full h-full" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)' }}>
          {Array.from({ length: 9 }, (_, box) => (
            <div
              key={box}
              className="grid"
              style={{
                gridTemplateColumns: 'repeat(3, 1fr)',
                gridTemplateRows: 'repeat(3, 1fr)',
                gap: '4%',
                padding: '4%',
                borderRight: box % 3 < 2 ? seam : undefined,
                borderBottom: box < 6 ? seam : undefined,
              }}
            >
              {Array.from({ length: 9 }, (_, slot) => cell(cellAt(box, slot)))}
            </div>
          ))}
        </div>
      </div>
    </GameTray>
  );
});
