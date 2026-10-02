// Server side of the Friends pocket games (founder, 2026-10-01; spec
// docs/FRIENDS_REDESIGN_SPEC.md §4). Only /api/friends/games/* imports this:
// it uses the service-role client, so every caller must already be authed.
// The rules themselves live in packages/core friendly-games.ts.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  FRIENDLY_TITLES, containsBlockedTerm, friendlyCardLine, friendlyStateFor, friendlyWinner,
  generateMatchSeed, generateSolutionsFromSeed, initDictionary, isValidWord, whoseTurn,
  type FriendlyKind, type FriendlyState, type Side,
} from '@wordle-duel/core';
import allowed from '@/data/allowed.json';
import solutions from '@/data/solutions.json';
import legacy from '@/data/solutions-legacy.json';

let dictReady = false;
/** The 5-letter lists, loaded once per server instance (Pass the Puzzle). */
export function ensureDictionary(): void {
  if (dictReady) return;
  initDictionary(allowed as string[], solutions as string[], legacy as string[]);
  dictReady = true;
}

/** A fresh Pass the Puzzle answer from the curated pool. */
export function passAnswer(): string {
  ensureDictionary();
  return generateSolutionsFromSeed(generateMatchSeed(), 1)[0].toUpperCase();
}

/** Guesses must be real words and never a blocked term (the friend sees them). */
export function passWordOk(w: string): boolean {
  ensureDictionary();
  return isValidWord(w.toLowerCase()) && !containsBlockedTerm(w);
}

export interface GameRow {
  id: string;
  kind: FriendlyKind;
  player_a: string;
  player_b: string;
  state: FriendlyState;
  secret: string | null;
  status: 'active' | 'done' | 'resigned' | 'expired';
  winner: string | null;
  a_seen_at: string | null;
  b_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Prof { id: string; username: string; avatar_url: string | null; avatar_emoji?: string | null }

/** A game is dropped after 3 days with no move. */
export const GAME_IDLE_MS = 3 * 24 * 60 * 60 * 1000;

export function sideOf(row: GameRow, userId: string): Side | null {
  return row.player_a === userId ? 'a' : row.player_b === userId ? 'b' : null;
}

/** What one player sees: the opponent's open pick hidden, the answer only once it is over. */
export function gameView(row: GameRow, me: string, opp: Prof | undefined) {
  const side = sideOf(row, me) as Side;
  const otherId = side === 'a' ? row.player_b : row.player_a;
  const over = row.status !== 'active';
  const turn = over ? null : whoseTurn(row.state);
  const minutesAgo = Math.max(0, Math.floor((Date.now() - new Date(row.updated_at).getTime()) / 60000));
  const them = opp?.username ?? 'Friend';
  let line = friendlyCardLine({ kind: row.kind, state: row.state, me: side, them, minutesAgo });
  if (row.status === 'resigned') line = row.winner === me ? `${them} resigned` : 'You resigned';
  if (row.status === 'expired') line = 'Expired after 3 quiet days';
  return {
    id: row.id,
    kind: row.kind,
    title: FRIENDLY_TITLES[row.kind],
    me: side,
    opponent: { id: otherId, username: them, avatarUrl: opp?.avatar_url ?? null, avatarEmoji: opp?.avatar_emoji ?? null },
    state: friendlyStateFor(row.state, side),
    status: row.status,
    yourTurn: !over && (turn === 'both' || turn === side),
    result: !over ? null : row.winner === me ? 'win' : row.winner ? 'loss' : 'draw',
    line,
    answer: over && row.kind === 'pass' ? row.secret : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Lazily expire one player's idle games (no cron needed). */
export async function expireIdle(admin: SupabaseClient, userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - GAME_IDLE_MS).toISOString();
  await admin
    .from('friendly_games')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('status', 'active')
    .lt('updated_at', cutoff)
    .or(`player_a.eq.${userId},player_b.eq.${userId}`);
}

export async function profilesById(admin: SupabaseClient, ids: string[]): Promise<Map<string, Prof>> {
  if (ids.length === 0) return new Map();
  const { data } = await admin.from('profiles').select('id, username, avatar_url, avatar_emoji').in('id', [...new Set(ids)]);
  return new Map((data ?? []).map((p: Prof) => [p.id, p]));
}

/** The match winner's user id, or null for a draw / still going. */
export function winnerId(row: Pick<GameRow, 'player_a' | 'player_b'>, state: FriendlyState): string | null {
  const w = friendlyWinner(state);
  return w === 'a' ? row.player_a : w === 'b' ? row.player_b : null;
}
