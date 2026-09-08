'use client';

import { memo, useState, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import { BoardState, TileState, PrefilledGuess, evaluateGuess as coreEvaluateGuess } from '@wordle-duel/core';

interface MultiBoardProps {
  boards: BoardState[];
  currentGuess?: string;
  colorBlind?: boolean;
  isInvalidWord?: boolean;
  isShaking?: boolean;
}

const getTileColor = (state: TileState, colorBlind?: boolean) => {
  // Colorblind palette flows through the .tile-* CSS vars ([data-colorblind]).
  switch (state) {
    case TileState.CORRECT: return 'tile-correct';
    case TileState.PRESENT: return 'tile-present';
    case TileState.ABSENT: return 'tile-absent';
    default: return 'bg-white border-gray-300';
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

/**
 * Spoken description of one submitted row: the word, then each letter's
 * result. A screen-reader user gets no information at all from the tile
 * COLOURS, which is the entire feedback mechanism of the game — without this
 * the multi-board modes are unplayable rather than merely awkward.
 */
function describeRow(letters: string, tiles: TileState[]): string {
  const parts = tiles.map((t, i) => {
    const ch = letters[i]?.toUpperCase() ?? '';
    switch (t) {
      case TileState.CORRECT: return `${ch} correct`;
      case TileState.PRESENT: return `${ch} wrong position`;
      case TileState.HINT_USED: return `${ch} revealed`;
      default: return `${ch} not in word`;
    }
  });
  return `${letters.toUpperCase()}: ${parts.join(', ')}`;
}

/** "Board 3 of 8, solved in 4 guesses" — announced when the board is focused. */
function describeBoard(board: { status: string; guesses: string[]; maxGuesses: number },
                       index: number, total: number): string {
  const used = board.guesses.length;
  if (board.status === 'WON') return `Board ${index + 1} of ${total}, solved in ${used} ${used === 1 ? 'guess' : 'guesses'}`;
  if (board.status === 'LOST') return `Board ${index + 1} of ${total}, not solved`;
  return `Board ${index + 1} of ${total}, ${used} of ${board.maxGuesses} guesses used`;
}

// Memoized MiniBoard — only re-renders when its own board data or currentGuess changes
const MiniBoard = memo(function MiniBoard({ board, index, currentGuess, colorBlind, onClick, isExpanded, invisible, isInvalidWord, isShaking, ariaLabel, tileSize }: {
  board: BoardState;
  /** §255: explicit SQUARE tile size in px (from the measured container).
   *  Without it the board stretches to fill its grid cell, and on a wide
   *  viewport the tiles turn into flat bars — the "compressed looking mess"
   *  the founder saw on QuadWord/OctoWord. The expanded OctoWord overlay
   *  omits it and keeps the stretch behaviour. */
  tileSize?: number;
  index: number;
  currentGuess?: string;
  colorBlind?: boolean;
  onClick?: () => void;
  isExpanded?: boolean;
  invisible?: boolean;
  isInvalidWord?: boolean;
  isShaking?: boolean;
  ariaLabel?: string;
}) {
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
  // Flip the most recently submitted row on EVERY guess (parity with Succession /
  // Gauntlet / single-board), not only the winning row.
  const lastSubmittedRow = board.guesses.length > 0 ? board.guesses.length - 1 : -1;

  // In expanded mode, show larger text
  const textSize = isExpanded ? 'text-base sm:text-lg' : 'text-[10px] sm:text-xs';
  const fixed = tileSize != null;
  const tileStyle = fixed ? { width: tileSize, height: tileSize, fontSize: Math.max(8, Math.round(tileSize! * 0.45)) } : undefined;
  const rowStyle = fixed ? { gridTemplateColumns: `repeat(5, ${tileSize}px)` } : undefined;

  return (
    <div
      onClick={onClick}
      // A clickable div is invisible to assistive tech AND unreachable by
      // keyboard. Give it a button role and Enter/Space handling only when it
      // is genuinely interactive (OctoWord's tap-to-expand); a non-clickable
      // board stays a plain group so it isn't announced as actionable.
      role={onClick ? 'button' : 'group'}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      } : undefined}
      aria-label={ariaLabel}
      className={`relative p-1 rounded-lg border-2 ${fixed ? '' : 'h-full'} flex flex-col ${
        onClick ? 'cursor-pointer' : ''
      } ${
        invisible ? 'invisible' : ''
      } ${
        isWon
          ? 'border-violet-400 bg-violet-50'
          : isLost
          ? 'border-red-400 bg-red-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      {isWon && (
        <div className="absolute -top-1.5 -right-1.5 bg-violet-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center z-10">
          ✓
        </div>
      )}

      <div className={fixed ? 'grid gap-[2px]' : 'grid gap-[2px] flex-1'} style={{ gridTemplateRows: `repeat(${totalRows}, ${fixed ? `${tileSize}px` : '1fr'})` }}>
        {Array.from({ length: totalRows }).map((_, rowIndex) => {
          const isPrefillRow = rowIndex < prefillCount;
          const playerRowIndex = rowIndex - prefillCount;

          if (isPrefillRow) {
            const prefill = prefills[rowIndex];
            return (
              <div
                key={rowIndex}
                role="img"
                aria-label={`Given clue, ${describeRow(
                  prefill.evaluation.tiles.map((t) => t.letter).join(String()),
                  prefill.evaluation.tiles.map((t) => t.state),
                )}`}
                className="grid grid-cols-5 gap-[2px] min-h-0 opacity-75"
                style={rowStyle}
              >
                {prefill.evaluation.tiles.map((tile, letterIndex) => (
                  <div
                    key={letterIndex}
                    className={`flex items-center justify-center min-h-0 border rounded font-bold ${textSize} ${tile.state === TileState.EMPTY ? 'text-gray-800' : 'text-white'} ${getTileColor(tile.state, colorBlind)}`}
                    style={tileStyle}
                  >
                    {tile.letter.toUpperCase()}
                  </div>
                ))}
              </div>
            );
          }

          const guess = allGuesses[playerRowIndex] || '';
          const isPastGuess = playerRowIndex < board.guesses.length;
          const isCurrentRow = !isPastGuess && guess.length > 0 && playerRowIndex === board.guesses.length;
          const isLastSubmitted = isPastGuess && playerRowIndex === lastSubmittedRow;
          const tiles = isPastGuess ? evaluateGuess(guess, board.solution) : Array(5).fill(TileState.EMPTY);

          return (
            <div
              key={rowIndex}
              role={isPastGuess ? 'img' : undefined}
              aria-label={isPastGuess ? describeRow(guess, tiles as TileState[]) : undefined}
              className={`grid grid-cols-5 gap-[2px] min-h-0 ${isCurrentRow && isShaking ? 'animate-shake' : ''}`}
              style={rowStyle}
            >
              {Array.from({ length: 5 }).map((_, letterIndex) => {
                const letter = guess[letterIndex] || '';
                const tileState = isPastGuess ? tiles[letterIndex] : TileState.EMPTY;
                const isInvalidTile = isCurrentRow && isInvalidWord && letter !== '';

                return (
                  <div
                    key={letterIndex}
                    className={`flex items-center justify-center min-h-0 border rounded font-bold ${textSize} ${
                      isInvalidTile
                        ? 'text-red-500 bg-red-50 border-red-400'
                        : tileState === TileState.EMPTY ? 'text-gray-800' : 'text-white'
                    } ${!isInvalidTile ? getTileColor(tileState, colorBlind) : ''} ${
                      isLastSubmitted ? 'animate-tile-flip-mini' : ''
                    }`}
                    style={{ ...(isLastSubmitted ? { animationDelay: `${letterIndex * 80}ms` } : {}), ...(tileStyle ?? {}) }}
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
});

export function MultiBoard({ boards, currentGuess, colorBlind, isInvalidWord, isShaking }: MultiBoardProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [sourceRect, setSourceRect] = useState<DOMRect | null>(null);
  const boardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const isOctordle = boards.length > 4;
  const cols = isOctordle ? 'grid-cols-4' : 'grid-cols-2';

  // §255 (founder: "the quadword board looks awful… not this compressed
  // looking mess"; "octoword needs work too"): each MiniBoard filled its grid
  // cell and its tiles split that cell 5-across, so on a wide viewport the
  // tiles became long flat bars. The natives size SQUARE tiles to fit the
  // space. Measure the container and derive one tile size that fits both
  // dimensions — capped so desktop doesn't balloon — then lay the boards out
  // at that size, centred. Falls back to the stretch layout until measured.
  const maxRows = boards.reduce((m, b) => Math.max(m, (b.prefilledGuesses?.length ?? 0) + b.maxGuesses), 1);
  // Founder, second pass: "the keyboards look so much bigger and the puzzles
  // all look very small." On a wide window the 2x2 QuadWord layout stacks 18
  // tile-rows into the height while leaving the width empty. So try every
  // sensible arrangement (2-across, 4-across, all-in-a-row) and keep whichever
  // yields the LARGEST square tile — QuadWord goes 4x1 on a desktop, 2x2 on a
  // phone; OctoWord stays 4x2 (8-across would need ~1900px).
  const [fitState, setFitState] = useState<{ tile: number; cols: number } | null>(null);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const GAP = 8, PAD = 12, TG = 2, CAP = 56;   // board gap, p-1+border-2 both sides, tile gap, max tile
    const n = boards.length;
    const candidates = [...new Set([2, 4, n].filter((c) => c >= 1 && c <= n))];
    const fit = () => {
      const r = el.getBoundingClientRect();
      let best: { tile: number; cols: number } | null = null;
      for (const c of candidates) {
        const rows = Math.ceil(n / c);
        const byW = ((r.width - (c - 1) * GAP) / c - PAD - 4 * TG) / 5;
        const byH = ((r.height - (rows - 1) * GAP) / rows - PAD - (maxRows - 1) * TG) / maxRows;
        const t = Math.floor(Math.min(byW, byH, CAP));
        if (t >= 10 && (!best || t > best.tile)) best = { tile: t, cols: c };
      }
      setFitState(best);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [boards.length, maxRows]);
  const tile = fitState?.tile ?? null;
  const gridCols = fitState?.cols ?? (isOctordle ? 4 : 2);
  const boardW = tile ? tile * 5 + 4 * 2 + 12 : 0;

  const handleBoardClick = useCallback((index: number) => {
    if (!isOctordle) return;
    const el = boardRefs.current[index];
    if (el) {
      setSourceRect(el.getBoundingClientRect());
    }
    setExpandedIndex(index);
  }, [isOctordle]);

  // Stable per-index click handlers so that the memoized MiniBoard below
  // doesn't re-render on every parent re-render (e.g. once-per-second timer
  // ticks during a multi-board game). Inlining `() => handleBoardClick(i)` in
  // the map would allocate a fresh closure on each render and defeat memo.
  const boardClickHandlers = useMemo(
    () =>
      isOctordle
        ? Array.from({ length: boards.length }, (_, index) => () => handleBoardClick(index))
        : null,
    [isOctordle, boards.length, handleBoardClick],
  );

  const handleCloseExpanded = useCallback(() => {
    // Re-capture current position for exit animation
    if (expandedIndex !== null) {
      const el = boardRefs.current[expandedIndex];
      if (el) {
        setSourceRect(el.getBoundingClientRect());
      }
    }
    setExpandedIndex(null);
  }, [expandedIndex]);

  // Compute the expanded board's fixed rect (final rendered size)
  const getExpandedRect = () => {
    if (!containerRef.current) return { left: 0, top: 0, width: 300, height: 400 };
    const container = containerRef.current.getBoundingClientRect();
    const padding = 12;
    const availW = container.width - padding * 2;
    const availH = container.height - padding * 2;
    const targetW = Math.min(availW * 0.9, 384);
    const targetH = Math.min(availH * 0.95, targetW * 2.2);
    return {
      left: container.left + (container.width - targetW) / 2,
      top: container.top + (container.height - targetH) / 2,
      width: targetW,
      height: targetH,
    };
  };

  // Compute scale + translate to make the expanded-size element appear at the source position
  const getSourceTransform = () => {
    if (!sourceRect) return { scaleX: 0.3, scaleY: 0.3, x: 0, y: 0 };
    const expanded = getExpandedRect();
    const scaleX = sourceRect.width / expanded.width;
    const scaleY = sourceRect.height / expanded.height;
    // Offset: source center minus expanded center
    const x = (sourceRect.left + sourceRect.width / 2) - (expanded.left + expanded.width / 2);
    const y = (sourceRect.top + sourceRect.height / 2) - (expanded.top + expanded.height / 2);
    return { scaleX, scaleY, x, y };
  };

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {/* Grid of mini boards.
          `auto-rows-fr` (= grid-auto-rows: minmax(0,1fr)) is load-bearing:
          without it, the implicit row tracks default to `auto` and grow
          to fit each MiniBoard's natural content height, which on shorter
          phones makes the 2-row OctoWord layout overflow the parent flex
          cell and slide under the keyboard. With it, both rows split the
          available height equally and tiles shrink to fit. */}
      <div
        className={tile ? 'grid gap-2 w-full h-full justify-center content-center' : `grid ${cols} gap-2 w-full h-full auto-rows-fr`}
        style={tile ? { gridTemplateColumns: `repeat(${gridCols}, ${boardW}px)` } : undefined}
      >
        {boards.map((board, index) => (
          <div
            key={index}
            ref={(el) => { boardRefs.current[index] = el; }}
            className={tile ? 'min-h-0' : 'h-full min-h-0'}
          >
            <MiniBoard
              tileSize={tile ?? undefined}
              ariaLabel={describeBoard(board, index, boards.length)}
              board={board}
              index={index}
              currentGuess={board.status === 'PLAYING' ? currentGuess : undefined}
              colorBlind={colorBlind}
              onClick={boardClickHandlers?.[index]}
              invisible={expandedIndex === index}
              isInvalidWord={isInvalidWord}
              isShaking={isShaking}
            />
          </div>
        ))}
      </div>

      {/* Expanded board overlay (octordle only) */}
      {expandedIndex !== null && sourceRect && (
        <>
          {/* Backdrop — only covers the board area, not the keyboard */}
          <div
            onClick={handleCloseExpanded}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 rounded-lg animate-fade-in"
          />
          {/* Expanded board — uses scale transform for smooth text scaling */}
          <div
            style={{
              position: 'fixed',
              ...getExpandedRect(),
              transformOrigin: 'center center',
            }}
            className="z-50 animate-fade-in-scale"
            onClick={handleCloseExpanded}
          >
            <div
              className="w-full h-full"
            >
              <MiniBoard
                ariaLabel={describeBoard(boards[expandedIndex], expandedIndex, boards.length)}
                board={boards[expandedIndex]}
                index={expandedIndex}
                currentGuess={boards[expandedIndex].status === 'PLAYING' ? currentGuess : undefined}
                colorBlind={colorBlind}
                isExpanded
                isInvalidWord={isInvalidWord}
                isShaking={isShaking}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Compute letter states for a single board */
function computeBoardLetterStates(
  board: BoardState
): Record<string, 'correct' | 'present' | 'absent'> {
  const states: Record<string, 'correct' | 'present' | 'absent'> = {};

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
