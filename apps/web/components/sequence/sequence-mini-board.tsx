'use client';

import { TileState } from '@wordle-duel/core';
import { LetterTile, tileLook, type TileLook } from '@/components/game/letter-tile';
import { tileFontPx } from '@/lib/board-fit';
import { Lock } from 'lucide-react';

// The Succession board (solo + VS share it — VS polish §1: VS renders the
// exact board the player knows from the daily).
// Mini board for sequence mode — shows/hides colors based on active state
export function SequenceMiniBoard({
  board,
  boardIndex,
  isActive,
  isCompleted,
  isFailed,
  isLocked,
  currentGuess,
  isShaking,
  isInvalidWord, tileSize }: {
  board: { solution: string; guesses: string[]; maxGuesses: number; status: string };
  boardIndex: number;
  isActive: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  isLocked: boolean;
  currentGuess: string;
  isShaking?: boolean;
  isInvalidWord?: boolean;
  /** §255: explicit square tile edge from the measured container (see useSquareBoardFit). */
  tileSize?: number;
}) {
  const evalGuess = (guess: string, solution: string): TileState[] => {
    const result: TileState[] = Array(5).fill(TileState.EMPTY);
    const solutionArr = solution.split('');
    const guessArr = guess.split('');
    const used = Array(5).fill(false);

    guessArr.forEach((letter, i) => {
      if (letter === solutionArr[i]) {
        result[i] = TileState.CORRECT;
        used[i] = true;
      }
    });

    guessArr.forEach((letter, i) => {
      if (result[i] === TileState.EMPTY) {
        const foundIndex = solutionArr.findIndex((l, idx) => l === letter && !used[idx]);
        if (foundIndex !== -1) {
          result[i] = TileState.PRESENT;
          used[foundIndex] = true;
        } else {
          result[i] = TileState.ABSENT;
        }
      }
    });

    return result;
  };


  // Show colors only for active or completed boards
  const showColors = isActive || isCompleted || isFailed;

  const allGuesses = [...board.guesses];
  if (isActive && currentGuess.length > 0 && board.guesses.length < board.maxGuesses) {
    allGuesses.push(currentGuess);
  }

  return (
    <div
      className={`relative p-1 rounded-lg border-2 transition-colors duration-300 ${tileSize ? '' : 'h-full'} flex flex-col overflow-hidden ${!isActive && !isCompleted && !isFailed ? 'opacity-60' : ''}`}
      style={{ ...sequenceFrame({ isActive, isCompleted, isFailed }), ['--gt-font' as string]: tileSize ? `${tileFontPx(tileSize)}px` : '11px' }}
    >
      {/* Lock icon for locked boards */}
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Lock className="w-8 h-8 text-gray-300" />
        </div>
      )}

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
                const hasLetter = letter !== '';

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

      {/* Show solution on failed boards */}
      {isFailed && (
        <div className="text-center text-xs text-red-300 mt-1 font-bold">
          {board.solution.toUpperCase()}
        </div>
      )}
    </div>
  );
}

/** The board's frame (FINISH_SPEC A1, no plain white): solved purple wash, failed red wash, the active board a warm frosted wash with its gold ring, the rest frosted lavender. */
function sequenceFrame({ isActive, isCompleted, isFailed }: { isActive: boolean; isCompleted: boolean; isFailed: boolean }): React.CSSProperties {
  if (isCompleted) return { background: 'rgba(237, 228, 255, 0.82)', borderColor: '#a78bfa', boxShadow: '0 10px 15px -3px rgba(139, 92, 246, 0.2)' };
  if (isFailed) return { background: 'rgba(254, 232, 236, 0.82)', borderColor: '#f87171' };
  if (isActive) return { background: 'rgba(255, 249, 235, 0.78)', borderColor: '#facc15', boxShadow: '0 10px 15px -3px rgba(234, 179, 8, 0.2)' };
  return { background: 'rgba(245, 238, 255, 0.55)', borderColor: 'rgba(196, 181, 253, 0.5)' };
}
