'use client';

import { TileState, GuessResult } from '@wordle-duel/core';
import { cn } from '@/lib/utils';
import { useCosmetics } from '@/lib/cosmetics/cosmetic-context';

interface BoardProps {
  guesses: string[];
  currentGuess: string;
  maxGuesses: number;
  evaluations: GuessResult[];
  solution?: string;
  showSolution?: boolean;
  darkMode?: boolean;
  isInvalidWord?: boolean;
}

export function Board({ guesses, currentGuess, maxGuesses, evaluations, solution, showSolution, darkMode, isInvalidWord }: BoardProps) {
  const emptyRows = Math.max(0, maxGuesses - guesses.length - 1);

  return (
    <div
      className="w-full max-w-[400px] mx-auto max-h-full"
      style={{ aspectRatio: `5 / ${maxGuesses}` }}
    >
      <div className="flex flex-col gap-1 h-full w-full">
        {guesses.map((guess, rowIndex) => (
          <Row
            key={rowIndex}
            guess={guess}
            evaluation={evaluations[rowIndex]}
            animate={rowIndex === guesses.length - 1 && evaluations[rowIndex]?.isCorrect === true}
          />
        ))}
        {guesses.length < maxGuesses && <Row guess={currentGuess} isInvalid={isInvalidWord} />}
        {Array.from({ length: emptyRows }).map((_, i) => (
          <Row key={`empty-${i}`} guess="" />
        ))}
      </div>
      {showSolution && solution && (
        <div className="mt-1 text-center text-xs font-bold" style={{ color: '#9ca3af' }}>
          Solution: <span className="font-black" style={{ color: '#1a1a2e' }}>{solution}</span>
        </div>
      )}
    </div>
  );
}

interface RowProps {
  guess: string;
  evaluation?: GuessResult;
  animate?: boolean;
  isInvalid?: boolean;
}

function Row({ guess, evaluation, animate, isInvalid }: RowProps) {
  const tiles = guess.padEnd(5, ' ').split('');

  return (
    <div className="flex gap-1 justify-center flex-1 min-h-0">
      {tiles.map((letter, i) => (
        <Tile
          key={i}
          letter={letter === ' ' ? '' : letter}
          state={evaluation?.tiles[i]?.state || TileState.EMPTY}
          flipDelay={animate && evaluation ? i * 150 : undefined}
          isInvalid={isInvalid && letter !== ' '}
        />
      ))}
    </div>
  );
}

interface TileProps {
  letter: string;
  state: TileState;
  flipDelay?: number;
  isInvalid?: boolean;
}

function Tile({ letter, state, flipDelay, isInvalid }: TileProps) {
  const hasFlip = flipDelay !== undefined;
  const { tileTheme } = useCosmetics();

  const colorClass = cn(
    state === TileState.EMPTY && !isInvalid && `${tileTheme.border} ${tileTheme.empty}`,
    state === TileState.EMPTY && isInvalid && 'border-red-400 bg-red-50',
    state === TileState.ABSENT && `${tileTheme.border} ${tileTheme.absent} ${tileTheme.text}`,
    state === TileState.PRESENT && `${tileTheme.present} ${tileTheme.text}`,
    state === TileState.CORRECT && `${tileTheme.correct} ${tileTheme.text}`
  );

  return (
    <div
      className={cn(
        'h-full aspect-square border-2 flex items-center justify-center text-[clamp(0.875rem,4vmin,1.5rem)] font-black uppercase',
        hasFlip ? 'animate-tile-flip' : 'transition-colors',
        colorClass,
        state === TileState.EMPTY && !isInvalid && 'text-gray-800',
        state === TileState.EMPTY && isInvalid && 'text-red-500'
      )}
      style={hasFlip ? { animationDelay: `${flipDelay}ms` } : undefined}
    >
      {letter}
    </div>
  );
}
