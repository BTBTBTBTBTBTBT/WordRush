'use client';

import { TileState } from '@wordle-duel/core';
import { LetterTile, tileLook, type TileLook } from '@/components/game/letter-tile';
import { tileFontPx } from '@/lib/board-fit';
import { miniBoardFrame } from '@/components/game/multi-board';
import { modeTrayAccent } from '@/lib/tray-fit';
import { accentInk } from '@/lib/soft-surface';

/** The failed board's answer: red, legible on the light and the dark tray. */
const FAILED_INK = accentInk('#dc2626', '#dc2626');

// The Gauntlet Succession-stage board (solo + VS share it — VS polish §1).
// Mini board for sequence stages in gauntlet — 2x2 grid with sequential unlock
export function GauntletSequenceMiniBoard({
  board,
  boardIndex,
  isActive,
  isCompleted,
  isFailed,
  isLocked,
  currentGuess,
  isShaking,
  isInvalidWord,
  tileSize,
  accent = modeTrayAccent('GAUNTLET'),
}: {
  board: { solution: string; guesses: string[]; maxGuesses: number; status: string };
  /** §255: explicit square tile edge from the measured stage area. */
  tileSize?: number;
  boardIndex: number;
  isActive: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  isLocked: boolean;
  currentGuess: string;
  isShaking?: boolean;
  isInvalidWord?: boolean;
  /** The game's accent for the tray (FINISH_SPEC L). */
  accent?: string;
}) {
  const evalGuess = (guess: string, solution: string): TileState[] => {
    const result: TileState[] = Array(5).fill(TileState.EMPTY);
    const solutionArr = solution.split('');
    const guessArr = guess.split('');
    const used = Array(5).fill(false);

    guessArr.forEach((letter, i) => {
      if (letter === solutionArr[i]) { result[i] = TileState.CORRECT; used[i] = true; }
    });
    guessArr.forEach((letter, i) => {
      if (result[i] === TileState.EMPTY) {
        const f = solutionArr.findIndex((l, idx) => l === letter && !used[idx]);
        if (f !== -1) { result[i] = TileState.PRESENT; used[f] = true; }
        else { result[i] = TileState.ABSENT; }
      }
    });
    return result;
  };


  const showColors = isActive || isCompleted || isFailed;

  const allGuesses = [...board.guesses];
  if (isActive && currentGuess.length > 0 && board.guesses.length < board.maxGuesses) {
    allGuesses.push(currentGuess);
  }

  return (
    <div
      className={`relative ${tileSize ? '' : 'h-full'} flex flex-col transition-colors duration-300 overflow-hidden ${!isActive && !isCompleted && !isFailed ? 'opacity-60' : ''}`}
      style={{ ...miniBoardFrame(isCompleted ? 'WON' : isFailed ? 'LOST' : 'PLAYING', accent, { active: isActive && !isCompleted && !isFailed }), ['--gt-font' as string]: tileSize ? `${tileFontPx(tileSize)}px` : '11px' }}
    >
      <div className={tileSize ? 'grid gap-[2px]' : 'grid gap-[2px] flex-1'} style={{ gridTemplateRows: `repeat(${board.maxGuesses}, ${tileSize ? `${tileSize}px` : '1fr'})` }}>
        {Array.from({ length: board.maxGuesses }).map((_, rowIndex) => {
          const guess = allGuesses[rowIndex] || '';
          const isPastGuess = rowIndex < board.guesses.length;
          const isCurrentRow = rowIndex === board.guesses.length && isActive;
          const isLastSubmitted = isPastGuess && rowIndex === board.guesses.length - 1 && showColors;
          const tiles = isPastGuess && showColors
            ? evalGuess(guess, board.solution)
            : Array(5).fill(TileState.EMPTY);

          return (
            <div key={rowIndex} className={`grid grid-cols-5 gap-[2px] min-h-0 ${isCurrentRow && isShaking ? 'gt-nudge' : ''}`} style={tileSize ? { gridTemplateColumns: `repeat(5, ${tileSize}px)` } : undefined}>
              {Array.from({ length: 5 }).map((_, letterIndex) => {
                const letter = guess[letterIndex] || '';
                const tileState = tiles[letterIndex];

                const look: TileLook = isPastGuess && showColors
                  ? tileLook(tileState, letter)
                  : isPastGuess
                  ? 'given'
                  : letter ? 'typed' : 'empty';
                const shown = (showColors || isCurrentRow || (isPastGuess && !isLocked)) ? letter.toUpperCase() : isPastGuess ? '•' : '';

                return (
                  <LetterTile
                    key={letterIndex}
                    letter={shown}
                    look={look}
                    flipIndex={isLastSubmitted ? letterIndex : undefined}
                    mini
                    bad={!!isShaking && isCurrentRow && !!letter}
                    outIndex={4 - letterIndex}
                    invalid={isCurrentRow && !!isInvalidWord && !!letter}
                    className="min-h-0"
                    style={tileSize ? { width: tileSize, height: tileSize } : { aspectRatio: 'auto' }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {isFailed && (
        <div className={`text-center text-xs mt-1 font-bold ${FAILED_INK.className}`} style={FAILED_INK.style}>
          {board.solution.toUpperCase()}
        </div>
      )}
    </div>
  );
}
