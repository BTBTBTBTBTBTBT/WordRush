// Crosswordocious save/restore (More Games §13). Same shape as the other More
// Games saves: a day-keyed daily save (fail-closed on date OR seed mismatch)
// and a 24 h practice save. The reducer state is stored whole.

import type { CrosswordState } from '@wordle-duel/core';
import { getTodayLocal } from '@/lib/daily-service';

const DAILY_KEY = 'wordocious-crossword-daily';
const PRACTICE_KEY = 'wordocious-crossword-practice';
const PRACTICE_TTL_MS = 24 * 60 * 60 * 1000;

export interface CrosswordSave { seed: string; state: CrosswordState; elapsedSeconds: number; date?: string; savedAt?: number }

export function loadDailySave(seed: string): CrosswordSave | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CrosswordSave;
    if (parsed.date !== getTodayLocal() || parsed.seed !== seed || !parsed.state) { localStorage.removeItem(DAILY_KEY); return null; }
    return parsed;
  } catch { return null; }
}
export function saveDaily(seed: string, state: CrosswordState, elapsedSeconds: number): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(DAILY_KEY, JSON.stringify({ date: getTodayLocal(), seed, state, elapsedSeconds } satisfies CrosswordSave)); } catch {}
}
export function loadPracticeSave(): CrosswordSave | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PRACTICE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CrosswordSave;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > PRACTICE_TTL_MS || !parsed.state) { localStorage.removeItem(PRACTICE_KEY); return null; }
    return parsed;
  } catch { return null; }
}
export function savePractice(seed: string, state: CrosswordState, elapsedSeconds: number): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(PRACTICE_KEY, JSON.stringify({ seed, state, elapsedSeconds, savedAt: Date.now() } satisfies CrosswordSave)); } catch {}
}
