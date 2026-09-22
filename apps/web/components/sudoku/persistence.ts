// Sudoku save/restore (More Games §4). Mirrors the ProperNoundle pattern: a
// day-keyed daily save (fail-closed on date OR seed mismatch) and a 24 h
// practice save so navigating away and back resumes the same puzzle. The
// reducer state is stored whole (history included) so Undo survives a reload;
// elapsed seconds are stored alongside for the active-play timer.

import type { SudokuState } from '@wordle-duel/core';
import { getTodayLocal } from '@/lib/daily-service';

const DAILY_KEY = 'wordocious-sudoku-daily';
const PRACTICE_KEY = 'wordocious-sudoku-practice';
const PRACTICE_TTL_MS = 24 * 60 * 60 * 1000;

export interface SudokuSave {
  seed: string;
  state: SudokuState;
  elapsedSeconds: number;
  /** Daily saves only. */
  date?: string;
  /** Practice saves only. */
  savedAt?: number;
}

export function loadDailySave(seed: string): SudokuSave | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SudokuSave;
    if (parsed.date !== getTodayLocal() || parsed.seed !== seed || !parsed.state) {
      localStorage.removeItem(DAILY_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

export function saveDaily(seed: string, state: SudokuState, elapsedSeconds: number): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(DAILY_KEY, JSON.stringify({ date: getTodayLocal(), seed, state, elapsedSeconds } satisfies SudokuSave)); } catch {}
}

export function loadPracticeSave(): SudokuSave | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PRACTICE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SudokuSave;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > PRACTICE_TTL_MS || !parsed.state) {
      localStorage.removeItem(PRACTICE_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

export function savePractice(seed: string, state: SudokuState, elapsedSeconds: number): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(PRACTICE_KEY, JSON.stringify({ seed, state, elapsedSeconds, savedAt: Date.now() } satisfies SudokuSave)); } catch {}
}

export function clearPracticeSave(): void {
  try { localStorage.removeItem(PRACTICE_KEY); } catch {}
}
