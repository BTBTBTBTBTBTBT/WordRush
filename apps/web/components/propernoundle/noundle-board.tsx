'use client';

import { useState, useEffect, useMemo, useRef, memo } from 'react';
import { Guess, TileState } from './types';
import { normalizeString } from './game-logic';
import { LetterTile, type TileLook } from '@/components/game/letter-tile';
import { REVEAL } from '@/lib/tile-motion';
import { fitBoard, tileFontPx } from '@/lib/board-fit';
import { GameTray } from '@/components/ui/game-tray';
import { modeTrayAccent, trayChrome } from '@/lib/tray-fit';

interface NoundleBoardProps {
  guesses: Guess[];
  currentGuess: string;
  maxGuesses: number;
  answerLength: number;
  answerDisplay?: string;
  shouldShake?: boolean;
  /** The tray's accent (FINISH_SPEC L); ProperNoundle's catalog accent by default. */
  accent?: string;
}

/** The tray's chrome around the rows (lib/tray-fit.ts). */
const CHROME = trayChrome();

/** A ProperNoundle tile state → the shared tile look (FINISH_SPEC B1). */
function noundleLook(state: TileState, letter: string): TileLook {
  switch (state) {
    case 'correct': return 'correct';
    case 'present': return 'present';
    case 'absent': return 'absent';
    case 'hint-used': return 'gap';
    case 'tbd': return 'typed';
    default: return letter ? 'typed' : 'empty';
  }
}

function Tile({
  letter,
  state,
  index,
  shouldFlip = false,
  size = 56,
  shake = false,
  outIndex = 0,
}: {
  letter: string;
  state: TileState;
  index: number;
  shouldFlip?: boolean;
  size?: number;
  shake?: boolean;
  outIndex?: number;
}) {
  const hasFlip = shouldFlip && (state === 'correct' || state === 'present' || state === 'absent' || state === 'hint-used');
  return (
    <LetterTile
      letter={letter}
      look={noundleLook(state, letter)}
      flipIndex={hasFlip ? index : undefined}
      bad={shake && !!letter}
      outIndex={outIndex}
      style={{ width: size, height: size, ['--gt-font' as string]: `${tileFontPx(size)}px` }}
    />
  );
}

/** Gap between tiles and rows, and between the words of the answer (px). */
const TILE_GAP = 5;
const WORD_GAP = 12;

export default memo(function NoundleBoard({
  guesses,
  currentGuess,
  maxGuesses,
  answerLength,
  answerDisplay = '',
  shouldShake = false,
  accent = modeTrayAccent('PROPERNOUNDLE'),
}: NoundleBoardProps) {
  const [lastGuessCount, setLastGuessCount] = useState(guesses.length);
  const [shouldFlipRow, setShouldFlipRow] = useState(-1);
  const [tileSize, setTileSize] = useState(48);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (guesses.length > lastGuessCount) {
      setShouldFlipRow(guesses.length - 1);
      setLastGuessCount(guesses.length);
      // Hold the reveal class until the last tile has turned over and glowed (B3).
      const tiles = wordGroups.reduce((sum, count) => sum + count, 0);
      const timer = setTimeout(() => setShouldFlipRow(-1), REVEAL.end(tiles) + REVEAL.bloomMs);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guesses.length, lastGuessCount]);

  const wordGroups = useMemo((): number[] => {
    if (!answerDisplay) return [answerLength];
    // Strip non-alpha chars (hyphens, digits) from each word's tile count
    // so the grid only shows tiles for letters the keyboard can produce.
    // e.g. "Counter-Strike" → 13 tiles (not 14), "Cyberpunk 2077" → [9]
    const groups = answerDisplay
      .split(' ')
      .map(word => normalizeString(word).replace(/[^a-z]/g, '').length)
      .filter(n => n > 0);
    return groups.length > 0 ? groups : [answerLength];
  }, [answerDisplay, answerLength]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // B5: the shared board-sizing rule (lib/board-fit.ts), with the wider
    // gaps between the words of a multi-word answer as extra row width.
    const calculateTileSize = () => {
      const totalTiles = wordGroups.reduce((sum, count) => sum + count, 0);
      // FINISH_SPEC L: the rows sit on the game tray, so its chrome comes out of the area.
      const fit = fitBoard({
        width: el.clientWidth - 2 * CHROME.x,
        height: el.clientHeight - CHROME.top - CHROME.bottom,
        cols: totalTiles,
        rows: maxGuesses,
        gap: TILE_GAP,
        side: 0,
        maxTile: 56,
        extraWidth: (wordGroups.length - 1) * (WORD_GAP - TILE_GAP),
      });
      setTileSize(Math.max(fit?.tile ?? 16, 16));
    };

    const ro = new ResizeObserver(calculateTileSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxGuesses, wordGroups]);

  const renderRow = (index: number) => {
    const shouldFlip = shouldFlipRow === index;
    const isCurrentRow = index === guesses.length;
    const applyShake = shouldShake && isCurrentRow;

    if (index < guesses.length) {
      const guess = guesses[index];
      const letters = guess.word.split('');

      let letterIndex = 0;
      return (
        <div key={index} className={`flex justify-center ${applyShake ? 'gt-nudge' : ''}`} style={{ gap: WORD_GAP }}>
          {wordGroups.map((groupSize, groupIdx) => (
            <div key={groupIdx} className="flex" style={{ gap: TILE_GAP }}>
              {Array(groupSize).fill('').map(() => {
                const currentIndex = letterIndex++;
                const letter = letters[currentIndex] || '';
                const displayLetter = letter === '_' ? '' : letter.toUpperCase();
                return (
                  <Tile
                    key={currentIndex}
                    letter={displayLetter}
                    state={guess.tiles[currentIndex]}
                    index={currentIndex}
                    shouldFlip={shouldFlip}
                    size={tileSize}
                  />
                );
              })}
            </div>
          ))}
        </div>
      );
    } else if (index === guesses.length) {
      const letters = normalizeString(currentGuess).split('');
      const totalTiles = wordGroups.reduce((sum, count) => sum + count, 0);
      const tiles = Array(totalTiles).fill('');
      letters.forEach((letter, i) => {
        if (i < totalTiles) tiles[i] = letter;
      });

      let letterIndex = 0;
      return (
        <div key={index} className={`flex justify-center ${applyShake ? 'gt-nudge' : ''}`} style={{ gap: WORD_GAP }}>
          {wordGroups.map((groupSize, groupIdx) => (
            <div key={groupIdx} className="flex" style={{ gap: TILE_GAP }}>
              {Array(groupSize).fill('').map(() => {
                const currentIndex = letterIndex++;
                return (
                  <Tile
                    key={currentIndex}
                    letter={tiles[currentIndex]}
                    state={tiles[currentIndex] ? 'tbd' : 'empty'}
                    index={currentIndex}
                    size={tileSize}
                    shake={applyShake}
                    outIndex={totalTiles - 1 - currentIndex}
                  />
                );
              })}
            </div>
          ))}
        </div>
      );
    } else {
      let letterIndex = 0;
      return (
        <div key={index} className="flex justify-center" style={{ gap: WORD_GAP }}>
          {wordGroups.map((groupSize, groupIdx) => (
            <div key={groupIdx} className="flex" style={{ gap: TILE_GAP }}>
              {Array(groupSize).fill('').map(() => {
                const currentIndex = letterIndex++;
                return (
                  <Tile
                    key={currentIndex}
                    letter=""
                    state="empty"
                    index={currentIndex}
                    size={tileSize}
                  />
                );
              })}
            </div>
          ))}
        </div>
      );
    }
  };

  const last = guesses[guesses.length - 1];
  const won = !!last && last.tiles.length > 0 && last.tiles.every((t) => t === 'correct');
  const lost = !won && guesses.length >= maxGuesses;

  return (
    <div ref={containerRef} className="flex flex-col w-full h-full justify-center items-center">
      <GameTray accent={accent} state={won ? 'won' : lost ? 'lost' : 'playing'} className="w-fit max-w-full">
        <div className="flex flex-col" style={{ gap: TILE_GAP }}>
          {Array(maxGuesses)
            .fill(0)
            .map((_, i) => renderRow(i))}
        </div>
      </GameTray>
    </div>
  );
});
