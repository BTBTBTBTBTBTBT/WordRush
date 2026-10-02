'use client';

import { Undo2, Eraser, X, Lightbulb } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { playKeyTap } from '@/lib/sounds';
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
  // FINISH_SPEC A8 / H: every action is a small glossy candy pill (components/ui/candy-button.tsx)
  // with its icon in the candy white-with-outline treatment; Auto-cross turns amber while on.
  const capsule = (active: boolean, dim: boolean) => candyClass({ dim, color: active ? 'amber' : 'purple' });
  const icon = 'w-3.5 h-3.5';

  return (
    <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 px-1 max-w-xl mx-auto w-full" role="group" aria-label="Starsweep controls">
      <button type="button" onClick={tap(onUndo)} disabled={disabled || !canUndo} className={capsule(false, disabled || !canUndo)} aria-label="Undo">
        <Undo2 className={icon} strokeWidth={3} /><span className="candy-label">Undo</span>
      </button>
      <button type="button" onClick={tap(onErase)} disabled={disabled || !canErase} className={capsule(false, disabled || !canErase)} aria-label="Erase">
        <Eraser className={icon} strokeWidth={3} /><span className="candy-label">Erase</span>
      </button>
      <button type="button" onClick={tap(onToggleAutoCross)} disabled={disabled} className={capsule(autoCross, disabled)} aria-pressed={autoCross} aria-label="Auto-cross">
        <X className={icon} strokeWidth={3.5} /><span className="candy-label">Auto-cross</span>
      </button>
      <button type="button" onClick={tap(onHint)} disabled={disabled} className={capsule(false, disabled)} aria-label="Hint">
        <Lightbulb className={icon} strokeWidth={3} /><span className="candy-label">Hint{hintsUsed > 0 ? ` · ${hintsUsed}` : ''}</span>
      </button>
    </div>
  );
}
