'use client';

// Data behind the home banner's row streaks and Unlimited counts, and the Word
// of the Day quiz answers (founder-approved home redesign, 2026-10-01). The
// rules themselves (what counts as a sweep, how a run is counted) live in the
// shared core so iOS and Android count exactly the same way.

import { dayStreaks, isDailySeed } from '@wordle-duel/core';
import { supabase } from './supabase-client';
import { getTodayLocal, toLocalDayString } from './daily-service';

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
  if (!userId || dbKeys.length === 0) return { sweep: 0, flawless: 0 };
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
  return dayStreaks(days, dbKeys.length, getTodayLocal());
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

export interface QuizAnswer {
  picked: number;
  correct: boolean;
}

const guestKey = (day: string) => `wordocious-wotd-quiz-${day}`;

/** Today's saved answer (signed in: the database; guest: this browser), plus the word streak. */
export async function fetchQuizState(userId: string | null, day: string): Promise<{ today: QuizAnswer | null; streak: number }> {
  if (!userId) {
    try {
      const raw = localStorage.getItem(guestKey(day));
      const v = raw ? JSON.parse(raw) : null;
      return { today: v && typeof v.picked === 'number' ? { picked: v.picked, correct: !!v.correct } : null, streak: 0 };
    } catch { return { today: null, streak: 0 }; }
  }
  const { data } = await (supabase as any)
    .from('word_quiz_answers')
    .select('day, picked, correct')
    .eq('user_id', userId)
    .gte('day', sinceDay())
    .order('day', { ascending: false })
    .limit(LOOKBACK_DAYS) as { data: Array<{ day: string; picked: number; correct: boolean }> | null };
  const days: Record<string, { played: number; won: number }> = {};
  let today: QuizAnswer | null = null;
  for (const r of data ?? []) {
    days[r.day] = { played: 1, won: r.correct ? 1 : 0 };
    if (r.day === day) today = { picked: r.picked, correct: r.correct };
  }
  return { today, streak: dayStreaks(days, 1, day).flawless };
}

/** Saves the answer once; a second save for the same day is ignored by the primary key. */
export async function saveQuizAnswer(userId: string | null, day: string, word: string, answer: QuizAnswer): Promise<void> {
  if (!userId) {
    try { localStorage.setItem(guestKey(day), JSON.stringify(answer)); } catch {}
    return;
  }
  const { error } = await (supabase as any)
    .from('word_quiz_answers')
    .insert({ user_id: userId, day, word, picked: answer.picked, correct: answer.correct });
  // 23505 = already answered today on another device; the first answer stands.
  if (error && error.code !== '23505') throw error;
}
