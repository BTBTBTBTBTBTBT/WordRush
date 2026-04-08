'use client';

import { useState, useEffect, useMemo, useRef, memo } from 'react';
import { Guess, TileState } from './types';
import { normalizeString } from './game-logic';

interface NoundleBoardProps {
  guesses: Guess[];
  currentGuess: string;
  maxGuesses: number;
  answerLength: number;
  answerDisplay?: string;
  shouldShake?: boolean;
}

function Tile({
  letter,
  state,
  index,
  shouldFlip = false,
  size = 56,
}: {
  letter: string;
  state: TileState;
  index: number;
  shouldFlip?: boolean;
  size?: number;
}) {
  const [currentState, setCurrentState] = useState<TileState>(state);
  const [isFlipping, setIsFlipping] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    if (shouldFlip && (state === 'correct' || state === 'present' || state === 'absent' || state === 'hint-used')) {
      const flipDelay = index * 150;

      const t1 = setTimeout(() => {
        setIsFlipping(true);

        const t2 = setTimeout(() => {
          setCurrentState(state);
        }, 250);
        timers.current.push(t2);

        const t3 = setTimeout(() => {
          setIsFlipping(false);
        }, 500);
        timers.current.push(t3);
      }, flipDelay);
      timers.current.push(t1);
    } else if (!shouldFlip) {
      setCurrentState(state);
    }
  }, [shouldFlip, state, index]);

  const fontSize = size * 0.45;

  const getStyles = (): { bg: string; border: string; text: string } => {
    switch (currentState) {
      case 'correct':
        return { bg: '#16a34a', border: '#16a34a', text: '#ffffff' };
      case 'present':
        return { bg: '#eab308', border: '#eab308', text: '#ffffff' };
      case 'absent':
        return { bg: '#9ca3af', border: '#9ca3af', text: '#ffffff' };
      case 'tbd':
        return { bg: '#ffffff', border: '#9ca3af', text: '#1a1a2e' };
      case 'hint-used':
        return { bg: '#e5e7eb', border: '#d1d5db', text: '#9ca3af' };
      default:
        return { bg: '#ffffff', border: '#d1d5db', text: '#1a1a2e' };
    }
  };

  const styles = getStyles();

  return (
    <div
      className={`flex items-center justify-center font-black uppercase rounded-md transition-transform duration-100 select-none ${isFlipping ? 'scale-y-0' : 'scale-y-100'}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${fontSize}px`,
        backgroundColor: styles.bg,
        border: `2px solid ${styles.border}`,
        color: styles.text,
      }}
    >
      {letter}
    </div>
  );
}

export default memo(function NoundleBoard({
  guesses,
  currentGuess,
  maxGuesses,
  answerLength,
  answerDisplay = '',
  shouldShake = false,
}: NoundleBoardProps) {
  const [lastGuessCount, setLastGuessCount] = useState(guesses.length);
  const [shouldFlipRow, setShouldFlipRow] = useState(-1);
  const [tileSize, setTileSize] = useState(48);

  useEffect(() => {
    if (guesses.length > lastGuessCount) {
      setShouldFlipRow(guesses.length - 1);
      setLastGuessCount(guesses.length);
      const timer = setTimeout(() => setShouldFlipRow(-1), 1000);
      return () => clearTimeout(timer);
    }
  }, [guesses.length, lastGuessCount]);

  const wordGroups = useMemo((): number[] => {
    if (!answerDisplay) return [answerLength];
    return answerDisplay.split(' ').map(word => normalizeString(word).length);
  }, [answerDisplay, answerLength]);

  useEffect(() => {
    const calculateTileSize = () => {
      const vv = window.visualViewport;
      const viewportHeight = vv ? vv.height : window.innerHeight;
      const viewportWidth = vv ? vv.width : window.innerWidth;

      const reservedHeight = 360;
      const availableHeight = viewportHeight - reservedHeight;

      const rowGap = 6;
      const totalRowGaps = (maxGuesses - 1) * rowGap;
      const maxTileHeightFromHeight = (availableHeight - totalRowGaps) / maxGuesses;

      const wordGroupGap = 12;
      const tileGap = 4;
      const totalTiles = wordGroups.reduce((sum, count) => sum + count, 0);
      const totalGroupGaps = (wordGroups.length - 1) * wordGroupGap;
      const totalTileGaps = (totalTiles - wordGroups.length) * tileGap;
      const horizontalPadding = viewportWidth < 640 ? 32 : 64;

      const availableWidth = viewportWidth - horizontalPadding - totalGroupGaps - totalTileGaps;
      const maxTileWidthFromWidth = availableWidth / totalTiles;

      const calculatedSize = Math.min(maxTileHeightFromHeight, maxTileWidthFromWidth, 48);
      const finalSize = Math.max(calculatedSize, 16);

      setTileSize(finalSize);
    };

    calculateTileSize();

    const handleResize = () => {
      calculateTileSize();
    };

    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
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
        <div key={index} className={`flex gap-3 justify-center ${applyShake ? 'animate-shake' : ''}`}>
          {wordGroups.map((groupSize, groupIdx) => (
            <div key={groupIdx} className="flex gap-1">
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
        <div key={index} className={`flex gap-3 justify-center ${applyShake ? 'animate-shake' : ''}`}>
          {wordGroups.map((groupSize, groupIdx) => (
            <div key={groupIdx} className="flex gap-1">
              {Array(groupSize).fill('').map(() => {
                const currentIndex = letterIndex++;
                return (
                  <Tile
                    key={currentIndex}
                    letter={tiles[currentIndex]}
                    state={tiles[currentIndex] ? 'tbd' : 'empty'}
                    index={currentIndex}
                    size={tileSize}
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
        <div key={index} className="flex gap-3 justify-center">
          {wordGroups.map((groupSize, groupIdx) => (
            <div key={groupIdx} className="flex gap-1">
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

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {Array(maxGuesses)
        .fill(0)
        .map((_, i) => renderRow(i))}
    </div>
  );
});
