'use client';

import { TileState, GuessResult } from '@wordle-duel/core';
import { cn } from '@/lib/utils';
import { LetterTile, tileLook } from '@/components/game/letter-tile';
import { tileFontPx } from '@/lib/board-fit';

// The word board (docs/FINISH_SPEC.md B1 + B3): every tile is the shared glossy
// LetterTile — frosted empty rows, typed tiles that swell in, a reveal that
// turns each tile over (720 ms, 300 ms apart) with the color swapping at the
// half and a soft glow on landing, a nudge + red glow for a word that isn't
// one, a hop wave on the winning row and a wobble-and-sink when the guesses
// run out. Colors flow from the CSS state ramps (colorblind mode included).

interface BoardProps {
  guesses: string[];
  currentGuess: string;
  maxGuesses: number;
  evaluations: GuessResult[];
  solution?: string;
  showSolution?: boolean;
  darkMode?: boolean;
  isInvalidWord?: boolean;
  isShaking?: boolean;
  wordLength?: number;
  /** Explicit pixel size (from a measured container — hooks/use-board-fit.ts,
   *  the shared B5 rule). iOS Safari fails to clamp percentage max-height on
   *  aspect-ratio boxes inside flex chains — callers that must fit a bounded
   *  area measure it and pass exact pixels, which resolve on every browser. */
  sizePx?: { w: number; h: number };
  /** Gap between tiles in px when sized (the fit's gap). */
  gap?: number;
  /** Rows that are hint rows (Six / Seven): their revealed letter flips in with the gold hint glow (B3). */
  hintRows?: readonly number[];
}

export function Board({ guesses, currentGuess, maxGuesses, evaluations, solution, showSolution, isInvalidWord, isShaking, wordLength = 5, sizePx, gap = 5, hintRows }: BoardProps) {
  const emptyRows = Math.max(0, maxGuesses - guesses.length - 1);

  const lastEval = evaluations[evaluations.length - 1];
  const lastGuess = guesses[guesses.length - 1];
  const announcement = lastEval && lastGuess
    ? lastEval.isCorrect
      ? `${lastGuess}, correct!`
      : lastEval.tiles.map(t => `${t.letter} ${TILE_STATE_LABEL[t.state] || 'empty'}`).join(', ')
    : '';
  const won = !!lastEval?.isCorrect;
  const lost = !won && guesses.length >= maxGuesses && evaluations.length >= maxGuesses;

  // Sized: square tiles of an exact px edge, so the glyph can follow the tile.
  const tile = sizePx ? Math.max(1, (sizePx.w - gap * (wordLength - 1)) / wordLength) : null;
  const sizedStyle = tile != null
    ? { width: sizePx!.w, height: sizePx!.h, ['--gt-font' as string]: `${tileFontPx(tile)}px` }
    : { aspectRatio: `${wordLength} / ${maxGuesses}` };
  const rowGap = tile != null ? gap : 4;

  return (
    <div
      className={sizePx ? 'mx-auto' : 'w-full max-w-[400px] mx-auto max-h-full'}
      style={sizedStyle as React.CSSProperties}
      role="grid"
      aria-label="Game board"
    >
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
      <div className="flex flex-col h-full w-full" style={{ gap: rowGap }}>
        {guesses.map((guess, rowIndex) => {
          const isLast = rowIndex === guesses.length - 1;
          return (
            <Row
              key={rowIndex}
              guess={guess}
              evaluation={evaluations[rowIndex]}
              animate={isLast && !!evaluations[rowIndex]}
              hop={isLast && won}
              sink={isLast && lost}
              hint={isLast && !!hintRows?.includes(rowIndex)}
              wordLength={wordLength}
              gap={rowGap}
            />
          );
        })}
        {guesses.length < maxGuesses && <Row guess={currentGuess} isInvalid={isInvalidWord} isShaking={isShaking} wordLength={wordLength} gap={rowGap} />}
        {Array.from({ length: emptyRows }).map((_, i) => (
          <Row key={`empty-${i}`} guess="" wordLength={wordLength} gap={rowGap} />
        ))}
      </div>
      {showSolution && solution && (
        <div className="mt-1 text-center text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
          Solution: <span className="font-black" style={{ color: 'var(--color-text)' }}>{solution}</span>
        </div>
      )}
    </div>
  );
}

interface RowProps {
  guess: string;
  evaluation?: GuessResult;
  animate?: boolean;
  hint?: boolean;
  hop?: boolean;
  sink?: boolean;
  isInvalid?: boolean;
  isShaking?: boolean;
  wordLength?: number;
  gap: number;
}

function Row({ guess, evaluation, animate, hint, hop, sink, isInvalid, isShaking, wordLength = 5, gap }: RowProps) {
  const tiles = guess.padEnd(wordLength, ' ').split('');

  return (
    <div className={cn('flex justify-center flex-1 min-h-0', isShaking && 'gt-nudge')} style={{ gap }} role="row">
      {tiles.map((ch, i) => {
        const letter = ch === ' ' ? '' : ch;
        const state = evaluation?.tiles[i]?.state || TileState.EMPTY;
        return (
          <LetterTile
            key={i}
            letter={letter}
            look={tileLook(state, letter)}
            flipIndex={animate && evaluation ? i : undefined}
            hopIndex={hop ? i : undefined}
            rowLength={wordLength}
            sink={sink}
            hint={!!hint && state === TileState.CORRECT}
            bad={!!isShaking && !!letter}
            outIndex={wordLength - 1 - i}
            invalid={!!isInvalid && !!letter}
            className="h-full"
            role="gridcell"
            aria-label={letter ? `${letter}, ${TILE_STATE_LABEL[state] || 'empty'}` : 'empty'}
          />
        );
      })}
    </div>
  );
}

const TILE_STATE_LABEL: Record<string, string> = {
  [TileState.EMPTY]: 'empty',
  [TileState.ABSENT]: 'absent',
  [TileState.PRESENT]: 'present in word',
  [TileState.CORRECT]: 'correct position',
  [TileState.HINT_USED]: 'hint',
};
