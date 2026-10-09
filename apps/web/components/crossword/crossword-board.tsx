'use client';

import { memo, useRef, type CSSProperties } from 'react';
import { crosswordEntryCells, CROSSWORD_BLOCK, CROSSWORD_EMPTY, type CrosswordEntry, type CrosswordState } from '@wordle-duel/core';
import { GameTray } from '@/components/ui/game-tray';
import { cellsTurnedOn, crosswordCellLook, lockFlipDelay, trayChrome } from '@/lib/puzzle-look';
import { SOFT_INK, alphaHex, cardBarStyle, softBackground, softCard } from '@/lib/soft-surface';
import { crosswordCellFonts } from '@/lib/board-fit';

export const CROSSWORD_ACCENT = '#475569';
/** One purple look (founder, §13): every number a purple badge; nothing marks the theme. */
const PURPLE = '#7c3aed';
/** Gap between cells (px) and the tray's inner padding (px) — the game's board fit uses both. */
export const CROSSWORD_GAP = 3;
export const CROSSWORD_TRAY_PAD = 8;
/** The px the tray adds around the grid (padding + border each side, plus the lip below). */
export const CROSSWORD_TRAY_CHROME = trayChrome(CROSSWORD_TRAY_PAD);

interface BoardProps {
  state: CrosswordState;
  selected: number | null;
  activeCells: number[];
  onSelect: (cell: number) => void;
  finished: boolean;
  /** Cell side in px when the game fits the grid to its band (founder, 2026-09-28: the board was
   *  cut off behind the clue bar on a short desktop window); undefined = the 42px cap + width rule. */
  cell?: number;
}

interface CellMotion { kind: 'lock' | 'hint'; delay: number; seq: number }

/**
 * The grid, always centered (§13 round 11), on the shared game tray
 * (FINISH_SPEC L): a sparse criss-cross of B1 glossy tiles (J3); blocks are
 * simply absent (the tray shows through, no grid lines). The letter is centered
 * exactly like a Classic tile; the clue number is a small superscript inside the
 * top-left corner. Checked-right letters are purple (they turn over when a
 * Check locks them), revealed letters the hint violet (gold glow as they land),
 * wrong letters red ink + a shake; the active entry wears a lilac wash and the
 * selected cell an accent ring.
 */
export const CrosswordBoard = memo(function CrosswordBoard({ state, selected, activeCells, onSelect, finished, cell }: BoardProps) {
  const numbers = new Map<number, number>();
  for (const e of state.entries) { const start = e.r * state.w + e.c; if (!numbers.has(start)) numbers.set(start, e.n); }
  const active = new Set(activeCells);

  // Which cells just locked (a Check) or were revealed (a hint), kept per cell
  // with a sequence number that remounts the tile so each plays once; a board
  // that mounts (a restored save, the finished recap) plays nothing.
  const prevRef = useRef<{ seed: string; locked: string; revealed: string } | null>(null);
  const motionRef = useRef<Map<number, CellMotion>>(new Map());
  const seqRef = useRef(0);
  const prev = prevRef.current;
  if (!prev || prev.seed !== state.seed) {
    motionRef.current = new Map();
  } else if (prev.locked !== state.locked || prev.revealed !== state.revealed) {
    const hints = cellsTurnedOn(prev.revealed, state.revealed, (ch) => ch !== '.');
    const hinted = new Set(hints);
    const locks = cellsTurnedOn(prev.locked, state.locked, (ch) => ch === '1').filter((i) => !hinted.has(i) && state.revealed[i] === '.');
    for (const i of hints) motionRef.current.set(i, { kind: 'hint', delay: 0, seq: ++seqRef.current });
    locks.forEach((i, k) => motionRef.current.set(i, { kind: 'lock', delay: lockFlipDelay(k), seq: ++seqRef.current }));
  }
  prevRef.current = { seed: state.seed, locked: state.locked, revealed: state.revealed };
  const motions = motionRef.current;

  const chrome = CROSSWORD_TRAY_CHROME;
  const gridW = (side: number) => state.w * side + (state.w - 1) * CROSSWORD_GAP + chrome.x;
  const trayState = state.status === 'won' ? 'won' : state.status === 'lost' ? 'lost' : 'playing';
  // BI18: the letter and the clue number scale with the fitted cell (lib/board-fit.ts crosswordCellFonts).
  const fonts = cell ? crosswordCellFonts(cell) : null;
  const font = fonts ? `${fonts.letter}px` : 'clamp(12px, 3.6vw, 18px)';
  const numFont = fonts ? `${fonts.number}px` : 'clamp(7px, 1.9vw, 9px)';
  return (
    <GameTray
      accent={CROSSWORD_ACCENT}
      state={trayState}
      padding={CROSSWORD_TRAY_PAD}
      className="mx-auto shrink-0"
      style={{ width: cell ? `${gridW(cell)}px` : `min(100%, ${gridW(42)}px)`, maxWidth: '100%' }}
    >
      <div
        className="grid select-none w-full"
        style={{ gridTemplateColumns: `repeat(${state.w}, minmax(0, 1fr))`, gap: CROSSWORD_GAP }}
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
          const look = crosswordCellLook({ letter: ch, locked, revealed });
          const motion = motions.get(i);
          const flip = motion?.kind === 'lock';
          const n = numbers.get(i);
          const cls = [
            'gtile pz-cell',
            flip ? 'gt-flip' : '',
            motion?.kind === 'hint' ? 'gt-pop gt-hint' : look === 'typed' ? 'gt-pop' : '',
            wrong ? 'animate-shake' : '',
          ].filter(Boolean).join(' ');
          return (
            <button
              key={`${i}-${motion?.seq ?? 0}`}
              type="button"
              onClick={() => onSelect(i)}
              role="gridcell"
              aria-selected={isSel || undefined}
              aria-label={`${n ? `${n}, ` : ''}${ch || 'empty'}${locked ? ', locked' : ''}`}
              className={cls}
              data-s={look}
              data-wash={inActive ? 'true' : undefined}
              data-sel={isSel ? 'true' : undefined}
              data-num={n === undefined ? undefined : 'true'}
              data-wrong={wrong ? 'true' : undefined}
              style={{
                ['--gt-font' as string]: font,
                ['--pz-num' as string]: numFont,
                ['--pz-ring' as string]: CROSSWORD_ACCENT,
                ['--pz-glow' as string]: alphaHex(CROSSWORD_ACCENT, 0.35),
                ...(flip ? { ['--gt-d' as string]: `${motion.delay}ms` } : null),
              } as CSSProperties}
            >
              {n !== undefined && <span className="pz-num" aria-hidden="true">{n}</span>}
              <b>{ch}</b>
              {motion?.kind === 'hint' && <span className="gt-glow-hint" aria-hidden="true" />}
              {flip && <span className="gt-cover" aria-hidden="true"><b>{ch}</b></span>}
            </button>
          );
        })}
      </div>
    </GameTray>
  );
});

interface CluesProps {
  state: CrosswordState;
  activeEntry: CrosswordEntry | null;
  onPick: (e: CrosswordEntry) => void;
  finished: boolean;
}

/** Across and Down side by side (§13 round 10), centered under the board; solved entries dim. */
export const ClueColumns = memo(function ClueColumns({ state, activeEntry, onPick, finished }: CluesProps) {
  const col = (dir: 'A' | 'D', title: string) => (
    // A1: each clue list is a tinted card with the game-card top bar (no plain white).
    <div className="min-w-0 overflow-hidden" style={softCard(CROSSWORD_ACCENT, { radius: 14 })}>
      <div style={cardBarStyle(CROSSWORD_ACCENT)} aria-hidden />
      <div className="px-1.5 pt-1.5 pb-2">
        <h3 className="text-[10px] font-black tracking-widest uppercase mb-1 px-1" style={{ color: 'var(--color-text-muted)' }}>{title}</h3>
        <ul className="flex flex-col gap-1">
          {state.entries.filter((e) => e.dir === dir).map((e) => {
            const solved = crosswordEntryCells(state, e).every((i) => state.fill[i] === state.solution[i]);
            const isActive = activeEntry?.n === e.n && activeEntry?.dir === e.dir && !finished;
            return (
              <li key={`${e.n}${e.dir}`}>
                <button type="button" onClick={() => onPick(e)} className="flex items-start gap-1.5 text-left w-full rounded-lg px-1 py-0.5"
                  style={isActive ? { background: softBackground(PURPLE, 0.16), boxShadow: `inset 0 0 0 1.5px ${alphaHex(PURPLE, 0.35)}` } : undefined}>
                  <span className="shrink-0 rounded-md text-[10px] font-black w-5 h-5 flex items-center justify-center" style={{ background: '#ede9fe', color: PURPLE, boxShadow: `inset 0 0 0 1px #c4b5fd, inset 0 -2px 0 ${alphaHex(PURPLE, 0.2)}` }}>{e.n}</span>
                  <span className={`text-xs leading-snug ${solved ? 'line-through opacity-50' : 'font-bold'}`} style={{ color: 'var(--color-text)' }}>{e.clue}{finished ? <span className="ml-1 font-black" style={{ color: SOFT_INK.value }}>{e.answer}</span> : ''}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-x-2.5 gap-y-2 w-full max-w-[700px] mx-auto px-1">
      {col('A', 'Across')}
      {col('D', 'Down')}
    </div>
  );
});
