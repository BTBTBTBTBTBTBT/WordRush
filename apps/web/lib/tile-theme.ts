import { TileState } from '@wordle-duel/core';

/**
 * Royal tile palette — the single source of truth for game-state colors on
 * web. Class consumers use getTileClasses/getKeyClasses (the .tile-* / .key-*
 * utilities in globals.css read CSS vars, so the colorblind toggle and dark
 * theme apply automatically). Canvas/inline-style consumers (share-image.ts,
 * VS mini boards) use the hex exports below — these are the base Royal values
 * and do NOT react to colorblind/theme, matching the previous behavior of
 * those surfaces.
 */

// ── Hex tokens (canvas / inline styles / gradients) ────────────────────────
export const TILE_HEX = {
  correct: '#7c3aed',
  present: '#f59e0b',
  absent: '#9ca3af',
  absentDeep: '#64748b',
  empty: '#e5e7eb',
  emptyBorder: '#d1d5db',
} as const;

export const KEY_HEX = {
  correct: '#6d28d9',
  present: '#d97706',
  absent: '#94a3b8',
} as const;

// Win/Loss pill + board tints (share image, finished screens).
export const WIN_FG = '#7c3aed';
export const WIN_BG = '#f5f3ff'; // violet-50
export const LOSS_FG = '#dc2626';
export const LOSS_BG = '#fee2e2';
export const BOARD_WIN_TINT = '#f5f3ff'; // violet-50
export const BOARD_LOSS_TINT = '#fef2f2'; // red-50

// Gradient pairs (VS tug-of-war, victory accents).
export const CORRECT_GRADIENT: [string, string] = ['#7c3aed', '#6d28d9'];
export const PRESENT_GRADIENT: [string, string] = ['#f59e0b', '#d97706'];

// Violet ramp for the profile activity calendar (replaces the green ramp).
export const CALENDAR_RAMP = ['#ddd6fe', '#a78bfa', '#7c3aed'] as const;

// ── Class tokens (Tailwind-purge-safe static strings) ──────────────────────
const TILE_CLASS: Record<string, string> = {
  correct: 'tile-correct',
  present: 'tile-present',
  absent: 'tile-absent',
};

const KEY_CLASS: Record<string, string> = {
  correct: 'key-correct',
  present: 'key-present',
  absent: 'key-absent',
};

function norm(state: TileState | string): string {
  // TileState is a string enum (CORRECT/PRESENT/ABSENT/EMPTY/HINT_USED);
  // some callers pass lowercase strings. HINT_USED renders as present.
  switch (String(state).toUpperCase()) {
    case 'CORRECT': return 'correct';
    case 'PRESENT': return 'present';
    case 'HINT_USED': return 'present';
    case 'ABSENT': return 'absent';
    default: return 'empty';
  }
}

/** Board tile classes for a tile state ('' for EMPTY — callers keep their own empty/border treatment). */
export function getTileClasses(state: TileState | string): string {
  return TILE_CLASS[norm(state)] ?? '';
}

/** Keyboard key classes for a letter state ('' for unused keys). */
export function getKeyClasses(state: TileState | string): string {
  return KEY_CLASS[norm(state)] ?? '';
}

/** Hex values for a tile state (canvas / inline styles). */
export function getTileHex(
  state: TileState | string,
): { bg: string; border: string; text: string } {
  switch (norm(state)) {
    case 'correct': return { bg: TILE_HEX.correct, border: TILE_HEX.correct, text: '#ffffff' };
    case 'present': return { bg: TILE_HEX.present, border: TILE_HEX.present, text: '#ffffff' };
    case 'absent': return { bg: TILE_HEX.absentDeep, border: TILE_HEX.absentDeep, text: '#ffffff' };
    default: return { bg: '#ffffff', border: TILE_HEX.emptyBorder, text: '#1a1a2e' };
  }
}
