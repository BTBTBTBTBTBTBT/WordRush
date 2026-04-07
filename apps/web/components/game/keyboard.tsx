'use client';

import { cn } from '@/lib/utils';
import { Delete } from 'lucide-react';
import { useCosmetics } from '@/lib/cosmetics/cosmetic-context';

const KEYBOARD_SKINS: Record<string, { base: string; special: string }> = {
  kb_galaxy: {
    base: 'bg-purple-900 border-purple-600 text-purple-100',
    special: 'bg-purple-800 border-purple-600 text-purple-100',
  },
  kb_wooden: {
    base: 'bg-amber-900 border-amber-700 text-amber-100',
    special: 'bg-amber-800 border-amber-700 text-amber-100',
  },
};

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['BACK', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'ENTER']
];

type LetterState = 'correct' | 'present' | 'absent';

interface KeyboardProps {
  onKey: (key: string) => void;
  /** Single combined letter states (used for single-board modes and sequence) */
  letterStates?: Record<string, LetterState>;
  /** Per-board letter states for quadrant display (used for multi-board modes) */
  boardLetterStates?: Record<string, LetterState>[];
  blackedOutLetters?: Set<string>;
}

const QUADRANT_COLORS: Record<string, string> = {
  correct: 'bg-green-500',
  present: 'bg-yellow-500',
  absent: 'bg-zinc-600',
};

function QuadrantKey({
  letter,
  boardStates,
  onClick,
}: {
  letter: string;
  boardStates: Record<string, LetterState>[];
  onClick: () => void;
}) {
  const count = boardStates.length;
  // For 8 boards: 4x2 grid, for 4 boards: 2x2 grid
  const cols = count <= 4 ? 2 : 4;
  const rows = Math.ceil(count / cols);

  // Determine overall key background: if every board with a state shows absent, key is dark
  const allStates = boardStates.map(s => s[letter]).filter(Boolean);
  const hasAny = allStates.length > 0;
  const allAbsent = hasAny && allStates.every(s => s === 'absent');

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative h-11 sm:h-14 w-8 sm:w-10 rounded-md font-bold text-sm sm:text-base overflow-hidden border',
        'transition-all duration-300 select-none',
        allAbsent
          ? 'border-zinc-700 text-zinc-400'
          : hasAny
          ? 'border-zinc-600 text-white'
          : 'border-zinc-600 bg-zinc-800 text-zinc-300'
      )}
    >
      {/* Quadrant grid background */}
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {boardStates.map((states, i) => {
          const state = states[letter];
          return (
            <div
              key={i}
              className={cn(
                state ? QUADRANT_COLORS[state] : 'bg-zinc-800',
              )}
            />
          );
        })}
      </div>
      {/* Letter overlay */}
      <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        {letter}
      </span>
    </button>
  );
}

export function Keyboard({ onKey, letterStates = {}, boardLetterStates, blackedOutLetters }: KeyboardProps) {
  const useQuadrants = boardLetterStates && boardLetterStates.length > 1;
  const { keyboardSkinId } = useCosmetics();
  const skin = keyboardSkinId ? KEYBOARD_SKINS[keyboardSkinId] : null;

  return (
    <div className="flex flex-col gap-1.5 max-w-lg mx-auto">
      {ROWS.map((row, i) => (
        <div key={i} className="flex gap-1 justify-center">
          {row.map((key) => {
            const isSpecial = key === 'ENTER' || key === 'BACK';
            const isBlackedOut = blackedOutLetters?.has(key);

            // Special keys (ENTER, BACK) — no quadrants
            if (isSpecial) {
              return (
                <button
                  key={key}
                  onClick={() => !isBlackedOut && onKey(key)}
                  disabled={isBlackedOut}
                  className={cn(
                    'h-11 sm:h-14 px-3 sm:px-4 rounded-md font-bold text-sm sm:text-base',
                    skin ? `${skin.special} border transition-all duration-300 select-none` : 'bg-zinc-700 text-white border border-zinc-600 transition-all duration-300 select-none',
                    isBlackedOut && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  {key === 'BACK' ? <Delete className="h-5 w-5" /> : key}
                </button>
              );
            }

            if (isBlackedOut) {
              return (
                <button
                  key={key}
                  disabled
                  className="h-11 sm:h-14 w-8 sm:w-10 rounded-md font-bold text-sm sm:text-base bg-red-900/80 text-red-900/80 border border-red-900/60 opacity-40 cursor-not-allowed animate-pulse select-none"
                >
                  ?
                </button>
              );
            }

            // Quadrant mode for multi-board
            if (useQuadrants) {
              return (
                <QuadrantKey
                  key={key}
                  letter={key}
                  boardStates={boardLetterStates}
                  onClick={() => onKey(key)}
                />
              );
            }

            // Single-board mode
            const state = letterStates[key];
            return (
              <button
                key={key}
                onClick={() => onKey(key)}
                className={cn(
                  'h-11 sm:h-14 w-8 sm:w-10 rounded-md font-bold text-sm sm:text-base',
                  'border transition-all duration-300 select-none',
                  state === 'correct' && 'bg-green-600 text-white border-green-600',
                  state === 'present' && 'bg-yellow-600 text-white border-yellow-600',
                  state === 'absent' && 'bg-zinc-700 text-white border-zinc-600',
                  !state && (skin ? skin.base : 'bg-zinc-800 text-zinc-300 border-zinc-600')
                )}
              >
                {key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
