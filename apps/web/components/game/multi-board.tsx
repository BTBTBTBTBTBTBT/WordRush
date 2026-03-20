'use client';

import { BoardState, TileState, PrefilledGuess, evaluateGuess as coreEvaluateGuess } from '@wordle-duel/core';

interface MultiBoardProps {
  boards: BoardState[];
  currentGuess?: string;
  colorBlind?: boolean;
}

function MiniBoard({ board, index, currentGuess, colorBlind }: {
  board: BoardState;
  index: number;
  currentGuess?: string;
  colorBlind?: boolean;
}) {
  const getTileColor = (state: TileState) => {
    if (colorBlind) {
      switch (state) {
        case TileState.CORRECT: return 'bg-cyan-600 border-cyan-400';
        case TileState.PRESENT: return 'bg-orange-600 border-orange-400';
        case TileState.ABSENT: return 'bg-zinc-700 border-zinc-600';
        default: return 'bg-zinc-800 border-zinc-600';
      }
    }
    switch (state) {
      case TileState.CORRECT: return 'bg-green-600 border-green-400';
      case TileState.PRESENT: return 'bg-yellow-500 border-yellow-300';
      case TileState.ABSENT: return 'bg-zinc-700 border-zinc-600';
      default: return 'bg-zinc-800 border-zinc-600';
    }
  };

  const evaluateGuess = (guess: string, solution: string) => {
    const result: TileState[] = Array(5).fill(TileState.EMPTY);
    const solutionArray = solution.split('');
    const guessArray = guess.split('');
    const used = Array(5).fill(false);

    guessArray.forEach((letter, i) => {
      if (letter === solutionArray[i]) {
        result[i] = TileState.CORRECT;
        used[i] = true;
      }
    });

    guessArray.forEach((letter, i) => {
      if (result[i] === TileState.EMPTY) {
        const foundIndex = solutionArray.findIndex((l, idx) => l === letter && !used[idx]);
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

  const prefills = board.prefilledGuesses || [];
  const prefillCount = prefills.length;
  const totalRows = prefillCount + board.maxGuesses;

  const allGuesses = [...board.guesses];
  if (board.status === 'PLAYING' && allGuesses.length < board.maxGuesses) {
    if (currentGuess && currentGuess.length > 0) {
      allGuesses.push(currentGuess);
    }
  }

  const isWon = board.status === 'WON';
  const isLost = board.status === 'LOST';
  // The most recently submitted row — only animate flip on the winning guess
  const lastSubmittedRow = isWon && board.guesses.length > 0 ? board.guesses.length - 1 : -1;

  return (
    <div
      className={`relative p-1 rounded-lg border-2 h-full flex flex-col ${
        isWon
          ? 'border-green-400 bg-green-900/20'
          : isLost
          ? 'border-red-400 bg-red-900/20'
          : 'border-zinc-700 bg-zinc-900/50'
      }`}
    >
      {isWon && (
        <div className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center z-10">
          ✓
        </div>
      )}

      <div className="flex flex-col gap-[2px] flex-1">
        {Array.from({ length: totalRows }).map((_, rowIndex) => {
          const isPrefillRow = rowIndex < prefillCount;
          const playerRowIndex = rowIndex - prefillCount;

          if (isPrefillRow) {
            const prefill = prefills[rowIndex];
            return (
              <div key={rowIndex} className="flex gap-[2px] flex-1 opacity-75">
                {prefill.evaluation.tiles.map((tile, letterIndex) => (
                  <div
                    key={letterIndex}
                    className={`flex-1 flex items-center justify-center border rounded text-white font-bold text-[10px] sm:text-xs ${getTileColor(tile.state)}`}
                  >
                    {tile.letter.toUpperCase()}
                  </div>
                ))}
              </div>
            );
          }

          const guess = allGuesses[playerRowIndex] || '';
          const isCurrentGuess = playerRowIndex === board.guesses.length && board.status === 'PLAYING';
          const isPastGuess = playerRowIndex < board.guesses.length;
          const isLastSubmitted = isPastGuess && playerRowIndex === lastSubmittedRow;
          const tiles = isPastGuess ? evaluateGuess(guess, board.solution) : Array(5).fill(TileState.EMPTY);

          return (
            <div key={rowIndex} className="flex gap-[2px] flex-1">
              {Array.from({ length: 5 }).map((_, letterIndex) => {
                const letter = guess[letterIndex] || '';
                const tileState = isPastGuess ? tiles[letterIndex] : TileState.EMPTY;

                return (
                  <div
                    key={letterIndex}
                    className={`flex-1 flex items-center justify-center border rounded text-white font-bold text-[10px] sm:text-xs ${getTileColor(tileState)} ${
                      isLastSubmitted ? 'animate-tile-flip-mini' : ''
                    }`}
                    style={isLastSubmitted ? { animationDelay: `${letterIndex * 80}ms` } : undefined}
                  >
                    {letter.toUpperCase()}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MultiBoard({ boards, currentGuess, colorBlind }: MultiBoardProps) {
  const cols = boards.length <= 4 ? 'grid-cols-2' : 'grid-cols-4';

  return (
    <div className={`grid ${cols} gap-2 w-full h-full`}>
      {boards.map((board, index) => (
        <MiniBoard
          key={index}
          board={board}
          index={index}
          currentGuess={currentGuess}
          colorBlind={colorBlind}
        />
      ))}
    </div>
  );
}

/** Compute letter states for a single board */
function computeBoardLetterStates(
  board: BoardState
): Record<string, 'correct' | 'present' | 'absent'> {
  const states: Record<string, 'correct' | 'present' | 'absent'> = {};

  // Include prefilled guess hints
  if (board.prefilledGuesses) {
    for (const prefill of board.prefilledGuesses) {
      for (const tile of prefill.evaluation.tiles) {
        const letter = tile.letter.toUpperCase();
        if (tile.state === 'CORRECT') states[letter] = 'correct';
        else if (tile.state === 'PRESENT' && states[letter] !== 'correct') states[letter] = 'present';
        else if (tile.state === 'ABSENT' && !states[letter]) states[letter] = 'absent';
      }
    }
  }

  // Include player guess hints
  for (const guess of board.guesses) {
    const solutionArray = board.solution.toUpperCase().split('');
    const guessArray = guess.toUpperCase().split('');
    const used = Array(5).fill(false);
    const tileStates: ('CORRECT' | 'PRESENT' | 'ABSENT' | 'EMPTY')[] = Array(5).fill('EMPTY');

    guessArray.forEach((letter, i) => {
      if (letter === solutionArray[i]) {
        tileStates[i] = 'CORRECT';
        used[i] = true;
      }
    });

    guessArray.forEach((letter, i) => {
      if (tileStates[i] === 'EMPTY') {
        const f = solutionArray.findIndex((l, idx) => l === letter && !used[idx]);
        if (f !== -1) { tileStates[i] = 'PRESENT'; used[f] = true; }
        else { tileStates[i] = 'ABSENT'; }
      }
    });

    guessArray.forEach((letter, i) => {
      if (tileStates[i] === 'CORRECT') states[letter] = 'correct';
      else if (tileStates[i] === 'PRESENT' && states[letter] !== 'correct') states[letter] = 'present';
      else if (tileStates[i] === 'ABSENT' && !states[letter]) states[letter] = 'absent';
    });
  }

  return states;
}

/** Compute combined letter states from all playing boards */
export function computeActiveLetterStates(
  boards: BoardState[]
): Record<string, 'correct' | 'present' | 'absent'> {
  const states: Record<string, 'correct' | 'present' | 'absent'> = {};
  for (const board of boards) {
    if (board.status !== 'PLAYING') continue;
    const boardStates = computeBoardLetterStates(board);
    for (const [letter, state] of Object.entries(boardStates)) {
      if (state === 'correct') states[letter] = 'correct';
      else if (state === 'present' && states[letter] !== 'correct') states[letter] = 'present';
      else if (state === 'absent' && !states[letter]) states[letter] = 'absent';
    }
  }
  return states;
}

/**
 * Compute per-board letter states for quadrant keyboard display.
 * Solved boards return empty states (quadrant goes dark).
 */
export function computePerBoardLetterStates(
  boards: BoardState[]
): Record<string, 'correct' | 'present' | 'absent'>[] {
  return boards.map(board => {
    if (board.status !== 'PLAYING') return {};
    return computeBoardLetterStates(board);
  });
}
