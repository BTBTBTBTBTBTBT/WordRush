'use client';

import { motion } from 'framer-motion';

interface OpponentMiniBoardProps {
  tiles: string[][]; // array of tile-state arrays for one board
  maxGuesses: number;
  wordLength: number;
}

const TILE_COLORS: Record<string, string> = {
  CORRECT: '#22c55e',
  PRESENT: '#eab308',
  ABSENT: '#6b7280',
};

export function OpponentMiniBoard({ tiles, maxGuesses, wordLength }: OpponentMiniBoardProps) {
  return (
    <div className="flex flex-col gap-[1px]">
      {Array.from({ length: maxGuesses }).map((_, rowIndex) => {
        const row = tiles[rowIndex];
        const isNew = rowIndex === tiles.length - 1;

        return (
          <motion.div
            key={rowIndex}
            className="flex gap-[1px]"
            initial={isNew && row ? { opacity: 0, scale: 0.8 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            {Array.from({ length: wordLength }).map((_, colIndex) => {
              const tileState = row?.[colIndex];
              const color = tileState ? TILE_COLORS[tileState] || 'transparent' : undefined;

              return (
                <div
                  key={colIndex}
                  className="rounded-[2px]"
                  style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: color || 'transparent',
                    border: color ? 'none' : '1px solid #d1d5db',
                  }}
                />
              );
            })}
          </motion.div>
        );
      })}
    </div>
  );
}

interface OpponentMultiMiniBoardProps {
  opponentTiles: Record<number, string[][]>;
  totalBoards: number;
  maxGuesses: number;
  wordLength: number;
}

export function OpponentMultiMiniBoard({ opponentTiles, totalBoards, maxGuesses, wordLength }: OpponentMultiMiniBoardProps) {
  // For multi-board modes, show a compact row of mini boards
  const cols = totalBoards <= 4 ? totalBoards : 4;

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {Array.from({ length: totalBoards }).map((_, boardIdx) => (
        <OpponentMiniBoard
          key={boardIdx}
          tiles={opponentTiles[boardIdx] || []}
          maxGuesses={maxGuesses}
          wordLength={wordLength}
        />
      ))}
    </div>
  );
}
