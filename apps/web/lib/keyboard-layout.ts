'use client';

/**
 * Keyboard layout preference (§213) — three arrangements of the same keys:
 *  - standard: 3 rows, ENTER left / delete right (the shipped default)
 *  - flipped:  3 rows, delete left / ENTER right (the original arrangement)
 *  - michael:  4 phone-style rows — delete at BOTH ends of the Z row, ENTER
 *              at BOTH ends of a bottom row around a decorative space bar.
 *              Named for the founder's brother, who asked for it.
 * Pure rendering: game logic, letter states, and the engine never see this.
 */
export type KeyboardLayout = 'standard' | 'flipped' | 'michael';

const KEY = 'keyboard-layout';
const listeners = new Set<() => void>();

export function getKeyboardLayout(): KeyboardLayout {
  if (typeof window === 'undefined') return 'standard';
  const v = localStorage.getItem(KEY);
  return v === 'flipped' || v === 'michael' ? v : 'standard';
}

export function setKeyboardLayout(v: KeyboardLayout): void {
  try { localStorage.setItem(KEY, v); } catch { /* private mode */ }
  listeners.forEach((l) => l());
}

export function onKeyboardLayoutChange(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
