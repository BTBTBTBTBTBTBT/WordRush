'use client';

import { TileState, GuessResult } from '@wordle-duel/core';
import { cn } from '@/lib/utils';

interface BoardProps {
  guesses: string[];
  currentGuess: string;
  maxGuesses: number;
  evaluations: GuessResult[];
  solution?: string;
  showSolution?: boolean;
}

export function Board({ guesses, currentGuess, maxGuesses, evaluations, solution, showSolution }: BoardProps) {
  const emptyRows = Math.max(0, maxGuesses - guesses.length - 1);

  return (
    <div className="flex flex-col gap-1 w-full max-w-[400px] mx-auto">
      {guesses.map((guess, rowIndex) => (
        <Row key={rowIndex} guess={guess} evaluation={evaluations[rowIndex]} />
      ))}
      {guesses.length < maxGuesses && <Row guess={currentGuess} />}
      {Array.from({ length: emptyRows }).map((_, i) => (
        <Row key={`empty-${i}`} guess="" />
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
}

function Row({ guess, evaluation }: RowProps) {
  const tiles = guess.padEnd(5, ' ').split('');

  return (
    <div className="flex gap-1 w-full">
      {tiles.map((letter, i) => (
        <Tile
          key={i}
          letter={letter === ' ' ? '' : letter}
          state={evaluation?.tiles[i]?.state || TileState.EMPTY}
        />
      ))}
    </div>
  );
}

interface TileProps {
  letter: string;
  state: TileState;
}

function Tile({ letter, state }: TileProps) {
  return (
    <div
      className={cn(
        'flex-1 aspect-square border-2 flex items-center justify-center text-2xl font-bold uppercase transition-colors',
        state === TileState.EMPTY && 'border-border bg-background',
        state === TileState.ABSENT && 'border-zinc-600 bg-zinc-700 text-white',
        state === TileState.PRESENT && 'border-yellow-600 bg-yellow-600 text-white',
        state === TileState.CORRECT && 'border-green-600 bg-green-600 text-white'
      )}
    >
      {letter}
    </div>
  );
}
