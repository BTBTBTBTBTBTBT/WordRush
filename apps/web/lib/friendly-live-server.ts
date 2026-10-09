import type { SupabaseClient } from '@supabase/supabase-js';
import { LIVE_EVENT_MOVE, liveTopic, isFeatureLive } from '@wordle-duel/core';
import type { GameRow } from './friendly-games-server';

/**
 * Live pocket games, server half (FRIDAY-QUEUE 9b; shared rules in core friendly-live.ts).
 * After a game is saved (a move, a resign) the route calls publishGameChange():
 *   1. bumps friendly_game_pings (the postgres_changes BACKUP; a revision only, no game data),
 *   2. broadcasts the receiver's view on Realtime channel fg:<id> through the REST broadcast API
 *      (no socket to keep open in a serverless route).
 * Everything here is best-effort and bounded: a Realtime outage must never fail or slow a move.
 * Gated by the `live_play` row in app_flags (fail open, cached 30 s); off = nothing is published
 * and clients fall back to the 2 s poll.
 */

const SWITCH_TTL_MS = 30_000;
let switchCache: { at: number; on: boolean } | null = null;

export async function liveSwitchOn(admin: SupabaseClient): Promise<boolean> {
  if (switchCache && Date.now() - switchCache.at < SWITCH_TTL_MS) return switchCache.on;
  let on = true;
  try {
    const { data } = await admin.from('app_flags').select('key, enabled, audience').eq('key', 'live_play').maybeSingle();
    // Testers-only audiences still publish (the clients decide who listens).
    if (data) on = isFeatureLive('live_play', { live_play: { enabled: !!data.enabled, audience: 'all' } }, true);
  } catch {
    on = true;
  }
  switchCache = { at: Date.now(), on };
  return on;
}

/** Test seam. */
export function __resetLiveSwitchCacheForTests(): void { switchCache = null; }

const BROADCAST_TIMEOUT_MS = 1500;

/** POST {url}/realtime/v1/api/broadcast — the topic is the bare channel name (no "realtime:" prefix). */
export async function restBroadcast(topic: string, event: string, payload: Record<string, unknown>): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ messages: [{ topic, event, payload, private: false }] }),
      signal: AbortSignal.timeout(BROADCAST_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * @param row       the game as just saved
 * @param by        who made the change
 * @param receiverView  the receiver's view (gameView(row, receiverId, ...)): the hidden RPS pick is already stripped
 */
export async function publishGameChange(
  admin: SupabaseClient,
  row: Pick<GameRow, 'id' | 'player_a' | 'player_b' | 'status' | 'updated_at'>,
  by: string,
  receiverView: unknown,
): Promise<void> {
  try {
    if (!(await liveSwitchOn(admin))) return;
    await Promise.all([
      restBroadcast(liveTopic(row.id), LIVE_EVENT_MOVE, { by, updatedAt: row.updated_at, game: receiverView }),
      Promise.resolve(admin.rpc('bump_friendly_game_ping', {
        p_game: row.id, p_a: row.player_a, p_b: row.player_b, p_status: row.status, p_by: by,
      })).catch(() => {}),
    ]);
  } catch {
    // best effort
  }
}
