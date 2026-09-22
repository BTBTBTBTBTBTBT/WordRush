// Starsweep save/restore (More Games §18b). Same shape as the Sudoku saves: a
// day-keyed daily save (fail-closed on date OR seed mismatch) and a 24 h
// practice save so navigating away and back resumes the same board. The
// reducer state is stored whole (history included) so Undo survives a reload.

import type { RegionsState } from '@wordle-duel/core';
import { getTodayLocal } from '@/lib/daily-service';

const DAILY_KEY = 'wordocious-regions-daily';
const PRACTICE_KEY = 'wordocious-regions-practice';
const PRACTICE_TTL_MS = 24 * 60 * 60 * 1000;

export interface RegionsSave {
  seed: string;
  state: RegionsState;
  elapsedSeconds: number;
  date?: string;
  savedAt?: number;
}

export function loadDailySave(seed: string): RegionsSave | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RegionsSave;
    if (parsed.date !== getTodayLocal() || parsed.seed !== seed || !parsed.state) {
      localStorage.removeItem(DAILY_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

export function saveDaily(seed: string, state: RegionsState, elapsedSeconds: number): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(DAILY_KEY, JSON.stringify({ date: getTodayLocal(), seed, state, elapsedSeconds } satisfies RegionsSave)); } catch {}
}

export function loadPracticeSave(): RegionsSave | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PRACTICE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RegionsSave;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > PRACTICE_TTL_MS || !parsed.state) {
      localStorage.removeItem(PRACTICE_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

export function savePractice(seed: string, state: RegionsState, elapsedSeconds: number): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(PRACTICE_KEY, JSON.stringify({ seed, state, elapsedSeconds, savedAt: Date.now() } satisfies RegionsSave)); } catch {}
}
