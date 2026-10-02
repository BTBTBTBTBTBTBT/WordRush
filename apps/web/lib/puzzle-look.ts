import type { CSSProperties } from 'react';
import { TRAY } from './game-tray';
import { SOFT, alphaHex, darken, overAlpha, softMix } from './soft-surface';

// FINISH_SPEC J3 (code-only polish, no new art) for the four puzzle boards —
// Crosswordocious, Kindred, Cipher (Codebreaker) and Spyglass: which B1 tile
// look a cell wears, the glossy / tinted chip recipes (tinted face, a darker
// bottom lip, a top gloss), and the GameTray chrome a board fit must leave
// room for. Pure, no hooks; the tile CSS is globals.css `.gtile` plus the
// "J3 · puzzle boards" block (`.pz-cell`, `.pz-num`, data-s="hint").

/** The B1 tile looks these boards use: `hint` = a revealed letter (violet face, thin gold rim). */
export type PuzzleTileLook = 'empty' | 'typed' | 'correct' | 'given' | 'hint';

/** Crosswordocious cell: revealed = hint violet, checked + locked = purple, a penciled letter = typed, else the frosted empty tile. */
export function crosswordCellLook({ letter, locked, revealed }: { letter: string; locked: boolean; revealed: boolean }): PuzzleTileLook {
  if (revealed) return 'hint';
  if (locked) return 'correct';
  return letter ? 'typed' : 'empty';
}

/**
 * Cipher cell: a hinted letter = hint violet, one of the three given letters =
 * the plain light "given" tile, a checked-right (locked) letter = purple, every
 * right letter once the round is over = purple, a penciled letter = typed.
 */
export function cipherCellLook({ plain, locked, hinted, given, finished, correct }: {
  plain: string; locked: boolean; hinted: boolean; given: boolean; finished: boolean; correct: boolean;
}): PuzzleTileLook {
  if (locked && hinted) return 'hint';
  if (locked && given) return 'given';
  if (locked) return 'correct';
  if (finished && correct && plain) return 'correct';
  return plain ? 'typed' : 'empty';
}

/**
 * The cells that just switched ON between two per-cell mask strings (the
 * crossword's `locked` '0'/'1' and `revealed` '.'/x masks), in reading order:
 * the ones that play the lock flip / hint glow. A first render (no `prev`) or
 * a different-length board (a new puzzle) plays nothing.
 */
export function cellsTurnedOn(prev: string | null | undefined, next: string, isOn: (ch: string) => boolean): number[] {
  if (prev == null || prev.length !== next.length) return [];
  const out: number[] = [];
  for (let i = 0; i < next.length; i++) if (isOn(next[i]) && !isOn(prev[i])) out.push(i);
  return out;
}

/** Stagger between tiles turning over after a Check (ms), capped so a big Check still lands quickly. */
export const LOCK_FLIP = { stagger: 70, maxSteps: 10 } as const;
export function lockFlipDelay(order: number): number {
  return Math.min(order, LOCK_FLIP.maxSteps) * LOCK_FLIP.stagger;
}

/** The px a GameTray adds around its content: padding + border on each side, plus the bottom lip. */
export function trayChrome(padding: number = TRAY.padding, border = 1.5): { x: number; y: number } {
  return { x: 2 * (padding + border), y: 2 * (padding + border) + TRAY.lip };
}

/** A top-half white gloss layer; tinted chips dim it in the dark theme through --pz-gloss. */
export function glossLayer(alpha: number | string = 'var(--pz-gloss, 0.5)'): string {
  return `linear-gradient(rgba(255, 255, 255, ${alpha}), rgba(255, 255, 255, 0) 52%)`;
}

/** The accent's glossy fill: a lighter top, the accent at 70%, a slightly deeper bottom. */
export function glossyFill(accent: string): string {
  return `linear-gradient(${softMix(accent, 0.72)}, ${accent} 70%, ${darken(accent, 0.08)})`;
}

/**
 * A filled glossy chip / capsule in the accent (Kindred's selected word,
 * Spyglass's found words): the glossy fill, a white top gloss, a darker bottom
 * lip, a thin deeper rim and a soft accent shadow — or a soft glow. White ink.
 */
export function glossyChip(accent: string, { lip = 4, glow = false }: { lip?: number; glow?: boolean } = {}): CSSProperties {
  return {
    background: `${glossLayer(0.42)}, ${glossyFill(accent)}`,
    boxShadow: [
      lip > 0 ? `inset 0 -${lip}px 0 ${darken(accent, 0.35)}` : null,
      `inset 0 0 0 1px ${alphaHex(darken(accent, 0.3), 0.45)}`,
      glow ? `0 0 12px 1px ${alphaHex(accent, 0.55)}` : `0 3px 8px ${alphaHex(accent, 0.3)}`,
    ].filter(Boolean).join(', '),
    color: '#ffffff',
    textShadow: `0 1px 1px ${alphaHex(darken(accent, 0.5), 0.55)}`,
  };
}

/**
 * A tinted glossy chip (A1, never plain white): the accent's wash over the
 * card base (dark mode keeps its dark surface), a top gloss, a soft accent
 * rim and a darker bottom lip. Ink is the caller's (var(--color-text)).
 */
export function tintedChip(accent: string, { lip = 4, share = 0.12 }: { lip?: number; share?: number } = {}): CSSProperties {
  const wash = alphaHex(accent, share);
  return {
    background: `${glossLayer()}, linear-gradient(${wash}, ${wash}), var(--color-card-base, #ffffff)`,
    boxShadow: [
      lip > 0 ? `inset 0 -${lip}px 0 ${alphaHex(darken(accent, 0.2), 0.3)}` : null,
      `inset 0 0 0 1.5px ${alphaHex(accent, overAlpha(SOFT.line, share))}`,
      `0 3px 8px ${alphaHex(accent, 0.14)}`,
    ].filter(Boolean).join(', '),
  };
}
