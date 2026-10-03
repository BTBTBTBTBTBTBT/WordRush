// Word of the Day quiz answers that survive a database outage (FINISH_SPEC BI17
// §3, 3-platform parity). Every answer is ALSO kept on the device, per user id
// (or "guest") per day, so a failed read never re-asks today's quiz or zeroes
// the word streak. Pure: the storage and network live in lib/home-streaks.ts.

import { dayStreaks } from '@wordle-duel/core';

export interface QuizAnswer {
  picked: number;
  correct: boolean;
}

/** One day's answer on the device (the word rides along so it can be re-sent). */
export interface QuizHistEntry extends QuizAnswer {
  word: string;
}

/** Day key ("YYYY-MM-DD") → that day's answer. */
export type QuizHistory = Record<string, QuizHistEntry>;

/** A word_quiz_answers row as read back from the server. */
export interface QuizRow {
  day: string;
  picked: number;
  correct: boolean;
  word?: string | null;
}

/** The device key for a player's quiz history ("guest" when signed out). */
export function quizHistKey(userId: string | null): string {
  return `wordocious-wotd-quiz-hist-${userId ?? 'guest'}`;
}

/** Parses a stored history, dropping anything malformed. */
export function parseQuizHistory(raw: string | null): QuizHistory {
  if (!raw) return {};
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return {}; }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: QuizHistory = {};
  for (const [day, e] of Object.entries(v as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !e || typeof e !== 'object') continue;
    const { picked, correct, word } = e as Record<string, unknown>;
    if (typeof picked !== 'number') continue;
    out[day] = { picked, correct: !!correct, word: typeof word === 'string' ? word : '' };
  }
  return out;
}

/** Keeps only the days on or after `sinceDay` (the lookback window). */
export function pruneQuizHistory(hist: QuizHistory, sinceDay: string): QuizHistory {
  const out: QuizHistory = {};
  for (const [day, e] of Object.entries(hist)) if (day >= sinceDay) out[day] = e;
  return out;
}

/** Records one day's answer; the first answer of a day stands (as on the server). */
export function recordQuizAnswer(hist: QuizHistory, day: string, word: string, answer: QuizAnswer): QuizHistory {
  if (hist[day]) return hist;
  return { ...hist, [day]: { picked: answer.picked, correct: answer.correct, word } };
}

export interface MergedQuizState {
  /** Today's answer, if any. */
  today: QuizAnswer | null;
  /** The word streak through `today`. */
  streak: number;
  /** Every answered day (played 1, won 1 when right), for the run math. */
  days: Record<string, { played: number; won: number }>;
  /** Device-only days the server is missing (re-send these). Empty when the server read failed. */
  localOnly: string[];
}

/**
 * Merges the server rows with the device history. `serverRows === null` means
 * the server read failed: the device history alone decides. Otherwise server
 * rows win per day and device-only days fill the gaps.
 */
export function mergeQuizState(serverRows: QuizRow[] | null, local: QuizHistory, today: string): MergedQuizState {
  const merged: Record<string, QuizAnswer> = {};
  const localOnly: string[] = [];
  if (serverRows) {
    for (const r of serverRows) merged[r.day] = { picked: r.picked, correct: !!r.correct };
    for (const [day, e] of Object.entries(local)) {
      if (merged[day]) continue;
      merged[day] = { picked: e.picked, correct: e.correct };
      localOnly.push(day);
    }
  } else {
    for (const [day, e] of Object.entries(local)) merged[day] = { picked: e.picked, correct: e.correct };
  }
  const days: Record<string, { played: number; won: number }> = {};
  for (const [day, a] of Object.entries(merged)) days[day] = { played: 1, won: a.correct ? 1 : 0 };
  localOnly.sort();
  return { today: merged[today] ?? null, streak: dayStreaks(days, 1, today).flawless, days, localOnly };
}
