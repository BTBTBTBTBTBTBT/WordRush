'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { CompletedMiniBoard } from '@/components/game/completed-mini-board';

interface OpponentMiniBoardProps {
  tiles: string[][]; // array of tile-state arrays for one board
  maxGuesses: number;
  wordLength: number;
  /** Tile edge in px. Default 5 (the opponent strip). */
  tileSize?: number;
}

// The solo tile colors (the .tile-* CSS vars, colorblind palette included).
const TILE_CLASS: Record<string, string> = {
  CORRECT: 'tile-correct',
  PRESENT: 'tile-present',
  ABSENT: 'tile-absent',
};

/**
 * Tiny colors-only board for the opponent strip (VS polish §1): single-board
 * modes show the opponent's live rows at a glance. Fixed tile size, so the
 * strip never changes height as rows fill in.
 */
export function OpponentMiniBoard({ tiles, maxGuesses, wordLength, tileSize = 5 }: OpponentMiniBoardProps) {
  const gap = tileSize >= 12 ? 2 : 1;
  return (
    <div className="flex flex-col shrink-0" style={{ gap: `${gap}px` }} aria-hidden="true">
      {Array.from({ length: maxGuesses }).map((_, rowIndex) => {
        const row = tiles[rowIndex];
        const isNew = rowIndex === tiles.length - 1;
        return (
          <div key={rowIndex} className="flex" style={{ gap: `${gap}px` }}>
            {Array.from({ length: wordLength }).map((_, colIndex) => {
              const cls = row?.[colIndex] ? TILE_CLASS[row[colIndex]] : undefined;
              // Newest row flips in tile-by-tile (staggered) for a fluid reveal.
              const animate = isNew && !!cls;
              return (
                <div
                  key={colIndex}
                  className={`${cls ?? ''} ${animate ? 'opp-tile-flip' : ''}`}
                  style={{
                    width: tileSize,
                    height: tileSize,
                    borderRadius: tileSize >= 8 ? 2 : 1,
                    background: cls ? undefined : '#e9e7f3',
                    animationDelay: animate ? `${colIndex * 55}ms` : undefined,
                  }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

interface OpponentLiveBoardsProps {
  opponentTiles: Record<number, string[][]>;
  /** Board indices to draw, in order (all of a mode's boards; Gauntlet: the ones in play). */
  boardIndices: number[];
  /** Board indices the opponent has solved (violet solved frame). */
  solvedBoards?: Set<number>;
  maxGuesses: number;
  wordLength: number;
}

const BOARD_GAP = 8;
const BOARD_PAD = 8; // CompletedMiniBoard: p-0.5 + border-2 on both sides
const MAX_HEIGHT = 360;

/**
 * The "still playing" spectator boards (VS polish §2): the opponent's live
 * boards drawn with the solo recap's mini-board component (colors only),
 * laid out on an explicit grid whose tile size is computed from the measured
 * width — so boards never overlap, clip or overflow horizontally (the old
 * flex-wrap of fixed-size grids collided on narrow phones).
 */
export function OpponentLiveBoards({ opponentTiles, boardIndices, solvedBoards, maxGuesses, wordLength }: OpponentLiveBoardsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = Math.max(1, boardIndices.length);
  const cols = n === 1 ? 1 : n <= 4 ? 2 : 4;
  const boardRows = Math.ceil(n / cols);
  const cap = n === 1 ? 34 : n <= 4 ? 22 : 14;
  const byW = ((width - (cols - 1) * BOARD_GAP) / cols - BOARD_PAD - (wordLength - 1)) / wordLength;
  const byH = ((MAX_HEIGHT - (boardRows - 1) * BOARD_GAP) / boardRows - BOARD_PAD - (maxGuesses - 1)) / maxGuesses;
  const tile = Math.max(4, Math.floor(Math.min(byW, byH, cap)));

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <div
          className="grid justify-center mx-auto"
          style={{ gridTemplateColumns: `repeat(${Math.min(cols, n)}, max-content)`, gap: BOARD_GAP }}
        >
          {boardIndices.map((idx) => (
            <CompletedMiniBoard
              key={idx}
              solution=""
              guesses={[]}
              maxGuesses={maxGuesses}
              won={solvedBoards?.has(idx) ?? false}
              tileSize={tile}
              liveStates={opponentTiles[idx] || []}
              wordLength={wordLength}
            />
          ))}
        </div>
      )}
    </div>
  );
}
