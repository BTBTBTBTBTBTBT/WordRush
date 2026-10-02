'use client';

import { Undo2, Eraser, X, Lightbulb } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { playKeyTap } from '@/lib/sounds';
import { REGIONS_ACCENT } from './copy';
import { candyClass } from '@/components/ui/candy-button';

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
  // FINISH_SPEC A8: the action capsules are small glossy candy buttons (components/ui/candy-button.tsx).
  const capsule = (active: boolean, dim: boolean) => candyClass({ dim, color: active ? 'amber' : 'purple' });
  const capsuleStyle = (_active: boolean, _dim: boolean) => undefined;

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
