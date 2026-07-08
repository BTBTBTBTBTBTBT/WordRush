'use client';

import { useState } from 'react';
import { GameStatus, TileState, type BoardState, type GauntletStageConfig, type GauntletStageResult } from '@wordle-duel/core';

// Shared compact "completed board" rendering — used by the Completed-Today
// daily card, the solo post-game recap for multi-board modes, and the VS
// result final-boards recap. Kept dependency-free (no supabase/auth imports)
// so the VS result screen can reuse it without dragging the daily card's
// data-fetching along.

export const getTileColor = (state: TileState) => {
  switch (state) {
    case TileState.CORRECT: return 'tile-correct';
    case TileState.PRESENT: return 'tile-present';
    case TileState.ABSENT: return 'tile-absent';
    case TileState.HINT_USED: return 'bg-gray-100 border-gray-200';
    default: return 'bg-white border-gray-300';
  }
};

export const evaluateGuessTiles = (guess: string, solution: string): TileState[] => {
  const len = solution.length;
  const result: TileState[] = Array(len).fill(TileState.EMPTY);
  const solutionArray = solution.split('');
  const guessArray = guess.split('');
  const used = Array(len).fill(false);

  guessArray.forEach((letter, i) => {
    if (letter === solutionArray[i]) { result[i] = TileState.CORRECT; used[i] = true; }
  });
  guessArray.forEach((letter, i) => {
    if (result[i] === TileState.EMPTY) {
      const f = solutionArray.findIndex((l, idx) => l === letter && !used[idx]);
      if (f !== -1) { result[i] = TileState.PRESENT; used[f] = true; }
      else { result[i] = TileState.ABSENT; }
    }
  });
  return result;
};

// ── Compact mini board for multi-board completed view ──
// Uses a FIXED tile size (px) rather than aspect-ratio + auto rows. The latter
// let empty rows collapse to ~0 height on some layout passes, so boards with
// fewer guesses rendered shorter than their neighbours (the "wonky"/uneven
// grid). A definite tile size makes every board the same height = crisp grid,
// mirroring the native CompletedMiniBoardView.
export function CompletedMiniBoard({ solution, guesses, maxGuesses, won, hintEvaluations, tileSize = 16 }: {
  solution: string;
  guesses: string[];
  maxGuesses: number;
  hintEvaluations?: Record<number, import('@wordle-duel/core').GuessResult>;
  won: boolean;
  tileSize?: number;
}) {
  const wordLen = solution.length;
  const fontSize = Math.max(6, Math.round(tileSize * 0.5));
  return (
    <div className={`relative p-0.5 rounded-lg border-2 ${
      won ? 'border-violet-400 bg-violet-50' : 'border-red-400 bg-red-50'
    }`}>
      {won && (
        <div className="absolute -top-1.5 -right-1.5 bg-violet-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center z-10">
          ✓
        </div>
      )}
      <div
        className="grid gap-[1px]"
        style={{
          gridTemplateColumns: `repeat(${wordLen}, ${tileSize}px)`,
          gridTemplateRows: `repeat(${maxGuesses}, ${tileSize}px)`,
        }}
      >
        {Array.from({ length: maxGuesses }).flatMap((_, rowIndex) => {
          const guess = guesses[rowIndex] || '';
          const isPast = rowIndex < guesses.length;
          const tiles = isPast
            ? (hintEvaluations?.[rowIndex]
                ? hintEvaluations[rowIndex].tiles.map(t => t.state)
                : evaluateGuessTiles(guess, solution))
            : Array(wordLen).fill(TileState.EMPTY);

          // Hint rows: take the letter from the evaluation tiles (letter +
          // state travel together) so a left-aligned stored hint guess can't
          // render its letter at slot 0 while the color sits at the real slot.
          const heTiles = isPast ? hintEvaluations?.[rowIndex]?.tiles : undefined;
          return Array.from({ length: wordLen }).map((_, li) => {
            const letter = (heTiles ? (heTiles[li]?.letter ?? '').trim() : guess[li]) || '';
            const tileState = isPast ? tiles[li] : TileState.EMPTY;
            return (
              <div
                key={`${rowIndex}-${li}`}
                className={`flex items-center justify-center border rounded font-bold leading-none ${
                  tileState === TileState.EMPTY ? 'text-gray-800' : 'text-white'
                } ${getTileColor(tileState)}`}
                style={{ width: tileSize, height: tileSize, fontSize }}
              >
                {letter.toUpperCase()}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}

/** Minimal board shape the recap grid needs — BoardState satisfies it via
 *  {@link toRecapBoards}; the VS legacy rebuild produces it directly. */
export interface RecapBoard {
  solution: string;
  guesses: string[];
  maxGuesses: number;
  won: boolean;
}

export function toRecapBoards(boards: BoardState[]): RecapBoard[] {
  return boards.map(b => ({
    solution: b.solution,
    guesses: b.guesses,
    maxGuesses: b.maxGuesses,
    won: b.status === GameStatus.WON,
  }));
}

/**
 * Compact uniform recap grid (completed-daily-board sizing) — every board
 * visible with its solved/failed frame. Used for finished multi-board games
 * (solo post-game + VS result), replacing the zoomed in-play layout, which
 * rendered 2-column modes (QuadWord/Deliverance) huge while OctoWord's four
 * columns looked right.
 */
export function CompletedBoardsRecap({ boards, rowCount }: { boards: RecapBoard[]; rowCount?: number }) {
  const totalBoards = boards.length;
  return (
    <div
      className="mx-auto flex flex-wrap justify-center gap-2 pt-2"
      style={{ maxWidth: totalBoards > 4 ? 'min(320px, 100%)' : '240px' }}
    >
      {boards.map((board, i) => (
        <CompletedMiniBoard
          key={i}
          solution={board.solution}
          guesses={board.guesses}
          maxGuesses={rowCount ?? board.maxGuesses}
          won={board.won}
          tileSize={totalBoards > 4 ? 12 : 20}
        />
      ))}
    </div>
  );
}

export function GauntletStageMiniBoards({ boards, maxGuesses }: { boards: BoardState[]; maxGuesses: number }) {
  const n = boards.length;
  // Fixed tile size keeps every board the same height (crisp, uniform) and
  // scales down as the board count grows so the row still fits.
  const tileSize = n === 1 ? 22 : n <= 4 ? 16 : 11;
  const maxW = n === 1 ? '160px' : n <= 4 ? '240px' : '320px';
  return (
    <div className="mx-auto flex flex-wrap justify-center gap-1.5 pt-2" style={{ maxWidth: maxW }}>
      {boards.map((board, i) => (
        <CompletedMiniBoard
          key={i}
          solution={board.solution}
          guesses={board.guesses}
          maxGuesses={maxGuesses}
          won={board.status === GameStatus.WON}
          tileSize={tileSize}
        />
      ))}
    </div>
  );
}

/**
 * Gauntlet stage-by-stage review — 3-stat summary (Stages / Guesses / Time) +
 * per-stage won/lost rows with tap-to-expand final boards. Shared by the
 * Completed-Today daily card and the VS result screen (which reconstructs each
 * player's run from the seed + flat guess list).
 */
export function GauntletStageBreakdown({
  stages, stageResults, stagesCleared, totalGuesses, totalTimeMs,
}: {
  stages: GauntletStageConfig[];
  stageResults: GauntletStageResult[];
  stagesCleared: number;
  totalGuesses: number;
  totalTimeMs: number;
}) {
  const [expandedStage, setExpandedStage] = useState<number | null>(null);

  const fmtTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <>
      {/* Summary stats */}
      <div className="flex justify-center gap-5 mb-3">
        <div className="text-center">
          <div className="text-sm font-black" style={{ color: 'var(--color-text)' }}>
            {stagesCleared}/5
          </div>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Stages
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm font-black" style={{ color: 'var(--color-text)' }}>
            {totalGuesses}
          </div>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Guesses
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm font-black" style={{ color: 'var(--color-text)' }}>
            {fmtTime(totalTimeMs)}
          </div>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Time
          </div>
        </div>
      </div>

      {/* Compact stage rows */}
      <div className="space-y-1">
        {stages.map((stage, i) => {
          const result = stageResults.find(r => r.stageIndex === i);
          if (!result) return null;
          const stageWon = result.status === GameStatus.WON;
          const hasBoards = !!result.boardsSnapshot?.length;
          const isExpanded = expandedStage === i;

          return (
            <div key={i}>
              <button
                type="button"
                onClick={() => hasBoards && setExpandedStage(isExpanded ? null : i)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors"
                style={{
                  background: stageWon ? '#f5f3ff' : '#fef2f2',
                  border: `1px solid ${stageWon ? '#ddd6fe' : '#fecaca'}`,
                  cursor: hasBoards ? 'pointer' : 'default',
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black"
                    style={{
                      background: stageWon ? '#f5f3ff' : '#fee2e2',
                      color: stageWon ? '#7c3aed' : '#dc2626',
                    }}
                  >
                    {stageWon ? '✓' : '✗'}
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: 'var(--color-text)' }}>
                    {stage.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                    {result.guesses}g · {fmtTime(result.timeMs)}
                  </span>
                  {hasBoards && (
                    <span
                      className="text-[8px] transition-transform"
                      style={{
                        color: 'var(--color-text-muted)',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    >
                      ▼
                    </span>
                  )}
                </div>
              </button>
              {isExpanded && hasBoards && (
                <div className="px-1 pt-1.5 pb-1">
                  <GauntletStageMiniBoards
                    boards={result.boardsSnapshot!}
                    maxGuesses={stage.maxGuesses}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
