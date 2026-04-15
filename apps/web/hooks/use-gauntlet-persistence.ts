'use client';

import { useEffect, useRef } from 'react';
import { GameState, GameStatus, GameMode } from '@wordle-duel/core';
import { getTodayUTC } from '@/lib/daily-service';

// Full-state snapshot persistence for Gauntlet. Unlike the flat-guess-replay
// approach in useGamePersistence, Gauntlet has multi-stage state (current
// stage, per-stage results, stage-specific boards) that can't be reconstructed
// by replaying guesses against a fresh init. So we serialize the entire
// reducer state and restore it wholesale on mount.
//
// Bump SAVE_VERSION when the core GameState shape changes so old saves are
// discarded instead of crashing.
const SAVE_VERSION = 1;
const STORAGE_KEY = 'spellstrike-gauntlet-session';
const PRACTICE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface SavedGauntletSession {
  version: number;
  date: string;      // YYYY-MM-DD at save time
  isDaily: boolean;
  seed: string;
  elapsedTime: number;
  savedAt: number;
  state: GameState;
}

export interface RestoredGauntletSession {
  seed: string;
  state: GameState;
  elapsedTime: number;
}

/**
 * Look up a previously saved gauntlet session. Returns null if:
 * - No session saved
 * - Save is from a different version, day (for daily), or older than the
 *   practice TTL
 * - Daily/practice mode mismatches
 * - Saved state was already completed (WON/LOST/ABANDONED)
 *
 * Callers are expected to call this from a lazy initializer so the result is
 * stable across re-renders.
 */
export function loadGauntletSession(isDaily: boolean): RestoredGauntletSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed: SavedGauntletSession = JSON.parse(stored);

    if (parsed.version !== SAVE_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (parsed.isDaily !== isDaily) {
      // Cross-mode leak prevention: daily save shouldn't restore into a
      // practice session and vice versa.
      return null;
    }
    if (isDaily) {
      if (parsed.date !== getTodayUTC()) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
    } else {
      if (Date.now() - parsed.savedAt > PRACTICE_TTL_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
    }
    if (parsed.state.mode !== GameMode.GAUNTLET) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (parsed.state.status !== GameStatus.PLAYING) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      seed: parsed.seed,
      state: parsed.state,
      elapsedTime: parsed.elapsedTime,
    };
  } catch {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    return null;
  }
}

function saveGauntletSession(
  seed: string,
  isDaily: boolean,
  state: GameState,
  elapsedTime: number,
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: SavedGauntletSession = {
      version: SAVE_VERSION,
      date: getTodayUTC(),
      isDaily,
      seed,
      elapsedTime,
      savedAt: Date.now(),
      state,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage quota / private mode — skip silently
  }
}

export function clearGauntletSession(): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

/**
 * Hook that keeps a gauntlet session saved to localStorage and clears it on
 * completion. Call this once in the GauntletGame component after the reducer
 * is set up. Save triggers on every state or elapsedTime change.
 */
export function useGauntletPersistence(
  seed: string,
  isDaily: boolean,
  state: GameState,
  elapsedTime: number,
): void {
  // Defer the first save by one tick so we don't immediately overwrite a
  // freshly-loaded session with an identical snapshot.
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    if (state.mode !== GameMode.GAUNTLET) return;
    if (state.status !== GameStatus.PLAYING) {
      // Game ended — clear the save so the next visit starts fresh
      clearGauntletSession();
      return;
    }
    saveGauntletSession(seed, isDaily, state, elapsedTime);
  }, [seed, isDaily, state, elapsedTime]);
}
