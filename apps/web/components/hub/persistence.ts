// Hubbub save/restore (More Games §12). Same shape as the other More Games
// saves: a day-keyed daily save (fail-closed on date OR seed mismatch) and a
// 24 h practice save. The reducer state is stored whole (event log included)
// so the keep-going session and the improve path survive a reload.

import type { HubState } from '@wordle-duel/core';
import { getTodayLocal } from '@/lib/daily-service';

const DAILY_KEY = 'wordocious-hub-daily';
const PRACTICE_KEY = 'wordocious-hub-practice';
const PRACTICE_TTL_MS = 24 * 60 * 60 * 1000;

export interface HubSave {
  seed: string;
  state: HubState;
  elapsedSeconds: number;
  /** The rank index already sent through recordGameResult / improveDailyRun. */
  recordedRank: number;
  date?: string;
  savedAt?: number;
}

export function loadDailySave(seed: string): HubSave | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HubSave;
    if (parsed.date !== getTodayLocal() || parsed.seed !== seed || !parsed.state) { localStorage.removeItem(DAILY_KEY); return null; }
    return parsed;
  } catch { return null; }
}

export function saveDaily(seed: string, state: HubState, elapsedSeconds: number, recordedRank: number): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(DAILY_KEY, JSON.stringify({ date: getTodayLocal(), seed, state, elapsedSeconds, recordedRank } satisfies HubSave)); } catch {}
}

export function loadPracticeSave(): HubSave | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PRACTICE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HubSave;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > PRACTICE_TTL_MS || !parsed.state) { localStorage.removeItem(PRACTICE_KEY); return null; }
    return parsed;
  } catch { return null; }
}

export function savePractice(seed: string, state: HubState, elapsedSeconds: number, recordedRank: number): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(PRACTICE_KEY, JSON.stringify({ seed, state, elapsedSeconds, recordedRank, savedAt: Date.now() } satisfies HubSave)); } catch {}
}
