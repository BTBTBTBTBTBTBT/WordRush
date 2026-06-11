'use client';

import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { playKeyTap } from '@/lib/sounds';
import { Delete } from 'lucide-react';

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
  correct: 'key-correct',
  present: 'key-present',
  absent: 'key-absent',
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
      onClick={() => { haptic('light'); playKeyTap(); onClick(); }}
      className={cn(
        'relative h-12 sm:h-14 w-10 sm:w-12 rounded-md font-black text-base sm:text-lg overflow-hidden',
        'transition-all duration-150 select-none',
        allAbsent
          ? 'text-white'
          : hasAny
          ? 'text-white'
          : 'text-gray-700'
      )}
      style={{
        border: '1.5px solid var(--color-border)',
        textShadow: hasAny ? '0 1px 2px rgba(0,0,0,0.35)' : undefined,
      }}
    >
      {allAbsent ? (
        <div className="absolute inset-0 key-absent" />
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

  return (
    <div className="flex flex-col gap-1.5 max-w-xl mx-auto" role="group" aria-label="Game keyboard">
      {ROWS.map((row, i) => (
        <div key={i} className="flex gap-1 justify-center">
          {row.map((key) => {
            const isSpecial = key === 'ENTER' || key === 'BACK';
            const isBlackedOut = blackedOutLetters?.has(key);

            if (isSpecial) {
              return (
                <button
                  key={key}
                  onClick={() => { if (isBlackedOut) return; if (key === 'ENTER') haptic('medium'); else if (key !== 'BACK') haptic('light'); playKeyTap(); onKey(key); }}
                  disabled={isBlackedOut}
                  aria-label={key === 'BACK' ? 'Backspace' : 'Submit guess'}
                  className={cn(
                    'h-12 sm:h-14 px-3 sm:px-4 rounded-md font-black text-base sm:text-lg',
                    'transition-all duration-150 select-none',
                    isBlackedOut && 'opacity-40 cursor-not-allowed'
                  )}
                  style={{
                    backgroundColor: '#e8e5f0',
                    border: '1.5px solid var(--color-border)',
                    color: 'var(--color-text)',
                  }}
                >
                  {key === 'BACK' ? <Delete className="h-5 w-5" aria-hidden="true" /> : key}
                </button>
              );
            }

            if (isBlackedOut) {
              return (
                <button
                  key={key}
                  disabled
                  aria-label={`${key}, unavailable`}
                  className="h-12 sm:h-14 w-10 sm:w-12 rounded-md font-black text-base sm:text-lg opacity-40 cursor-not-allowed animate-pulse select-none"
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
                  onClick={() => { haptic('light'); playKeyTap(); onKey(key); }}
                />
              );
            }

            const state = letterStates[key];
            return (
              <button
                key={key}
                onClick={() => { haptic('light'); playKeyTap(); onKey(key); }}
                aria-label={state ? `${key}, ${state}` : key}
                className={cn(
                  'h-12 sm:h-14 w-10 sm:w-12 rounded-md font-black text-base sm:text-lg',
                  'transition-all duration-150 select-none',
                  state === 'correct' && 'key-correct text-white',
                  state === 'present' && 'key-present text-white',
                  state === 'absent' && 'key-absent text-white',
                )}
                style={{
                  backgroundColor: state ? undefined : '#e8e5f0',
                  border: state ? undefined : '1.5px solid var(--color-border)',
                  color: !state ? 'var(--color-text)' : undefined,
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
