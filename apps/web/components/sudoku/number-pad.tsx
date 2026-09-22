'use client';

import { Undo2, Eraser, Pencil, Lightbulb } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { playKeyTap } from '@/lib/sounds';
import { SUDOKU_ACCENT } from './sudoku-board';

// The number pad reads as "a smaller keyboard" (§8): the same key radius,
// ink and press feel as components/game/keyboard.tsx, nine keys in one row.
// The action row is the ProperNoundle capsule style — Undo · Erase · Notes ·
// Hint — EACH with its icon (founder round 13: undo arrow, eraser, pencil,
// lightbulb). Notes is a toggle: fixed label, shows its state by filling with
// the accent, never by changing the word.

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
  const capsule = (active: boolean, dim: boolean) =>
    `flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
      dim ? 'border-gray-200 text-gray-300 cursor-not-allowed'
        : active ? 'text-white' : 'hover:opacity-80'
    }`;
  const capsuleStyle = (active: boolean, dim: boolean) =>
    dim ? undefined
      : active ? { background: SUDOKU_ACCENT, borderColor: SUDOKU_ACCENT }
      : { borderColor: `${SUDOKU_ACCENT}66`, color: SUDOKU_ACCENT, background: `${SUDOKU_ACCENT}0d` };

  return (
    <div className="flex flex-col gap-2 max-w-xl mx-auto w-full" role="group" aria-label="Number pad">
      <div className="flex justify-center gap-2 px-1">
        <button type="button" onClick={tap(onUndo)} disabled={disabled || !canUndo} className={capsule(false, disabled || !canUndo)} style={capsuleStyle(false, disabled || !canUndo)} aria-label="Undo">
          <Undo2 className="w-3.5 h-3.5" /> Undo
        </button>
        <button type="button" onClick={tap(onErase)} disabled={disabled} className={capsule(false, disabled)} style={capsuleStyle(false, disabled)} aria-label="Erase">
          <Eraser className="w-3.5 h-3.5" /> Erase
        </button>
        <button type="button" onClick={tap(onToggleNotes)} disabled={disabled} className={capsule(notesMode, disabled)} style={capsuleStyle(notesMode, disabled)} aria-pressed={notesMode} aria-label="Notes">
          <Pencil className="w-3.5 h-3.5" /> Notes
        </button>
        <button type="button" onClick={tap(onHint)} disabled={disabled} className={capsule(false, disabled)} style={capsuleStyle(false, disabled)} aria-label="Hint">
          <Lightbulb className="w-3.5 h-3.5" /> Hint{hintsUsed > 0 ? ` · ${hintsUsed}` : ''}
        </button>
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
              className={`flex-1 max-w-[52px] h-12 sm:h-14 lg:h-11 rounded-md font-black text-lg sm:text-xl transition-all duration-150 select-none active:scale-95 ${done ? 'opacity-40' : ''}`}
              style={{
                backgroundColor: notesMode ? `${SUDOKU_ACCENT}14` : '#e8e5f0',
                border: `1.5px solid ${notesMode ? `${SUDOKU_ACCENT}55` : 'var(--color-border)'}`,
                color: '#1a1a2e',
                boxShadow: '0 2px 0 rgba(0,0,0,0.06)',
              }}
              aria-label={`${notesMode ? 'Note ' : ''}${d}`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
