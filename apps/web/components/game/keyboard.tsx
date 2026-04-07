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
  absent: 'bg-zinc-700',
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
        'relative h-11 sm:h-14 w-8 sm:w-10 rounded-md font-black text-sm sm:text-base overflow-hidden',
        'transition-all duration-300 select-none',
        allAbsent
          ? 'text-zinc-500'
          : hasAny
          ? 'text-white'
          : 'text-zinc-400'
      )}
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
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
              style={!state ? { backgroundColor: '#1a1730' } : undefined}
            />
          );
        })}
      </div>
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

            if (isSpecial) {
              return (
                <button
                  key={key}
                  onClick={() => !isBlackedOut && onKey(key)}
                  disabled={isBlackedOut}
                  className={cn(
                    'h-11 sm:h-14 px-3 sm:px-4 rounded-md font-black text-sm sm:text-base',
                    'transition-all duration-300 select-none',
                    isBlackedOut && 'opacity-40 cursor-not-allowed'
                  )}
                  style={{
                    backgroundColor: skin ? undefined : '#1a1730',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff',
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
                  className="h-11 sm:h-14 w-8 sm:w-10 rounded-md font-black text-sm sm:text-base opacity-40 cursor-not-allowed animate-pulse select-none"
                  style={{
                    backgroundColor: 'rgba(127,29,29,0.5)',
                    border: '1px solid rgba(127,29,29,0.4)',
                    color: 'rgba(127,29,29,0.6)',
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
                  state === 'absent' && 'text-zinc-500',
                )}
                style={{
                  backgroundColor: state === 'correct' ? undefined : state === 'present' ? undefined : state === 'absent' ? '#1a1730' : (skin ? undefined : '#1a1730'),
                  border: state ? undefined : '1px solid rgba(255,255,255,0.08)',
                  color: !state ? (skin ? undefined : 'rgba(255,255,255,0.7)') : undefined,
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
