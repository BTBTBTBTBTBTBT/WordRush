'use client';


interface OpponentMiniBoardProps {
  tiles: string[][]; // array of tile-state arrays for one board
  maxGuesses: number;
  wordLength: number;
  /** Tile edge in px. Default 8 (HUD strip); the spectator view uses 16. */
  tileSize?: number;
}

const TILE_COLORS: Record<string, string> = {
  CORRECT: 'var(--tile-correct)',
  PRESENT: 'var(--tile-present)',
  ABSENT: 'var(--color-text-muted)',
  EMPTY: 'transparent',
};

export function OpponentMiniBoard({ tiles, maxGuesses, wordLength, tileSize = 8 }: OpponentMiniBoardProps) {
  const gap = tileSize >= 12 ? 2 : 1;
  return (
    <div className="flex flex-col" style={{ gap: `${gap}px` }}>
      {Array.from({ length: maxGuesses }).map((_, rowIndex) => {
        const row = tiles[rowIndex];
        const isNew = rowIndex === tiles.length - 1;

        return (
          <div
            key={rowIndex}
            className={`flex ${isNew && row ? 'animate-fade-in-scale' : ''}`}
            style={{ gap: `${gap}px` }}
          >
            {Array.from({ length: wordLength }).map((_, colIndex) => {
              const tileState = row?.[colIndex];
              const color = tileState ? TILE_COLORS[tileState] || 'transparent' : undefined;

              return (
                <div
                  key={colIndex}
                  className="rounded-[2px]"
                  style={{
                    width: `${tileSize}px`,
                    height: `${tileSize}px`,
                    backgroundColor: color || 'transparent',
                    border: color ? 'none' : '1px solid #d1d5db',
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

interface OpponentMultiMiniBoardProps {
  opponentTiles: Record<number, string[][]>;
  totalBoards: number;
  maxGuesses: number;
  wordLength: number;
  tileSize?: number;
}

export function OpponentMultiMiniBoard({ opponentTiles, totalBoards, maxGuesses, wordLength, tileSize }: OpponentMultiMiniBoardProps) {
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
          tileSize={tileSize}
        />
      ))}
    </div>
  );
}
