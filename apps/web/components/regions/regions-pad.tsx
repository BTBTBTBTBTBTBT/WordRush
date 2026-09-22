'use client';

import { Undo2, Eraser, X, Lightbulb } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { playKeyTap } from '@/lib/sounds';
import { REGIONS_ACCENT } from './copy';

// The Starsweep action row (§18b, §19): ProperNoundle-style capsules —
// Undo · Erase · Auto-cross · Hint — EACH with its icon. Auto-cross is a
// toggle with a fixed label that shows its state by filling with the accent.

interface RegionsPadProps {
  onUndo: () => void;
  onErase: () => void;
  onToggleAutoCross: () => void;
  onHint: () => void;
  autoCross: boolean;
  canUndo: boolean;
  canErase: boolean;
  hintsUsed: number;
  disabled?: boolean;
}

export function RegionsPad({ onUndo, onErase, onToggleAutoCross, onHint, autoCross, canUndo, canErase, hintsUsed, disabled = false }: RegionsPadProps) {
  const tap = (fn: () => void) => () => { if (disabled) return; haptic('light'); playKeyTap(); fn(); };
  const capsule = (active: boolean, dim: boolean) =>
    `flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
      dim ? 'border-gray-200 text-gray-300 cursor-not-allowed' : active ? 'text-white' : 'hover:opacity-80'
    }`;
  const capsuleStyle = (active: boolean, dim: boolean) =>
    dim ? undefined
      : active ? { background: REGIONS_ACCENT, borderColor: REGIONS_ACCENT }
      : { borderColor: `${REGIONS_ACCENT}66`, color: REGIONS_ACCENT, background: `${REGIONS_ACCENT}0d` };

  return (
    <div className="flex justify-center gap-2 px-1 max-w-xl mx-auto w-full" role="group" aria-label="Starsweep controls">
      <button type="button" onClick={tap(onUndo)} disabled={disabled || !canUndo} className={capsule(false, disabled || !canUndo)} style={capsuleStyle(false, disabled || !canUndo)} aria-label="Undo">
        <Undo2 className="w-3.5 h-3.5" /> Undo
      </button>
      <button type="button" onClick={tap(onErase)} disabled={disabled || !canErase} className={capsule(false, disabled || !canErase)} style={capsuleStyle(false, disabled || !canErase)} aria-label="Erase">
        <Eraser className="w-3.5 h-3.5" /> Erase
      </button>
      <button type="button" onClick={tap(onToggleAutoCross)} disabled={disabled} className={capsule(autoCross, disabled)} style={capsuleStyle(autoCross, disabled)} aria-pressed={autoCross} aria-label="Auto-cross">
        <X className="w-3.5 h-3.5" /> Auto-cross
      </button>
      <button type="button" onClick={tap(onHint)} disabled={disabled} className={capsule(false, disabled)} style={capsuleStyle(false, disabled)} aria-label="Hint">
        <Lightbulb className="w-3.5 h-3.5" /> Hint{hintsUsed > 0 ? ` · ${hintsUsed}` : ''}
      </button>
    </div>
  );
}
