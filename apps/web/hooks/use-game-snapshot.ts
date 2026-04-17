'use client';

import { useEffect, useRef, useState } from 'react';
import { GameState, GameStatus, GameMode } from '@wordle-duel/core';
import { getTodayUTC } from '@/lib/daily-service';

// Full-state snapshot persistence shared by every reducer-based game mode.
// Unlike a flat guess-replay approach, this serializes the entire reducer
// state so multi-board and multi-stage modes (Gauntlet especially) can
// resume mid-game exactly where the player left off without rerunning
// dictionary lookups or prefill generation.
//
// Bump SAVE_VERSION when the core GameState shape changes so old saves are
// discarded instead of being restored into an incompatible reducer.
const SAVE_VERSION = 1;
const PRACTICE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function getStorageKey(mode: GameMode, isDaily: boolean): string {
  return `wordocious-session-${mode}-${isDaily ? 'daily' : 'practice'}`;
}

interface SavedSession {
  version: number;
  date: string;      // YYYY-MM-DD at save time
  mode: GameMode;
  isDaily: boolean;
  seed: string;
  elapsedTime: number;
  savedAt: number;
  state: GameState;
}

export interface RestoredSession {
  seed: string;
  state: GameState;
  elapsedTime: number;
  /** True if the saved state was already terminal (WON/LOST/ABANDONED).
   *  Callers use this to suppress victory animations and duplicate stat
   *  recording when a completed game is loaded back in on navigate-return. */
  isCompleted: boolean;
}

/**
 * Look up a previously saved game session for this mode + mode-variant
 * (daily vs practice). Returns null if:
 * - No session saved
 * - Save is from a different version or game mode
 * - Daily: save is from a different UTC day
 * - Practice: save is older than the 24h TTL
 *
 * Terminal saves (WON/LOST/ABANDONED) ARE returned so that navigating
 * back to a completed daily shows the finished board instead of a fresh
 * one. Callers check `isCompleted` to gate re-triggering animations and
 * stat recording.
 *
 * Daily and practice have separate storage keys so a mid-game practice
 * session can't leak into daily and vice versa.
 *
 * Callers are expected to invoke this from a lazy initializer so the result
 * is stable across re-renders.
 */
export function loadGameSession(mode: GameMode, isDaily: boolean): RestoredSession | null {
  if (typeof window === 'undefined') return null;
  const key = getStorageKey(mode, isDaily);
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const parsed: SavedSession = JSON.parse(stored);

    if (parsed.version !== SAVE_VERSION) {
      localStorage.removeItem(key);
      return null;
    }
    if (parsed.mode !== mode) {
      localStorage.removeItem(key);
      return null;
    }
    if (parsed.isDaily !== isDaily) {
      // Key should prevent this, but double-check in case a user manually
      // copies storage across keys.
      return null;
    }
    if (isDaily) {
      if (parsed.date !== getTodayUTC()) {
        localStorage.removeItem(key);
        return null;
      }
    } else {
      if (Date.now() - parsed.savedAt > PRACTICE_TTL_MS) {
        localStorage.removeItem(key);
        return null;
      }
    }
    if (parsed.state.mode !== mode) {
      localStorage.removeItem(key);
      return null;
    }
    return {
      seed: parsed.seed,
      state: parsed.state,
      elapsedTime: parsed.elapsedTime,
      isCompleted: parsed.state.status !== GameStatus.PLAYING,
    };
  } catch {
    try { localStorage.removeItem(key); } catch {}
    return null;
  }
}

function saveGameSession(
  mode: GameMode,
  isDaily: boolean,
  seed: string,
  state: GameState,
  elapsedTime: number,
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: SavedSession = {
      version: SAVE_VERSION,
      date: getTodayUTC(),
      mode,
      isDaily,
      seed,
      elapsedTime,
      savedAt: Date.now(),
      state,
    };
    localStorage.setItem(getStorageKey(mode, isDaily), JSON.stringify(payload));
  } catch {
    // localStorage quota / private mode — skip silently
  }
}

export function clearGameSession(mode: GameMode, isDaily: boolean): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(getStorageKey(mode, isDaily)); } catch {}
}

/**
 * Hook that keeps a game session saved to localStorage. Save triggers on
 * every state or elapsedTime change, including terminal transitions so a
 * user who navigates away after winning can return and see the finished
 * board (with `isCompleted=true` to suppress re-animating). Defers the
 * first save by one tick so a freshly-loaded session isn't immediately
 * overwritten by an identical snapshot.
 *
 * Save cleanup is handled passively by date/TTL gating in {@link loadGameSession}
 * — next-day loads on daily and 24h+ loads on practice return null and
 * purge the key at that point.
 *
 * Use alongside {@link loadGameSession} to restore state on mount:
 *
 * ```ts
 * const [savedSession] = useState(() => loadGameSession(mode, isDaily));
 * const [seed] = useState(() => savedSession?.seed ?? generateSeed());
 * const [state, dispatch] = useReducer(
 *   gameReducer,
 *   seed,
 *   (s) => savedSession?.state ?? createInitialState(s, mode),
 * );
 * const [elapsedTime, setElapsedTime] = useState(() => savedSession?.elapsedTime ?? 0);
 * const startTimeRef = useRef(Date.now() - (savedSession?.elapsedTime ?? 0) * 1000);
 * useGameSnapshot(mode, isDaily, seed, state, elapsedTime);
 * ```
 */
export function useGameSnapshot(
  mode: GameMode,
  isDaily: boolean,
  seed: string,
  state: GameState,
  elapsedTime: number,
): void {
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    if (state.mode !== mode) return;
    saveGameSession(mode, isDaily, seed, state, elapsedTime);
  }, [mode, isDaily, seed, state, elapsedTime]);
}
