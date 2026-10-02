'use client';

import { TileState } from '@wordle-duel/core';
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

  const getTileColor = (state: TileState) => {
    switch (state) {
      case TileState.CORRECT: return 'tile-correct';
      case TileState.PRESENT: return 'tile-present';
      case TileState.ABSENT: return 'tile-absent';
      default: return 'bg-white border-gray-300';
    }
  };

  // Show colors only for active or completed boards
  const showColors = isActive || isCompleted || isFailed;

  const allGuesses = [...board.guesses];
  if (isActive && currentGuess.length > 0 && board.guesses.length < board.maxGuesses) {
    allGuesses.push(currentGuess);
  }

  return (
    <div
      className={`relative p-1 rounded-lg border-2 transition-colors duration-300 ${tileSize ? '' : 'h-full'} flex flex-col overflow-hidden ${
        isCompleted
          ? 'border-violet-400 bg-violet-50 shadow-lg shadow-violet-500/20'
          : isFailed
          ? 'border-red-400 bg-red-50'
          : isActive
          ? 'border-yellow-400 bg-white shadow-lg shadow-yellow-500/20'
          : 'border-gray-200 bg-gray-50 opacity-60'
      }`}
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
            <div key={rowIndex} className={`grid grid-cols-5 gap-[2px] min-h-0 ${isCurrentRow && isShaking ? 'animate-shake' : ''}`} style={tileSize ? { gridTemplateColumns: `repeat(5, ${tileSize}px)` } : undefined}>
              {Array.from({ length: 5 }).map((_, letterIndex) => {
                const letter = guess[letterIndex] || '';
                const tileState = tiles[letterIndex];
                const hasLetter = letter !== '';

                return (
                  <div
                    key={letterIndex}
                    className={`
                      flex items-center justify-center min-h-0
                      border rounded font-bold text-[10px] sm:text-xs
                      ${isCurrentRow && isInvalidWord && hasLetter
                        ? 'bg-red-50 border-red-400 text-red-500'
                        : isPastGuess && showColors
                        ? `${getTileColor(tileState)} text-white`
                        : isPastGuess && !showColors
                        ? 'bg-gray-100 border-gray-300 text-gray-800'
                        : hasLetter
                        ? 'bg-white border-gray-400 text-gray-800'
                        : 'bg-white border-gray-200'
                      }
                      ${isLastSubmitted ? 'animate-tile-flip-mini' : ''}
                    `}
                    style={{ ...(isLastSubmitted ? { animationDelay: `${letterIndex * 80}ms` } : {}), ...(tileSize ? { width: tileSize, height: tileSize, fontSize: Math.max(8, Math.round(tileSize * 0.45)) } : {}) }}
                  >
                    {(showColors || isCurrentRow || (isPastGuess && !isLocked)) ? letter.toUpperCase() : isPastGuess ? '•' : ''}
                  </div>
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
