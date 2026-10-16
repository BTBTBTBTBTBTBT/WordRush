// ============================================================
// Home headline pool (docs/review/home-headlines/PROPOSAL.md), web wiring. The words come from core's
// selectHomeHeadline; this file holds the flag key, the two tiny local stores (the last-10-days "shown" history and
// the last finished game) and the 60 s time-bucket tick. Gated by `home_headlines_v2` (testers/admins until the
// founder approves; a missing row keeps today's bannerHeadline line byte-for-byte). Pure except where a function
// says so (localStorage behind try/catch), so the wiring is unit-tested.
// ============================================================

import { HISTORY_DAYS, LAST_GAME_FRESH_MINUTES, type LastGame } from '@wordle-duel/core';

/** The feature switch (admin > Ops > Feature flags). Testers/admins only until the founder approves. */
export const HOME_HEADLINES_FLAG = 'home_headlines_v2';

export const HISTORY_KEY = 'home_headlines_v2.history';
export const LAST_GAME_KEY = 'home_headlines_v2.lastGame';

/** One shown line: its template id and the local day it was shown. */
export interface ShownLine { id: string; day: string }

/** The last finished daily, as written on finish (local only; no Supabase). */
export interface LastGameRecord { title: string; won: boolean; at: number; record: boolean }

const DAY_MS = 86_400_000;

/** Days between two `YYYY-MM-DD` keys (calendar math, no time zones). */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS);
}

/** The history kept for `today`: entries shown within HISTORY_DAYS (older ones drop). */
export function pruneHistory(list: readonly ShownLine[], today: string): ShownLine[] {
  return list.filter((e) => typeof e?.id === 'string' && typeof e?.day === 'string' && daysBetween(e.day, today) < HISTORY_DAYS && daysBetween(e.day, today) >= 0);
}

/** Append a shown id once per day (re-showing the same line that day is not a new entry). */
export function pushShown(list: readonly ShownLine[], id: string, today: string): ShownLine[] {
  const kept = pruneHistory(list, today);
  if (kept.some((e) => e.id === id && e.day === today)) return kept;
  return [...kept, { id, day: today }];
}

/** The ids core's history wants, from the stored entries. */
export const historyIds = (list: readonly ShownLine[]): string[] => list.map((e) => e.id);

export function readHistory(today: string): ShownLine[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? pruneHistory(parsed as ShownLine[], today) : [];
  } catch {
    return [];
  }
}

export function writeHistory(list: readonly ShownLine[]): void {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch { /* private mode / quota: the pool still works, just without memory */ }
}

/** Written on a daily finish ('daily-completion' event); read by the banner. */
export function writeLastGame(rec: LastGameRecord): void {
  try { localStorage.setItem(LAST_GAME_KEY, JSON.stringify(rec)); } catch { /* ignore */ }
}

export function readLastGame(): LastGameRecord | null {
  try {
    const raw = localStorage.getItem(LAST_GAME_KEY);
    const r = raw ? (JSON.parse(raw) as Partial<LastGameRecord>) : null;
    return r && typeof r.title === 'string' && typeof r.at === 'number' ? { title: r.title, won: !!r.won, at: r.at, record: !!r.record } : null;
  } catch {
    return null;
  }
}

/** Core's LastGame from the stored record: null once the reaction window has passed (nothing to recompute for). */
export function lastGameFor(rec: LastGameRecord | null, nowMs: number): LastGame | null {
  if (!rec) return null;
  const minutesAgo = Math.floor((nowMs - rec.at) / 60_000);
  if (minutesAgo < 0 || minutesAgo > LAST_GAME_FRESH_MINUTES) return null;
  return { title: rec.title, won: rec.won, minutesAgo, record: rec.record };
}
