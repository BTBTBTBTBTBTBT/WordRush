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
    <div className="flex flex-col gap-1 w-full max-w-[400px] mx-auto">
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
      {showSolution && solution && (
        <div className="mt-4 text-center text-xs font-bold" style={{ color: '#9ca3af' }}>
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
    <div className="flex gap-1 w-full">
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
        'flex-1 aspect-square border-2 flex items-center justify-center text-2xl font-black uppercase',
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
