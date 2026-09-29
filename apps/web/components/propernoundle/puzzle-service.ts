import { useEffect, useReducer, useRef } from 'react';
import { bankHolidayPick } from '@wordle-duel/core';
import { HOLIDAY_TABLE } from '@/lib/holidays';
import { Puzzle, ThemeCategory } from './types';
import { getTodayLocal } from '@/lib/daily-service';

// The puzzle lists load on demand (founder, 2026-09-29) — they used to ride in
// the JS of every route that touched ProperNoundle. `loadProperNoundleBank`
// fetches them once as their own content-hashed chunks; every picker below
// must run after it resolves (the game, the completed card and VS wait on it).

// ISO date-only strings parse as UTC midnight, so epoch and target both sit
// on UTC midnight and their difference is a clean multiple of 86400000 ms.
// The resulting integer is a stable "day index" regardless of viewer TZ.
const EPOCH_DATE_STRING = '2024-01-01';

// Cap answer length so tiles fit on mobile screens (~375px).
// 15 letters keeps 91% of the library while guaranteeing every
// puzzle is playable without horizontal overflow.
const MAX_ANSWER_LENGTH = 15;

// Holiday dailies (More Games §20): on a date the shared calendar names, the
// daily is drawn from this per-holiday list — the k-th recurrence of the
// holiday takes entry k (wrapping) — and the ordinary rotation pick is simply
// skipped that day (never dated, so the rotation below does not shift).
let HOLIDAY_PUZZLES: Record<string, Puzzle[]> = {};
let allPuzzles: Puzzle[] = [];
// Group puzzles by category so the daily picker can rotate one category
// per day instead of walking the JSON in order. The source JSON ships
// puzzles clustered by category (50 sports in a row, 90 currentevents
// in a row, etc.), so the previous `dayNumber % allPuzzles.length`
// scheme produced *weeks* of consecutive same-category dailies — user
// reported "every day has been a sports category." Grouping here lets
// us round-robin across categories deterministically.
let PUZZLES_BY_CATEGORY = new Map<string, Puzzle[]>();
// Alphabetical category order so the rotation is stable forever — using
// JSON insertion order would re-shuffle the daily schedule any time
// a new puzzle re-orders the source file.
let CATEGORY_CYCLE: string[] = [];

function install(puzzles: Puzzle[], holidayFile: { version: number; holiday?: Record<string, Puzzle[]> }) {
  HOLIDAY_PUZZLES = holidayFile.holiday ?? {};
  allPuzzles = puzzles.filter(p => p.answer.length <= MAX_ANSWER_LENGTH);
  const groups = new Map<string, Puzzle[]>();
  for (const p of allPuzzles) {
    const cat = p.themeCategory || 'general';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(p);
  }
  PUZZLES_BY_CATEGORY = groups;
  CATEGORY_CYCLE = Array.from(groups.keys()).sort();
}

let loading: Promise<void> | null = null;
export const properNoundleBankLoaded = () => allPuzzles.length > 0;
/** Loads (once) the puzzle and holiday lists; every picker needs this first. */
export function loadProperNoundleBank(): Promise<void> {
  if (properNoundleBankLoaded()) return Promise.resolve();
  loading ??= Promise.all([import('@/data/propernoundle-puzzles.json'), import('@/data/propernoundle-holidays.json')])
    .then(([p, h]) => install(p.default as Puzzle[], h.default as { version: number; holiday?: Record<string, Puzzle[]> }))
    .catch((e) => { loading = null; throw e; });
  return loading;
}
/** True once the lists are in (always true when `enabled` is false). Retries a failed load once. */
export function useProperNoundleBank(enabled = true): boolean {
  // Live check (see useDictionary): a state flag still said "ready" from the
  // disabled render when `enabled` flipped on in a mounted caller (a mode switch
  // to ProperNoundle), until its effect ran. `bump` re-renders once the load lands.
  const ready = !enabled || properNoundleBankLoaded();
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!enabled || properNoundleBankLoaded()) { if (!readyRef.current) bump(); return; }
    let live = true;
    loadProperNoundleBank().catch(() => loadProperNoundleBank()).then(() => { if (live) bump(); }).catch(() => {});
    return () => { live = false; };
  }, [enabled]);
  return ready;
}
function need() {
  if (!properNoundleBankLoaded()) throw new Error('ProperNoundle bank not loaded — await loadProperNoundleBank() first');
}

function getDaysSinceEpoch(dateString: string): number {
  const target = new Date(dateString).getTime();
  const epoch = new Date(EPOCH_DATE_STRING).getTime();
  return Math.floor((target - epoch) / 86400000);
}

/**
 * The holiday key whose puzzle is served on `dateString` (today by default),
 * or null when the day is ordinary or the holidays file has nothing for that
 * holiday — so the header only names a holiday when the puzzle really is one.
 */
export function dailyHolidayKey(dateString?: string): string | null {
  need();
  return bankHolidayPick(dateString || getTodayLocal(), HOLIDAY_TABLE, HOLIDAY_PUZZLES)?.key ?? null;
}

export function getDailyPuzzle(dateString?: string): Puzzle {
  need();
  const date = dateString || getTodayLocal();
  const holiday = bankHolidayPick(date, HOLIDAY_TABLE, HOLIDAY_PUZZLES);
  if (holiday) return holiday.entry;
  const dayNumber = getDaysSinceEpoch(date);
  // Day N's category is the Nth in the alphabetical cycle, so seven-
  // category configs guarantee no two consecutive days repeat. Within
  // each category we advance one index every full cycle (every 7 days
  // for the current 7-category set) so each category burns through
  // its own list before any puzzle repeats.
  const cat = CATEGORY_CYCLE[dayNumber % CATEGORY_CYCLE.length];
  const list = PUZZLES_BY_CATEGORY.get(cat)!;
  const indexInCat = Math.floor(dayNumber / CATEGORY_CYCLE.length) % list.length;
  return list[indexInCat];
}

export function getDailyPuzzleNumber(dateString?: string): number {
  return getDaysSinceEpoch(dateString || getTodayLocal()) + 1;
}

/**
 * Deterministic puzzle from a VS seed — the SAME ×31 djb2 hash the server's
 * selectProperNoundlePuzzle uses (shared with core simpleHash), indexed into
 * the same length-filtered list iOS/Android use, so a local bot match plays
 * the identical proper noun on every platform.
 */
export function getPuzzleForSeed(seed: string): Puzzle | null {
  if (allPuzzles.length === 0) return null;   // callers load the bank first (VS gates on it)
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return allPuzzles[Math.abs(hash) % allPuzzles.length];
}

export function getRandomPuzzle(excludeIds: string[] = []): Puzzle {
  need();
  const available = allPuzzles.filter(p => !excludeIds.includes(p.id));
  const randomIndex = Math.floor(Math.random() * available.length);
  return available[randomIndex];
}

export function getPuzzleById(id: string): Puzzle | null {
  need();
  return allPuzzles.find(p => p.id === id) ?? null;
}

export function getPuzzlesByCategory(themeCategory: ThemeCategory): Puzzle[] {
  return allPuzzles.filter(p => p.themeCategory === themeCategory);
}

export function getAllCategories(): ThemeCategory[] {
  const cats = new Set<ThemeCategory>();
  allPuzzles.forEach(p => {
    if (p.themeCategory) cats.add(p.themeCategory);
  });
  return Array.from(cats);
}
