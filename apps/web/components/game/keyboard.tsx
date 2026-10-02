'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { playDelete, playKeyTap } from '@/lib/sounds';
import { getKeyboardLayout, onKeyboardLayoutChange, type KeyboardLayout } from '@/lib/keyboard-layout';
import { keyRevealSchedule, keyStatesWith, type KeyStatesLike } from '@/lib/key-reveal';
import { prefersReducedMotion } from '@/lib/motion';

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

// FINISH_SPEC B2: keys are tiles too (globals.css `.kkey`): a lilac lip, a light
// face and dark purple letters, taking the tile state colors as each tile lands (AQ1);
// Delete is a chunky purple backspace icon; ENTER is 12 px. Every key sinks
// into its lip and springs back on press (A9, components/ui/squish-host.tsx).

/** The chunky purple backspace (mockup game-kit.html). */
function BackspaceIcon() {
  return (
    <svg viewBox="0 0 32 24" width="30" height="22" aria-hidden="true" style={{ width: '62%', maxWidth: 30, height: 'auto', filter: 'drop-shadow(0 1px 0 rgba(255, 255, 255, 0.6))' }}>
      <path d="M10.2 2.5h17.3a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H10.2a3 3 0 0 1-2.3-1.1L2.2 13.9a3 3 0 0 1 0-3.8L7.9 3.6a3 3 0 0 1 2.3-1.1z" fill="#5b2bb5" />
      <path d="M15.2 8.3l7.4 7.4M22.6 8.3l-7.4 7.4" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** A key face's fill per state (the tile ramps). */
const KEY_FACE: Record<LetterState, string> = {
  correct: 'linear-gradient(var(--gt-c-light), var(--gt-c-base))',
  present: 'linear-gradient(var(--gt-p-light), var(--gt-p-base))',
  absent: 'linear-gradient(var(--gt-a-light), var(--gt-a-base))',
};
const EMPTY_STATES: Record<string, LetterState> = {};

interface KeyboardProps {
  onKey: (key: string) => void;
  letterStates?: Record<string, LetterState>;
  boardLetterStates?: Record<string, LetterState>[];
  blackedOutLetters?: Set<string>;
  /** Codebreaker (founder, 2026-09-28): plain letters already settled (given or
   *  confirmed by a Check) fill with the mode accent so the remaining letters
   *  stand out, the way the word games color used keys. letter → CSS color. */
  keyFills?: Record<string, string>;
  /** AQ1: the guess being revealed — each key takes its new color as ITS tile
   *  lands (lib/key-reveal.ts), not after the whole row. Omit = at once. A
   *  reset (fewer colored keys than shown) always applies at once. */
  revealWord?: string;
}

/** The letter states the keys show: each new color lands with its tile (AQ1). */
function useRevealed<T extends KeyStatesLike>(states: T, word: string | undefined): T {
  const [shown, setShown] = useState(states);
  const targetRef = useRef(states);
  useEffect(() => {
    const prev = targetRef.current;
    targetRef.current = states;
    const steps = keyRevealSchedule(prev, states, word, prefersReducedMotion());
    if (steps.length === 0 || steps[steps.length - 1].at === 0) { setShown(states); return; }
    // A reveal still landing from the row before finishes at once (typing fast).
    setShown(prev);
    const applied = new Set<string>();
    const timers = steps.map((step, i) => {
      step.letters.forEach((l) => applied.add(l));
      const value = i === steps.length - 1 ? states : keyStatesWith(prev, states, new Set(applied));
      return setTimeout(() => setShown(value), step.at);
    });
    return () => timers.forEach(clearTimeout);
  }, [states, word]);
  return word ? shown : states;
}

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
      data-s={allAbsent ? 'absent' : undefined}
      className={cn(
        // §255: the sm sizes are thumb keys; from lg (desktop / iPad landscape)
        // they were eating a third of the viewport and squeezing the boards.
        // 44px keeps Apple's touch minimum while giving the height back.
        'kkey w-10 sm:w-12 lg:w-11 text-base sm:text-lg select-none',
        compact ? 'h-10 sm:h-12 lg:h-10' : 'h-12 sm:h-14 lg:h-11',
      )}
      style={hasAny && !allAbsent ? { ['--k-ink' as string]: '#ffffff' } : undefined}
    >
      {!allAbsent && hasAny && (
        <span
          aria-hidden="true"
          className="absolute grid overflow-hidden"
          style={{
            inset: '0 0 3px 0',
            borderRadius: 9,
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
          }}
        >
          {boardStates.map((states, i) => {
            const state = states[letter];
            return <span key={i} style={{ background: state ? KEY_FACE[state] : 'rgba(255, 255, 255, 0.92)' }} />;
          })}
        </span>
      )}
      <span
        className={cn('relative z-10', hasAny && 'kkey-text')}
        style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden', WebkitFontSmoothing: 'antialiased' }}
      >
        {letter}
      </span>
    </button>
  );
}

// Memoized (founder, 2026-09-29): the game screens pass stable props (useCallback
// handlers, memoized letter states), so a tick or a message elsewhere on the
// screen no longer re-renders every key.
export const Keyboard = memo(function Keyboard({ onKey, letterStates: rawLetterStates = EMPTY_STATES, boardLetterStates: rawBoardStates, blackedOutLetters, keyFills, revealWord }: KeyboardProps) {
  const letterStates = useRevealed(rawLetterStates, revealWord);
  const boardLetterStates = useRevealed(rawBoardStates, revealWord);
  const useQuadrants = boardLetterStates && boardLetterStates.length > 1;
  const [layout, setLayout] = useState<KeyboardLayout>('standard');
  useEffect(() => {
    setLayout(getKeyboardLayout());
    return onKeyboardLayoutChange(() => setLayout(getKeyboardLayout()));
  }, []);
  const rows = LAYOUT_ROWS[layout];
  // Michael Keyboard is a row taller — shorter keys keep total height close
  // to the 3-row layouts so tight boards (OctoWord, Gauntlet) don't squeeze.
  const keyH = layout === 'michael' ? 'h-10 sm:h-12 lg:h-10' : 'h-12 sm:h-14 lg:h-11';   // §255: see Key

  return (
    <div className="flex flex-col gap-1.5 lg:gap-1 max-w-xl mx-auto" role="group" aria-label="Game keyboard" style={{ paddingBottom: 3 }}>
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
                  className={cn(keyH, 'kkey flex-1 max-w-[240px] text-xs select-none')}
                  style={{ ['--k-ink' as string]: '#8a78ad' }}
                >
                  <span>space</span>
                </button>
              );
            }

            if (isSpecial) {
              return (
                <button
                  key={`${key}-${ki}`}
                  onClick={() => { if (isBlackedOut) return; if (key === 'ENTER') haptic('medium'); else haptic('light'); if (key === 'BACK') playDelete(); else playKeyTap(); onKey(key); }}
                  disabled={isBlackedOut}
                  aria-label={key === 'BACK' ? 'Backspace' : 'Submit guess'}
                  className={cn(
                    keyH, 'kkey px-3 sm:px-4 lg:px-3 select-none flex items-center justify-center',
                    key === 'BACK' ? 'min-w-[3.25rem] sm:min-w-[4rem]' : 'text-[12px] tracking-[0.04em]',
                    isBlackedOut && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  {/* Fixed dark ink on the fixed light key face (never the theme's
                      text color, which is near-white in Dark). */}
                  {key === 'BACK' ? <span className="flex items-center justify-center w-full"><BackspaceIcon /></span> : <span>{key}</span>}
                </button>
              );
            }

            if (isBlackedOut) {
              return (
                <button
                  key={key}
                  disabled
                  aria-label={`${key}, unavailable`}
                  data-s="blocked"
                  className={cn(keyH, 'kkey w-10 sm:w-12 lg:w-11 text-base sm:text-lg opacity-60 cursor-not-allowed animate-pulse select-none')}
                >
                  <span>?</span>
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
            const fill = keyFills?.[key];
            return (
              <button
                key={key}
                onClick={() => { haptic('light'); playKeyTap(); onKey(key); }}
                aria-label={fill ? `${key}, used` : state ? `${key}, ${state}` : key}
                data-s={fill ? undefined : state}
                className={cn(keyH, 'kkey w-10 sm:w-12 text-base sm:text-lg select-none')}
                style={fill ? {
                  ['--k-face' as string]: fill,
                  ['--k-edge' as string]: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3)), ${fill}`,
                  ['--k-ink' as string]: '#ffffff',
                } : undefined}
              >
                <span className={state || fill ? 'kkey-text' : undefined}>{key}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});
