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
}

export function Board({ guesses, currentGuess, maxGuesses, evaluations, solution, showSolution, darkMode }: BoardProps) {
  const emptyRows = Math.max(0, maxGuesses - guesses.length - 1);

  return (
    <div className="flex flex-col gap-1 w-full max-w-[400px] mx-auto">
      {guesses.map((guess, rowIndex) => (
        <Row
          key={rowIndex}
          guess={guess}
          evaluation={evaluations[rowIndex]}
          darkMode={darkMode}
          animate={rowIndex === guesses.length - 1 && evaluations[rowIndex]?.isCorrect === true}
        />
      ))}
      {guesses.length < maxGuesses && <Row guess={currentGuess} darkMode={darkMode} />}
      {Array.from({ length: emptyRows }).map((_, i) => (
        <Row key={`empty-${i}`} guess="" darkMode={darkMode} />
      ))}
      {showSolution && solution && (
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Solution: <span className="font-bold">{solution}</span>
        </div>
      )}
    </div>
  );
}

interface RowProps {
  guess: string;
  evaluation?: GuessResult;
  darkMode?: boolean;
  animate?: boolean;
}

function Row({ guess, evaluation, darkMode, animate }: RowProps) {
  const tiles = guess.padEnd(5, ' ').split('');

  return (
    <div className="flex gap-1 w-full">
      {tiles.map((letter, i) => (
        <Tile
          key={i}
          letter={letter === ' ' ? '' : letter}
          state={evaluation?.tiles[i]?.state || TileState.EMPTY}
          darkMode={darkMode}
          flipDelay={animate && evaluation ? i * 150 : undefined}
        />
      ))}
    </div>
  );
}

interface TileProps {
  letter: string;
  state: TileState;
  darkMode?: boolean;
  flipDelay?: number;
}

function Tile({ letter, state, darkMode, flipDelay }: TileProps) {
  const hasFlip = flipDelay !== undefined;
  const { tileTheme } = useCosmetics();

  const colorClass = cn(
    state === TileState.EMPTY && (darkMode ? `border-white/30 ${tileTheme.empty} text-white` : `${tileTheme.border} ${tileTheme.empty}`),
    state === TileState.ABSENT && `${tileTheme.border} ${tileTheme.absent} ${tileTheme.text}`,
    state === TileState.PRESENT && `${tileTheme.present} ${tileTheme.text}`,
    state === TileState.CORRECT && `${tileTheme.correct} ${tileTheme.text}`
  );

  return (
    <div
      className={cn(
        'flex-1 aspect-square border-2 flex items-center justify-center text-2xl font-bold uppercase',
        hasFlip ? 'animate-tile-flip' : 'transition-colors',
        colorClass
      )}
      style={hasFlip ? { animationDelay: `${flipDelay}ms` } : undefined}
    >
      {letter}
    </div>
  );
}
