// Server side of async VS challenges, "race my run" (founder, 2026-10-01; spec
// docs/VS_REDESIGN_SPEC.md §4). Only /api/vs/challenges/* imports this: it
// uses the service-role client, so every caller must already be authed.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { VsRun } from '@wordle-duel/core';
import { isProActive } from './pro';

export const VS_MODES = new Set(['DUEL', 'DUEL_6', 'DUEL_7', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'GAUNTLET', 'PROPERNOUNDLE']);
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — easier to type

export function challengeCode(length = 8): string {
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

export interface RunBody {
  solved?: unknown;
  boardsSolved?: unknown;
  totalBoards?: unknown;
  guesses?: unknown;
  timeMs?: unknown;
  guessLog?: unknown;
  solutions?: unknown;
}

const int = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;
const words = (v: unknown, max = 64): string[] =>
  Array.isArray(v) ? v.filter((w): w is string => typeof w === 'string' && w.length <= 40).slice(0, max) : [];

/** A validated run from a request body, or null. */
export function parseRun(b: RunBody | undefined): (VsRun & { totalBoards: number; guessLog: string[]; solutions: string[] }) | null {
  if (!b || typeof b.solved !== 'boolean') return null;
  const boardsSolved = int(b.boardsSolved, 0, 32);
  const totalBoards = int(b.totalBoards ?? 1, 1, 32);
  const guesses = int(b.guesses, 0, 200);
  const timeMs = int(b.timeMs, 0, 60 * 60 * 1000);
  if (boardsSolved === null || totalBoards === null || guesses === null || timeMs === null) return null;
  if (b.solved && guesses <= 0) return null; // a solve with no guesses is impossible (§255)
  return { solved: b.solved, boardsSolved, totalBoards, guesses, timeMs, guessLog: words(b.guessLog), solutions: words(b.solutions) };
}

/** Server-side Pro check through the one Pro rule (lib/pro.ts). */
export async function isPro(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin.from('profiles').select('is_pro, pro_expires_at').eq('id', userId).maybeSingle();
  return isProActive(data as { is_pro?: boolean | null; pro_expires_at?: string | null } | null);
}

/**
 * Fold one VS result into a player's user_stats 'vs' row — the same arithmetic
 * as the client's recordGameResult, so the Stats VS section counts challenge
 * results exactly like live ones. Used for the CHALLENGER's side (the racer's
 * client records its own side, with XP, through the normal path).
 */
export async function addVsStat(
  admin: SupabaseClient,
  userId: string,
  gameMode: string,
  outcome: 'win' | 'loss' | 'draw',
  guessCount: number,
  timeMs: number,
): Promise<void> {
  const won = outcome === 'win';
  const isDraw = outcome === 'draw';
  const timeSeconds = Math.round(timeMs / 1000);
  const { data: existing } = await admin
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('game_mode', gameMode)
    .eq('play_type', 'vs')
    .maybeSingle();
  if (existing) {
    const newTotal = existing.total_games + 1;
    await admin.from('user_stats').update({
      wins: existing.wins + (won ? 1 : 0),
      losses: existing.losses + (won || isDraw ? 0 : 1),
      total_games: newTotal,
      best_score: guessCount > 0 && (existing.best_score === 0 || guessCount < existing.best_score) ? guessCount : existing.best_score,
      average_time: existing.average_time > 0 ? Math.round((existing.average_time * existing.total_games + timeSeconds) / newTotal) : timeSeconds,
      fastest_time: timeSeconds > 0 && (existing.fastest_time === 0 || timeSeconds < existing.fastest_time) ? timeSeconds : existing.fastest_time,
    }).eq('id', existing.id);
  } else {
    await admin.from('user_stats').insert({
      user_id: userId,
      game_mode: gameMode,
      play_type: 'vs',
      wins: won ? 1 : 0,
      losses: won || isDraw ? 0 : 1,
      total_games: 1,
      best_score: guessCount,
      average_time: timeSeconds,
      fastest_time: timeSeconds,
    });
  }
}

/** The public shape every client reads. */
export interface ChallengeView {
  code: string;
  gameMode: string;
  seed: string;
  challenger: { id: string; username: string; avatarUrl: string | null };
  run: VsRun & { totalBoards: number; guessLog: string[]; solutions: string[] };
  createdAt: string;
  expiresAt: string;
  isLink: boolean;
}

export function toView(row: any, prof: { username?: string | null; avatar_url?: string | null } | null | undefined): ChallengeView {
  return {
    code: row.code,
    gameMode: row.game_mode,
    seed: row.seed,
    challenger: { id: row.challenger_id, username: prof?.username || 'Player', avatarUrl: prof?.avatar_url ?? null },
    run: {
      solved: row.solved,
      boardsSolved: row.boards_solved,
      totalBoards: row.total_boards,
      guesses: row.guesses,
      timeMs: row.time_ms,
      guessLog: row.guess_log ?? [],
      solutions: row.solutions ?? [],
    },
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isLink: row.is_link,
  };
}
