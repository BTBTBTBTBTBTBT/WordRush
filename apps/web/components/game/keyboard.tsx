'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { playKeyTap } from '@/lib/sounds';
import { getKeyboardLayout, onKeyboardLayoutChange, type KeyboardLayout } from '@/lib/keyboard-layout';
import { Delete } from 'lucide-react';

// Three arrangements of the same keys (§213) — see lib/keyboard-layout.ts.
// SPACE is decorative: it presses (haptic + sound) but sends nothing.
const LAYOUT_ROWS: Record<KeyboardLayout, string[][]> = {
  standard: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    // ENTER left, backspace RIGHT — where every phone text keyboard puts it
    // (founder call, 2026-08-10; iOS/Android KeyboardViews mirror this).
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
  ],
  flipped: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['BACK', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'ENTER'],
  ],
  michael: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['BACK', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
    ['ENTER', 'SPACE', 'ENTER'],
  ],
};

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
  compact = false,
}: {
  letter: string;
  boardStates: Record<string, LetterState>[];
  onClick: () => void;
  compact?: boolean;
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
        'relative w-10 sm:w-12 rounded-md font-black text-base sm:text-lg overflow-hidden',
        compact ? 'h-10 sm:h-12' : 'h-12 sm:h-14',
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
  const [layout, setLayout] = useState<KeyboardLayout>('standard');
  useEffect(() => {
    setLayout(getKeyboardLayout());
    return onKeyboardLayoutChange(() => setLayout(getKeyboardLayout()));
  }, []);
  const rows = LAYOUT_ROWS[layout];
  // Michael Keyboard is a row taller — shorter keys keep total height close
  // to the 3-row layouts so tight boards (OctoWord, Gauntlet) don't squeeze.
  const keyH = layout === 'michael' ? 'h-10 sm:h-12' : 'h-12 sm:h-14';

  return (
    <div className="flex flex-col gap-1.5 max-w-xl mx-auto" role="group" aria-label="Game keyboard">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-1 justify-center">
          {row.map((key, ki) => {
            const isSpecial = key === 'ENTER' || key === 'BACK';
            const isBlackedOut = blackedOutLetters?.has(key);

            if (key === 'SPACE') {
              // Decorative space bar (§213): reacts like a key, does nothing.
              return (
                <button
                  key={`space-${ki}`}
                  onClick={() => { haptic('light'); playKeyTap(); }}
                  aria-label="Space (decorative)"
                  className={cn(keyH, 'flex-1 max-w-[240px] rounded-md font-bold text-xs transition-all duration-150 select-none active:scale-95')}
                  style={{ backgroundColor: '#e8e5f0', border: '1.5px solid var(--color-border)', color: '#8a86a0' }}
                >
                  space
                </button>
              );
            }

            if (isSpecial) {
              return (
                <button
                  key={`${key}-${ki}`}
                  onClick={() => { if (isBlackedOut) return; if (key === 'ENTER') haptic('medium'); else if (key !== 'BACK') haptic('light'); playKeyTap(); onKey(key); }}
                  disabled={isBlackedOut}
                  aria-label={key === 'BACK' ? 'Backspace' : 'Submit guess'}
                  className={cn(
                    keyH, 'px-3 sm:px-4 rounded-md font-black text-base sm:text-lg',
                    'transition-all duration-150 select-none',
                    isBlackedOut && 'opacity-40 cursor-not-allowed'
                  )}
                  style={{
                    // Fixed dark ink, NOT var(--color-text). The key SURFACE is a
                    // fixed brand lavender that does not follow the theme, so a
                    // themed foreground put near-white #F0EEF6 on #E8E5F0 in Dark
                    // and the letters became invisible.
                    backgroundColor: '#e8e5f0',
                    border: '1.5px solid var(--color-border)',
                    color: '#1a1a2e',
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
                  className={cn(keyH, 'w-10 sm:w-12 rounded-md font-black text-base sm:text-lg opacity-40 cursor-not-allowed animate-pulse select-none')}
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
                  compact={layout === 'michael'}
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
                  keyH, 'w-10 sm:w-12 rounded-md font-black text-base sm:text-lg',
                  'transition-all duration-150 select-none',
                  state === 'correct' && 'key-correct text-white',
                  state === 'present' && 'key-present text-white',
                  state === 'absent' && 'key-absent text-white',
                )}
                style={{
                  backgroundColor: state ? undefined : '#e8e5f0',
                  border: state ? undefined : '1.5px solid var(--color-border)',
                  // Fixed ink over the fixed key surface — see the wide keys
                  // above. var(--color-text) is near-white in Dark and made
                  // every unplayed letter invisible.
                  color: !state ? '#1a1a2e' : undefined,
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
