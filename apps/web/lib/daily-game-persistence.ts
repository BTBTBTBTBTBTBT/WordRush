/**
 * Daily game persistence — saves/restores daily game state from localStorage.
 * Allows players to see their completed daily board when returning.
 * Also persists in-progress games so players can resume after navigating away.
 */

const STORAGE_PREFIX = 'spellstrike-daily-game';

function getTodayUTC(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

function getKey(mode: string): string {
  return `${STORAGE_PREFIX}-${mode}-${getTodayUTC()}`;
}

export interface SavedDailyGame {
  guesses: string[];
  status: 'playing' | 'won' | 'lost';
  elapsedTime: number;
}

export function saveDailyGame(mode: string, guesses: string[], status: 'playing' | 'won' | 'lost', elapsedTime: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getKey(mode), JSON.stringify({ guesses, status, elapsedTime }));
}

export function getSavedDailyGame(mode: string): SavedDailyGame | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(getKey(mode));
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/** Clean up old daily game saves (call on app load) */
export function cleanupDailyGameSaves(): void {
  if (typeof window === 'undefined') return;
  const todayStr = getTodayUTC();
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX) && !key.endsWith(todayStr)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
}
