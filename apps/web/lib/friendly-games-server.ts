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
import { NO_AVATAR_FIELDS, selectWithAvatarColumns, withOwnAvatarFields, type AvatarFields } from './avatar-fields-server';
import allowed6 from '@/data/allowed-6.json';
import allowed7 from '@/data/allowed-7.json';

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

// Ghost / Word Chain play on the 5-, 6- and 7-letter lists. One sorted array
// answers "is this a word" (binary search) and "does any word start with these
// letters" (the first entry ≥ the fragment).
let wordArr: string[] | null = null;
function words(): string[] {
  if (!wordArr) {
    wordArr = [...new Set([...(allowed as string[]), ...(allowed6 as string[]), ...(allowed7 as string[])].map((w) => w.toUpperCase()))].sort();
  }
  return wordArr;
}
function lowerBound(arr: string[], key: string): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < key) lo = mid + 1; else hi = mid; }
  return lo;
}
/** A 5–7 letter word on the lists. */
export function isListWord(w: string): boolean {
  const arr = words();
  const i = lowerBound(arr, w.toUpperCase());
  return arr[i] === w.toUpperCase();
}
/** Some 5–7 letter word starts with these letters. */
export function hasWordPrefix(fragment: string): boolean {
  const arr = words();
  const f = fragment.toUpperCase();
  const i = lowerBound(arr, f);
  return i < arr.length && arr[i].startsWith(f);
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

export interface Prof extends Partial<AvatarFields> { id: string; username: string; avatar_url: string | null; avatar_emoji?: string | null }

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
    // FINISH_SPEC AH/AN3 (additive): the opponent's avatar choice + active Pro.
    opponent: {
      id: otherId, username: them, avatarUrl: opp?.avatar_url ?? null, avatarEmoji: opp?.avatar_emoji ?? null,
      avatar_cast_id: opp?.avatar_cast_id ?? NO_AVATAR_FIELDS.avatar_cast_id,
      avatar_frame: opp?.avatar_frame ?? NO_AVATAR_FIELDS.avatar_frame,
      avatar_config: opp?.avatar_config ?? NO_AVATAR_FIELDS.avatar_config,
      is_pro: opp?.is_pro ?? NO_AVATAR_FIELDS.is_pro,
    },
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
  // + is_pro / avatar columns (tolerant: retried without the avatar columns while they don't exist).
  const { data } = await selectWithAvatarColumns((extra) =>
    admin.from('profiles').select(`id, username, avatar_url, avatar_emoji${extra}`).in('id', [...new Set(ids)]));
  return new Map(((data ?? []) as Prof[]).map((p) => [p.id, withOwnAvatarFields(p)]));
}

/** The match winner's user id, or null for a draw / still going. */
export function winnerId(row: Pick<GameRow, 'player_a' | 'player_b'>, state: FriendlyState): string | null {
  const w = friendlyWinner(state);
  return w === 'a' ? row.player_a : w === 'b' ? row.player_b : null;
}

/**
 * FINISH_SPEC BE + BF1: the pocket-game achievements for one player, from all
 * of their friendly_games rows (rules in core pocketAchievements). Granted with
 * the service-role client; returns the ones THIS call inserted.
 */
export async function grantPocketAchievements(admin: any, userId: string): Promise<import('./achievement-service').NewAchievement[]> {
  try {
    const { pocketAchievements } = await import('@wordle-duel/core');
    const { grantAchievements } = await import('./achievements-server');
    const { data } = await admin
      .from('friendly_games')
      .select('kind, status, winner, state')
      .or(`player_a.eq.${userId},player_b.eq.${userId}`)
      .limit(2000);
    const games = ((data ?? []) as Array<Pick<GameRow, 'kind' | 'status' | 'winner' | 'state'>>).map((g) => ({
      kind: g.kind,
      finished: g.status === 'done' || g.status === 'resigned',
      won: g.winner === userId,
      chainWords: g.kind === 'chain' ? ((g.state as { words?: unknown[] })?.words?.length ?? 0) : undefined,
    }));
    return await grantAchievements(admin, userId, pocketAchievements(games));
  } catch {
    return [];
  }
}
