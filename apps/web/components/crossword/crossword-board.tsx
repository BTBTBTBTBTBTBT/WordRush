'use client';

import { memo } from 'react';
import { crosswordEntryCells, CROSSWORD_BLOCK, CROSSWORD_EMPTY, type CrosswordEntry, type CrosswordState } from '@wordle-duel/core';

export const CROSSWORD_ACCENT = '#475569';
/** One purple look (founder, §13): every cell the purple tile tint, every number a purple badge; nothing marks the theme. */
const CELL_BG = '#ede9fe', CELL_BORDER = '#c4b5fd', CELL_TEXT = '#5b21b6', PURPLE = '#7c3aed', HINT = '#8b5cf6', WRONG = '#dc2626', LOCKED_BG = '#ddd6fe';

interface BoardProps {
  state: CrosswordState;
  selected: number | null;
  activeCells: number[];
  onSelect: (cell: number) => void;
  finished: boolean;
}

/**
 * The grid, always centred (§13 round 11): a sparse criss-cross of purple tiles;
 * blocks are simply absent. The letter is centred in its cell exactly like a
 * Classic tile; the clue number is a small top-left badge that never touches
 * the letter (round 7/8). The active entry wears a 10% accent wash and the
 * selected cell an accent cursor border.
 */
export const CrosswordBoard = memo(function CrosswordBoard({ state, selected, activeCells, onSelect, finished }: BoardProps) {
  const numbers = new Map<number, number>();
  for (const e of state.entries) { const start = e.r * state.w + e.c; if (!numbers.has(start)) numbers.set(start, e.n); }
  const active = new Set(activeCells);
  return (
    <div
      className="grid select-none mx-auto"
      style={{ gridTemplateColumns: `repeat(${state.w}, minmax(0, 1fr))`, gap: 3, width: `min(100%, ${state.w * 42}px)` }}
      role="grid"
      aria-label="Crossword grid"
    >
      {Array.from({ length: state.w * state.h }, (_, i) => {
        const sol = state.solution[i];
        if (sol === CROSSWORD_BLOCK) return <span key={i} aria-hidden style={{ aspectRatio: '1' }} />;
        const ch = state.fill[i] === CROSSWORD_EMPTY ? '' : state.fill[i];
        const locked = state.locked[i] === '1';
        const revealed = state.revealed[i] !== '.';
        const isSel = selected === i && !finished;
        const inActive = active.has(i) && !finished;
        const wrong = state.lastWrong.includes(i);
        let bg = CELL_BG, border = CELL_BORDER, color = CELL_TEXT;
        if (revealed) { bg = HINT; border = HINT; color = '#fff'; }
        else if (locked) { bg = LOCKED_BG; border = PURPLE; color = PURPLE; }
        if (inActive && !revealed) { bg = `${CROSSWORD_ACCENT}1a`; }
        if (wrong) { border = WRONG; color = WRONG; }
        if (isSel) border = CROSSWORD_ACCENT;
        const n = numbers.get(i);
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            role="gridcell"
            aria-label={`${n ? `${n}, ` : ''}${ch || 'empty'}${locked ? ', locked' : ''}`}
            className={`relative rounded-md border-2 font-black flex items-center justify-center leading-none ${wrong ? 'animate-shake' : ''}`}
            style={{ aspectRatio: '1', background: bg, borderColor: border, color, fontSize: 'clamp(12px, 3.6vw, 18px)', boxShadow: isSel ? `0 0 0 2px var(--color-surface), 0 0 0 4px ${CROSSWORD_ACCENT}` : undefined }}
          >
            {n !== undefined && <span className="absolute font-black leading-none" style={{ top: 1, left: 2, fontSize: 'clamp(7px, 1.9vw, 9px)', color: revealed ? '#fff' : PURPLE }}>{n}</span>}
            {ch}
          </button>
        );
      })}
    </div>
  );
});

interface CluesProps {
  state: CrosswordState;
  activeEntry: CrosswordEntry | null;
  onPick: (e: CrosswordEntry) => void;
  finished: boolean;
}

/** Across and Down side by side (§13 round 10), centred under the board; solved entries dim. */
export const ClueColumns = memo(function ClueColumns({ state, activeEntry, onPick, finished }: CluesProps) {
  const col = (dir: 'A' | 'D', title: string) => (
    <div className="min-w-0">
      <h3 className="text-[10px] font-black tracking-widest uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>{title}</h3>
      <ul className="flex flex-col gap-1">
        {state.entries.filter((e) => e.dir === dir).map((e) => {
          const solved = crosswordEntryCells(state, e).every((i) => state.fill[i] === state.solution[i]);
          const isActive = activeEntry?.n === e.n && activeEntry?.dir === e.dir && !finished;
          return (
            <li key={`${e.n}${e.dir}`}>
              <button type="button" onClick={() => onPick(e)} className="flex items-start gap-1.5 text-left w-full rounded-md px-1 py-0.5" style={{ background: isActive ? `${CROSSWORD_ACCENT}14` : undefined }}>
                <span className="shrink-0 rounded text-[10px] font-black w-5 h-5 flex items-center justify-center" style={{ background: CELL_BG, color: PURPLE, border: `1px solid ${CELL_BORDER}` }}>{e.n}</span>
                <span className={`text-xs leading-snug ${solved ? 'line-through opacity-50' : 'font-bold'}`} style={{ color: 'var(--color-text)' }}>{e.clue}{finished ? <span className="ml-1 font-black" style={{ color: PURPLE }}>{e.answer}</span> : ''}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 w-full max-w-[700px] mx-auto px-1">
      {col('A', 'Across')}
      {col('D', 'Down')}
    </div>
  );
});
