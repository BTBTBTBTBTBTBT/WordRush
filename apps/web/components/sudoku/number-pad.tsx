'use client';

import { Undo2, Eraser, Pencil, Lightbulb } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { playKeyTap } from '@/lib/sounds';
import { SUDOKU_ACCENT } from './sudoku-board';
import { CandyButton } from '@/components/ui/candy-button';

// The number pad reads as "a smaller keyboard" (§8; FINISH_SPEC B2): the same
// tile keys as components/game/keyboard.tsx (lilac lip, light face, dark
// purple digits), nine keys in one row. The action row — Undo · Erase · Notes
// · Hint — is small candy buttons (A8), EACH with its icon (founder round 13:
// undo arrow, eraser, pencil, lightbulb). Notes is a toggle: fixed label,
// shows its state by turning amber, never by changing the word.

interface NumberPadProps {
  onDigit: (d: number) => void;
  onUndo: () => void;
  onErase: () => void;
  onToggleNotes: () => void;
  onHint: () => void;
  notesMode: boolean;
  canUndo: boolean;
  hintsUsed: number;
  /** Digits already placed 9 times (correctly) are dimmed. */
  completeDigits: Set<number>;
  disabled?: boolean;
}

export function NumberPad({ onDigit, onUndo, onErase, onToggleNotes, onHint, notesMode, canUndo, hintsUsed, completeDigits, disabled = false }: NumberPadProps) {
  const tap = (fn: () => void) => () => { if (disabled) return; haptic('light'); playKeyTap(); fn(); };
  return (
    <div className="flex flex-col gap-2 max-w-xl mx-auto w-full" role="group" aria-label="Number pad">
      <div className="flex justify-center flex-wrap gap-2 px-1">
        <CandyButton size="sm" color="purple" onClick={tap(onUndo)} disabled={disabled || !canUndo} aria-label="Undo" icon={<Undo2 className="w-3.5 h-3.5" aria-hidden="true" />}>Undo</CandyButton>
        <CandyButton size="sm" color="purple" onClick={tap(onErase)} disabled={disabled} aria-label="Erase" icon={<Eraser className="w-3.5 h-3.5" aria-hidden="true" />}>Erase</CandyButton>
        <CandyButton size="sm" color={notesMode ? 'amber' : 'purple'} onClick={tap(onToggleNotes)} disabled={disabled} aria-pressed={notesMode} aria-label="Notes" icon={<Pencil className="w-3.5 h-3.5" aria-hidden="true" />}>Notes</CandyButton>
        <CandyButton size="sm" color="teal" onClick={tap(onHint)} disabled={disabled} aria-label="Hint" icon={<Lightbulb className="w-3.5 h-3.5" aria-hidden="true" />}>
          Hint{hintsUsed > 0 ? ` · ${hintsUsed}` : ''}
        </CandyButton>
      </div>
      <div className="flex gap-1 justify-center px-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
          const done = completeDigits.has(d);
          return (
            <button
              key={d}
              type="button"
              onClick={tap(() => onDigit(d))}
              disabled={disabled}
              className={`kkey flex-1 max-w-[52px] h-12 sm:h-14 lg:h-11 text-lg sm:text-xl select-none ${done ? 'opacity-40' : ''}`}
              style={notesMode ? { ['--k-face' as string]: `linear-gradient(${SUDOKU_ACCENT}1f, ${SUDOKU_ACCENT}1f), #ffffff`, ['--k-edge' as string]: `${SUDOKU_ACCENT}88` } : undefined}
              aria-label={`${notesMode ? 'Note ' : ''}${d}`}
            >
              <span>{d}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
