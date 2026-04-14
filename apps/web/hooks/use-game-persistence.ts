'use client';

import { useEffect, useRef, useState } from 'react';
import { GameMode, GameStatus } from '@wordle-duel/core';
import { getTodayUTC } from '@/lib/daily-service';

// Bump this when the save format or solution list changes to invalidate old data
// v2: getAllGuesses fix for multi-board games
// v3: solutions.json changed (213 words removed), invalidating seed-to-solution mapping
const SAVE_VERSION = 3;

interface SavedGameState {
  version?: number;
  date: string;
  seed: string;
  mode: string;
  guesses: string[];
  elapsedTime: number;
  gameStatus: string;
}

function getStorageKey(mode: GameMode): string {
  return `spellstrike-daily-${mode}`;
}

function loadSavedState(mode: GameMode, seed: string): SavedGameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(getStorageKey(mode));
    if (!stored) return null;
    const parsed: SavedGameState = JSON.parse(stored);
    if (parsed.date !== getTodayUTC()) {
      localStorage.removeItem(getStorageKey(mode));
      return null;
    }
    if (parsed.seed !== seed) {
      localStorage.removeItem(getStorageKey(mode));
      return null;
    }
    if (parsed.version !== SAVE_VERSION) {
      localStorage.removeItem(getStorageKey(mode));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveState(mode: GameMode, seed: string, guesses: string[], elapsedTime: number, gameStatus: string): void {
  if (typeof window === 'undefined') return;
  const state: SavedGameState = {
    version: SAVE_VERSION,
    date: getTodayUTC(),
    seed,
    mode,
    guesses,
    elapsedTime,
    gameStatus,
  };
  localStorage.setItem(getStorageKey(mode), JSON.stringify(state));
}

interface GameState {
  mode: GameMode;
  seed: string;
  startTime: number;
  boards: Array<{ solution: string; guesses: string[]; maxGuesses: number; status: string }>;
  currentBoardIndex: number;
  status: string;
}

type GameAction = any;

/**
 * Hook for persisting daily game state in localStorage.
 * Replays saved guesses on mount to restore game progress.
 * Only active when isDaily is true.
 */
export function useGamePersistence(
  mode: GameMode,
  isDaily: boolean,
  seed: string,
  state: GameState,
  dispatch: React.Dispatch<GameAction>,
  elapsedTime: number,
): {
  isRestored: boolean;
  restoredElapsedTime: number;
} {
  const [isRestored, setIsRestored] = useState(false);
  const [restoredElapsedTime, setRestoredElapsedTime] = useState(0);
  const hasReplayed = useRef(false);
  const prevGuessCount = useRef(0);

  // Replay saved guesses on mount
  useEffect(() => {
    if (!isDaily || hasReplayed.current) return;
    hasReplayed.current = true;

    const saved = loadSavedState(mode, seed);
    if (!saved || saved.guesses.length === 0) return;

    // Replay each guess to all playing boards
    for (const guess of saved.guesses) {
      // For single-board games, dispatch without boardIndex (defaults to currentBoardIndex)
      // For multi-board games, dispatch to each playing board
      if (state.boards.length === 1) {
        dispatch({ type: 'SUBMIT_GUESS', guess });
      } else {
        state.boards.forEach((board, index) => {
          if (board.status === 'PLAYING') {
            dispatch({ type: 'SUBMIT_GUESS', guess, boardIndex: index });
          }
        });
      }
    }

    setRestoredElapsedTime(saved.elapsedTime);
    setIsRestored(true);
    prevGuessCount.current = saved.guesses.length;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // For multi-board games, the board with the most guesses has the complete set
  // (each guess goes to all playing boards, so the last-solved board has all guesses)
  const getAllGuesses = () => {
    return state.boards.reduce<string[]>((longest, board) =>
      board.guesses.length > longest.length ? board.guesses : longest, []);
  };

  // Save after each new guess
  useEffect(() => {
    if (!isDaily) return;
    const currentGuesses = getAllGuesses();
    if (currentGuesses.length === 0) return;
    // Don't save during replay
    if (currentGuesses.length <= prevGuessCount.current && state.status === 'PLAYING') return;
    prevGuessCount.current = currentGuesses.length;

    saveState(mode, seed, currentGuesses, elapsedTime, state.status);
  }, [state.boards, state.status, isDaily, mode, seed, elapsedTime]);

  // Save on game completion
  useEffect(() => {
    if (!isDaily) return;
    if (state.status === 'WON' || state.status === 'LOST') {
      const currentGuesses = getAllGuesses();
      saveState(mode, seed, currentGuesses, elapsedTime, state.status);
    }
  }, [state.status, isDaily, mode, seed, elapsedTime, state.boards]);

  if (!isDaily) {
    return { isRestored: false, restoredElapsedTime: 0 };
  }

  return { isRestored, restoredElapsedTime };
}
