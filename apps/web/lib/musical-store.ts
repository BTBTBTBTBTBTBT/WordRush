'use client';

// The musical cast's app-wide state (FRIDAY-QUEUE item 4b, founder 10-06): once the cast turns musical it STAYS musical
// on every page with the header (Home, Leaderboard, Stats, Friends, games …) until a long-press turns it back. One
// module-level store every CastHeader reads, so a page change (which remounts the header) keeps it. Never persisted:
// a reload / app restart is normal again (decided). The melody buffer lives here too, so a tune can span pages.
// iOS: MusicalCastStore (app state) · Android: MusicalCastKit's top-level state.

import { useSyncExternalStore } from 'react';
import { MELODY_START, type MelodyState } from '@wordle-duel/core';

let musical = false;
const listeners = new Set<() => void>();

export function getMusical(): boolean {
  return musical;
}

export function setMusicalOn(on: boolean): void {
  if (musical === on) return;
  musical = on;
  listeners.forEach((l) => l());
}

export function toggleMusicalOn(): boolean {
  setMusicalOn(!musical);
  return musical;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Whether the cast is musical right now, shared by every header. */
export function useMusical(): boolean {
  return useSyncExternalStore(subscribe, getMusical, () => false);
}

/** The tune matcher's buffer, shared across headers (a mutable cell, like a ref). */
export const melodyCell: { current: MelodyState } = { current: MELODY_START };
