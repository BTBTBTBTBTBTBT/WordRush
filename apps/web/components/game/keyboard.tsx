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
  letterStates?: Record<string, LetterState>;
  boardLetterStates?: Record<string, LetterState>[];
  blackedOutLetters?: Set<string>;
}

const QUADRANT_COLORS: Record<string, string> = {
  correct: 'bg-green-500',
  present: 'bg-yellow-500',
  absent: 'bg-gray-400',
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
  const cols = count <= 4 ? 2 : 4;
  const rows = Math.ceil(count / cols);

  const allStates = boardStates.map(s => s[letter]).filter(Boolean);
  const hasAny = allStates.length > 0;
  const allAbsent = hasAny && allStates.every(s => s === 'absent');

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative h-12 sm:h-14 w-10 sm:w-12 rounded-md font-black text-base sm:text-lg overflow-hidden',
        'transition-all duration-300 select-none',
        allAbsent
          ? 'text-[#1a1a2e]'
          : hasAny
          ? 'text-white'
          : 'text-gray-700'
      )}
      style={{
        border: '1.5px solid #ede9f6',
        textShadow: hasAny && !allAbsent ? '0 1px 2px rgba(0,0,0,0.35)' : undefined,
      }}
    >
      {allAbsent ? (
        <div className="absolute inset-0" style={{ backgroundColor: '#d4d0e0' }} />
      ) : (
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
                className={cn(state ? QUADRANT_COLORS[state] : '')}
                style={!state ? { backgroundColor: '#e8e5f0' } : undefined}
              />
            );
          })}
        </div>
      )}
      <span
        className="relative z-10"
        style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden', WebkitFontSmoothing: 'antialiased' }}
      >
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
    <div className="flex flex-col gap-1.5 max-w-xl mx-auto">
      {ROWS.map((row, i) => (
        <div key={i} className="flex gap-1 justify-center">
          {row.map((key) => {
            const isSpecial = key === 'ENTER' || key === 'BACK';
            const isBlackedOut = blackedOutLetters?.has(key);

            if (isSpecial) {
              return (
                <button
                  key={key}
                  onClick={() => !isBlackedOut && onKey(key)}
                  disabled={isBlackedOut}
                  className={cn(
                    useQuadrants ? 'h-12 sm:h-14' : 'h-11 sm:h-14',
                    'px-3 sm:px-4 rounded-md font-black text-sm sm:text-base',
                    'transition-all duration-300 select-none',
                    isBlackedOut && 'opacity-40 cursor-not-allowed'
                  )}
                  style={{
                    backgroundColor: skin ? undefined : '#e8e5f0',
                    border: '1.5px solid #ede9f6',
                    color: '#1a1a2e',
                  }}
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
                  className={cn(
                    useQuadrants
                      ? 'h-12 sm:h-14 w-10 sm:w-12 text-base sm:text-lg'
                      : 'h-11 sm:h-14 w-8 sm:w-10 text-sm sm:text-base',
                    'rounded-md font-black opacity-40 cursor-not-allowed animate-pulse select-none',
                  )}
                  style={{
                    backgroundColor: 'rgba(220,38,38,0.15)',
                    border: '1.5px solid rgba(220,38,38,0.2)',
                    color: 'rgba(220,38,38,0.4)',
                  }}
                >
                  ?
                </button>
              );
            }

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

            const state = letterStates[key];
            return (
              <button
                key={key}
                onClick={() => onKey(key)}
                className={cn(
                  'h-11 sm:h-14 w-8 sm:w-10 rounded-md font-black text-sm sm:text-base',
                  'transition-all duration-300 select-none',
                  state === 'correct' && 'bg-green-600 text-white border-green-600',
                  state === 'present' && 'bg-yellow-600 text-white border-yellow-600',
                  state === 'absent' && 'text-zinc-400',
                )}
                style={{
                  backgroundColor: state === 'correct' ? undefined : state === 'present' ? undefined : state === 'absent' ? '#d4d0e0' : (skin ? undefined : '#e8e5f0'),
                  border: state ? undefined : '1.5px solid #ede9f6',
                  color: !state ? (skin ? undefined : '#1a1a2e') : undefined,
                }}
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
