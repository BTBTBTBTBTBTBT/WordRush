'use client';

// Data behind the home banner's row streaks and Unlimited counts, and the Word
// of the Day quiz answers (founder-approved home redesign, 2026-10-01). The
// rules themselves (what counts as a sweep, how a run is counted) live in the
// shared core so iOS and Android count exactly the same way.

import { dayStreaks, dayRunTotals, isDailySeed } from '@wordle-duel/core';
import { supabase } from './supabase-client';
import { getTodayLocal, toLocalDayString } from './daily-service';
import {
  mergeQuizState, parseQuizHistory, pruneQuizHistory, quizHistKey, recordQuizAnswer,
  type QuizAnswer, type QuizHistory, type QuizRow,
} from './wotd-quiz-history';

const LOOKBACK_DAYS = 400;

function sinceDay(): string {
  const d = new Date();
  d.setDate(d.getDate() - LOOKBACK_DAYS);
  return toLocalDayString(d);
}

/**
 * The Puzzles row's sweep and flawless runs: days in a row the player finished
 * (and won) every one of the More Games dailies. `dbKeys` are the visible
 * More Games daily modes; a day needs all of them.
 */
export async function fetchPuzzleStreaks(userId: string, dbKeys: string[]): Promise<{ sweep: number; flawless: number }> {
  return dayStreaks(await puzzleDays(userId, dbKeys), dbKeys.length, getTodayLocal());
}

/**
 * The All-time "Puzzles Sweeps" card (founder, 2026-10-01 stats audit): lifetime
 * sweep and flawless days for the Puzzles, their best runs, and the current runs.
 */
export async function fetchPuzzleRecords(userId: string, dbKeys: string[]) {
  const days = await puzzleDays(userId, dbKeys);
  return { ...dayRunTotals(days, dbKeys.length), ...dayStreaks(days, dbKeys.length, getTodayLocal()) };
}

/** Each day's distinct Puzzles finished and won, from the player's solo daily_results. */
async function puzzleDays(userId: string, dbKeys: string[]): Promise<Record<string, { played: number; won: number }>> {
  if (!userId || dbKeys.length === 0) return {};
  const { data } = await (supabase as any)
    .from('daily_results')
    .select('day, game_mode, completed')
    .eq('user_id', userId)
    .eq('play_type', 'solo')
    .in('game_mode', dbKeys)
    .gte('day', sinceDay()) as { data: Array<{ day: string; game_mode: string; completed: boolean }> | null };
  const played = new Map<string, Set<string>>();
  const won = new Map<string, Set<string>>();
  for (const r of data ?? []) {
    if (!played.has(r.day)) played.set(r.day, new Set());
    played.get(r.day)!.add(r.game_mode);
    if (r.completed) {
      if (!won.has(r.day)) won.set(r.day, new Set());
      won.get(r.day)!.add(r.game_mode);
    }
  }
  const days: Record<string, { played: number; won: number }> = {};
  for (const [day, set] of played) days[day] = { played: set.size, won: won.get(day)?.size ?? 0 };
  return days;
}

/**
 * Unlimited mode's "N PLAYED TODAY": the player's finished non-daily games
 * since local midnight, per mode. Daily seeds and VS matches don't count.
 */
export async function fetchUnlimitedCountsToday(userId: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!userId) return counts;
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const { data } = await (supabase as any)
    .from('matches')
    .select('game_mode, seed, player2_id')
    .eq('player1_id', userId)
    .gte('created_at', midnight.toISOString())
    .limit(500) as { data: Array<{ game_mode: string; seed: string | null; player2_id: string | null }> | null };
  for (const m of data ?? []) {
    if (m.player2_id || !m.seed || isDailySeed(m.seed)) continue;
    counts.set(m.game_mode, (counts.get(m.game_mode) ?? 0) + 1);
  }
  return counts;
}

export type { QuizAnswer } from './wotd-quiz-history';

const guestKey = (day: string) => `wordocious-wotd-quiz-${day}`;

/** This device's quiz history for the player (pruned to the lookback window). */
function readLocalHistory(userId: string | null): QuizHistory {
  try { return pruneQuizHistory(parseQuizHistory(localStorage.getItem(quizHistKey(userId))), sinceDay()); } catch { return {}; }
}

function writeLocalHistory(userId: string | null, hist: QuizHistory): void {
  try { localStorage.setItem(quizHistKey(userId), JSON.stringify(pruneQuizHistory(hist, sinceDay()))); } catch {}
}

/** The player's server rows, or null when the read failed (an outage: the device history decides). */
async function readServerRows(userId: string): Promise<QuizRow[] | null> {
  try {
    const { data, error } = await (supabase as any)
      .from('word_quiz_answers')
      .select('day, picked, correct')
      .eq('user_id', userId)
      .gte('day', sinceDay())
      .order('day', { ascending: false })
      .limit(LOOKBACK_DAYS) as { data: QuizRow[] | null; error: unknown };
    if (error || !Array.isArray(data)) return null;
    return data;
  } catch {
    return null;
  }
}

async function insertAnswer(userId: string, day: string, word: string, answer: QuizAnswer): Promise<void> {
  const { error } = await (supabase as any)
    .from('word_quiz_answers')
    .insert({ user_id: userId, day, word, picked: answer.picked, correct: answer.correct });
  // 23505 = already answered that day on another device; the first answer stands.
  if (error && error.code !== '23505') throw error;
}

/** Background: answers made during an outage land on the server later (insert only; duplicates ignored). */
function resendLocalOnly(userId: string, local: QuizHistory, days: string[]): void {
  void (async () => {
    for (const day of days) {
      const e = local[day];
      if (!e?.word) continue;
      try { await insertAnswer(userId, day, e.word, e); } catch { return; }
    }
  })();
}

/**
 * Today's saved answer plus the word streak. Guest: this browser (today's key).
 * Signed in: the database merged with this device's history; when the database
 * read fails, the device history alone (so an outage never re-asks the quiz).
 */
export async function fetchQuizState(userId: string | null, day: string): Promise<{ today: QuizAnswer | null; streak: number }> {
  if (!userId) {
    try {
      const raw = localStorage.getItem(guestKey(day));
      const v = raw ? JSON.parse(raw) : null;
      return { today: v && typeof v.picked === 'number' ? { picked: v.picked, correct: !!v.correct } : null, streak: 0 };
    } catch { return { today: null, streak: 0 }; }
  }
  const local = readLocalHistory(userId);
  const rows = await readServerRows(userId);
  const state = mergeQuizState(rows, local, day);
  if (rows && state.localOnly.length > 0) resendLocalOnly(userId, local, state.localOnly);
  return { today: state.today, streak: state.streak };
}

/** Saves the answer once: on this device FIRST, then the server (a second save for the same day is ignored). */
export async function saveQuizAnswer(userId: string | null, day: string, word: string, answer: QuizAnswer): Promise<void> {
  writeLocalHistory(userId, recordQuizAnswer(readLocalHistory(userId), day, word, answer));
  if (!userId) {
    try { localStorage.setItem(guestKey(day), JSON.stringify(answer)); } catch {}
    return;
  }
  await insertAnswer(userId, day, word, answer);
}

/**
 * The All-time Word of the Day record (founder, 2026-10-01 stats audit): the
 * current word streak, the best run, and how many answers were right. Days
 * answered on this device during an outage fill the server's gaps.
 */
export async function fetchQuizRecord(userId: string): Promise<{ streak: number; best: number; right: number; answered: number }> {
  if (!userId) return { streak: 0, best: 0, right: 0, answered: 0 };
  const rows = await readServerRows(userId);
  const { days, streak } = mergeQuizState(rows, readLocalHistory(userId), getTodayLocal());
  const totals = dayRunTotals(days, 1);
  return { streak, best: totals.bestFlawless, right: totals.flawlessDays, answered: totals.sweepDays };
}
