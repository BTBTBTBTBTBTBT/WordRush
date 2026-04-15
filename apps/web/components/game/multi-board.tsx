'use client';

import { memo, useState, useCallback, useRef, useMemo } from 'react';
import { BoardState, TileState, PrefilledGuess, evaluateGuess as coreEvaluateGuess } from '@wordle-duel/core';
import { motion, AnimatePresence } from 'framer-motion';

interface MultiBoardProps {
  boards: BoardState[];
  currentGuess?: string;
  colorBlind?: boolean;
  isInvalidWord?: boolean;
}

const getTileColor = (state: TileState, colorBlind?: boolean) => {
  if (colorBlind) {
    switch (state) {
      case TileState.CORRECT: return 'bg-cyan-600 border-cyan-600';
      case TileState.PRESENT: return 'bg-orange-500 border-orange-500';
      case TileState.ABSENT: return 'bg-gray-400 border-gray-400';
      default: return 'bg-white border-gray-300';
    }
  }
  switch (state) {
    case TileState.CORRECT: return 'bg-green-600 border-green-600';
    case TileState.PRESENT: return 'bg-yellow-500 border-yellow-500';
    case TileState.ABSENT: return 'bg-gray-400 border-gray-400';
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

// Memoized MiniBoard — only re-renders when its own board data or currentGuess changes
const MiniBoard = memo(function MiniBoard({ board, index, currentGuess, colorBlind, onClick, isExpanded, invisible, isInvalidWord }: {
  board: BoardState;
  index: number;
  currentGuess?: string;
  colorBlind?: boolean;
  onClick?: () => void;
  isExpanded?: boolean;
  invisible?: boolean;
  isInvalidWord?: boolean;
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
  const lastSubmittedRow = isWon && board.guesses.length > 0 ? board.guesses.length - 1 : -1;

  // In expanded mode, show larger text
  const textSize = isExpanded ? 'text-base sm:text-lg' : 'text-[10px] sm:text-xs';

  return (
    <div
      onClick={onClick}
      className={`relative p-1 rounded-lg border-2 h-full flex flex-col ${
        onClick ? 'cursor-pointer' : ''
      } ${
        invisible ? 'invisible' : ''
      } ${
        isWon
          ? 'border-green-400 bg-green-50'
          : isLost
          ? 'border-red-400 bg-red-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      {isWon && (
        <div className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center z-10">
          ✓
        </div>
      )}

      <div className="grid gap-[2px] flex-1" style={{ gridTemplateRows: `repeat(${totalRows}, 1fr)` }}>
        {Array.from({ length: totalRows }).map((_, rowIndex) => {
          const isPrefillRow = rowIndex < prefillCount;
          const playerRowIndex = rowIndex - prefillCount;

          if (isPrefillRow) {
            const prefill = prefills[rowIndex];
            return (
              <div key={rowIndex} className="grid grid-cols-5 gap-[2px] min-h-0 opacity-75">
                {prefill.evaluation.tiles.map((tile, letterIndex) => (
                  <div
                    key={letterIndex}
                    className={`flex items-center justify-center min-h-0 border rounded font-bold ${textSize} ${tile.state === TileState.EMPTY ? 'text-gray-800' : 'text-white'} ${getTileColor(tile.state, colorBlind)}`}
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
            <div key={rowIndex} className="grid grid-cols-5 gap-[2px] min-h-0">
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
});

export function MultiBoard({ boards, currentGuess, colorBlind, isInvalidWord }: MultiBoardProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [sourceRect, setSourceRect] = useState<DOMRect | null>(null);
  const boardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const isOctordle = boards.length > 4;
  const cols = isOctordle ? 'grid-cols-4' : 'grid-cols-2';

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
      {/* Grid of mini boards */}
      <div className={`grid ${cols} gap-2 w-full h-full`}>
        {boards.map((board, index) => (
          <div
            key={index}
            ref={(el) => { boardRefs.current[index] = el; }}
            className="h-full"
          >
            <MiniBoard
              board={board}
              index={index}
              currentGuess={board.status === 'PLAYING' ? currentGuess : undefined}
              colorBlind={colorBlind}
              onClick={boardClickHandlers?.[index]}
              invisible={expandedIndex === index}
              isInvalidWord={isInvalidWord}
            />
          </div>
        ))}
      </div>

      {/* Expanded board overlay (octordle only) */}
      <AnimatePresence>
        {expandedIndex !== null && sourceRect && (
          <>
            {/* Backdrop — only covers the board area, not the keyboard */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleCloseExpanded}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 rounded-lg"
            />
            {/* Expanded board — uses scale transform for smooth text scaling */}
            <motion.div
              initial={getSourceTransform()}
              animate={{ scaleX: 1, scaleY: 1, x: 0, y: 0 }}
              exit={getSourceTransform()}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              style={{
                position: 'fixed',
                ...getExpandedRect(),
                transformOrigin: 'center center',
                willChange: 'transform',
              }}
              className="z-50"
              onClick={handleCloseExpanded}
            >
              <div
                className="w-full h-full"
              >
                <MiniBoard
                  board={boards[expandedIndex]}
                  index={expandedIndex}
                  currentGuess={boards[expandedIndex].status === 'PLAYING' ? currentGuess : undefined}
                  colorBlind={colorBlind}
                  isExpanded
                  isInvalidWord={isInvalidWord}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
