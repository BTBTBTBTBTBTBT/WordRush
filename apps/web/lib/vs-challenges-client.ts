// Client side of async VS challenges, "race my run" (VS overhaul, spec
// docs/VS_REDESIGN_SPEC.md §3–§5, §11). Every call is bearer-authed like
// /api/friends/* (profileApiHeaders). The lobby's record and rivals reads
// live here too, so the VS screens share one data layer.

import type { VsRun } from '@wordle-duel/core';
import { supabase } from './supabase-client';
import { profileApiHeaders } from './profile-social';
import { aggregateRivals, type RivalRow, type SentChallenge } from './vs-lobby';

export interface ChallengeRun extends VsRun {
  totalBoards: number;
  guessLog: string[];
  solutions: string[];
}

export interface ChallengeView {
  code: string;
  gameMode: string;
  seed: string;
  challenger: { id: string; username: string; avatarUrl: string | null };
  run: ChallengeRun;
  createdAt: string;
  expiresAt: string;
  isLink: boolean;
}

export interface ChallengeEntry {
  outcome: 'win' | 'loss' | 'draw';
  solved: boolean;
  boardsSolved: number;
  guesses: number;
  timeMs: number;
  guessLog: string[];
}

async function headers(json = false): Promise<Record<string, string>> {
  const h = await profileApiHeaders();
  return json ? { ...h, 'Content-Type': 'application/json' } : h;
}

/** Open challenges waiting for me, and my recent sent ones. Empty lists on failure. */
export async function fetchVsChallenges(): Promise<{ incoming: ChallengeView[]; sent: SentChallenge[] }> {
  try {
    const res = await fetch('/api/vs/challenges', { headers: await headers(), cache: 'no-store' });
    if (!res.ok) return { incoming: [], sent: [] };
    const json = await res.json();
    return { incoming: json.incoming ?? [], sent: json.sent ?? [] };
  } catch {
    return { incoming: [], sent: [] };
  }
}

export type ChallengeLookup =
  | { ok: true; challenge: ChallengeView; isMine: boolean; expired: boolean; entry: ChallengeEntry | null }
  | { ok: false; status: number; error: string };

export async function fetchChallenge(code: string): Promise<ChallengeLookup> {
  try {
    const res = await fetch(`/api/vs/challenges/${encodeURIComponent(code.trim().toUpperCase())}`, { headers: await headers(), cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, error: json.error ?? 'Challenge not found' };
    return { ok: true, challenge: json.challenge, isMine: !!json.isMine, expired: !!json.expired, entry: json.entry ?? null };
  } catch {
    return { ok: false, status: 0, error: 'Network error' };
  }
}

/** Send a played run to friends and/or as a link. Returns the code, or an error (403 = not Pro). */
export async function sendChallenge(body: { gameMode: string; seed: string; run: ChallengeRun; friendIds: string[]; link: boolean }): Promise<{ code: string; invitees: number } | { error: string }> {
  try {
    const res = await fetch('/api/vs/challenges', { method: 'POST', headers: await headers(true), body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: json.error ?? 'Could not send the challenge' };
    return { code: json.code, invitees: json.invitees ?? 0 };
  } catch {
    return { error: 'Network error' };
  }
}

export interface RaceResultResponse {
  outcome: 'win' | 'loss' | 'draw';
  margin: string;
  challengerRun: ChallengeRun;
  alreadyRecorded: boolean;
}

/** Post the racer's run. The server scores it, writes the shared matches row and the challenger's side. */
export async function postRaceResult(code: string, run: ChallengeRun, quit = false): Promise<RaceResultResponse | { error: string; status: number }> {
  try {
    const res = await fetch(`/api/vs/challenges/${encodeURIComponent(code)}/result`, { method: 'POST', headers: await headers(true), body: JSON.stringify(quit ? { run, quit: true } : { run }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: json.error ?? 'Could not record the race', status: res.status };
    return json as RaceResultResponse;
  } catch {
    return { error: 'Network error', status: 0 };
  }
}

/**
 * KEEP WAITING in the live queue (Pro, §13): ping the Pro players who switched
 * on "someone's looking". Null on any failure (the card keeps its own line).
 */
export async function pingVsLooking(gameMode: string): Promise<{ pinged: number; throttled: boolean } | null> {
  try {
    const res = await fetch('/api/vs/looking', { method: 'POST', headers: await headers(true), body: JSON.stringify({ gameMode }) });
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({}));
    return { pinged: Number(json.pinged) || 0, throttled: !!json.throttled };
  } catch {
    return null;
  }
}

/** user_stats rows for the VS record sums (play_type 'vs' and 'vs_cpu', every mode). */
export async function fetchVsStatRows(userId: string): Promise<Array<{ play_type: string; wins: number; losses: number }>> {
  try {
    const { data } = await (supabase as any)
      .from('user_stats')
      .select('play_type, wins, losses')
      .eq('user_id', userId)
      .in('play_type', ['vs', 'vs_cpu']);
    return data ?? [];
  } catch {
    return [];
  }
}

/** Today's daily_results 'vs' Classic row (the same row the home tile and Stats read). */
export async function fetchDailyBattleRow(userId: string, day: string): Promise<{ vs_wins: number; vs_losses: number; vs_games: number } | null> {
  try {
    const { data } = await (supabase as any)
      .from('daily_results')
      .select('vs_wins, vs_losses, vs_games')
      .eq('user_id', userId)
      .eq('day', day)
      .eq('game_mode', 'DUEL')
      .eq('play_type', 'vs')
      .limit(1);
    return data?.[0] ?? null;
  } catch {
    return null;
  }
}

/** The opponent of today's Daily Battle: the matches row on the day's shared seed. */
export async function fetchDailyBattleOpponent(userId: string, seed: string): Promise<string | null> {
  try {
    const { data } = await (supabase as any)
      .from('matches')
      .select('player1_id, player2_id')
      .eq('seed', seed)
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .not('player2_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);
    const row = data?.[0];
    if (!row) return null;
    const opp = row.player1_id === userId ? row.player2_id : row.player1_id;
    const { data: prof } = await (supabase as any).from('profiles').select('username').eq('id', opp).maybeSingle();
    return prof?.username ?? null;
  } catch {
    return null;
  }
}

export interface Rival extends RivalRow { username: string; avatarUrl: string | null }

/** The top rivals by games played, from the shared matches rows (banned players drop out). */
export async function fetchVsRivals(userId: string, limit = 3): Promise<Rival[]> {
  try {
    const { data } = await (supabase as any)
      .from('matches')
      .select('player1_id, player2_id, winner_id, game_mode')
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .not('player2_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000);
    const top = aggregateRivals(data ?? [], userId, limit + 3);
    if (top.length === 0) return [];
    const { data: profs } = await (supabase as any)
      .from('profiles').select('id, username, avatar_url, is_banned').in('id', top.map((t) => t.opponentId));
    const byId = new Map<string, { username: string; avatar_url: string | null; is_banned?: boolean }>(
      (profs ?? []).map((p: any) => [p.id, p]),
    );
    return top
      .filter((t) => byId.has(t.opponentId) && !byId.get(t.opponentId)!.is_banned)
      .slice(0, limit)
      .map((t) => ({ ...t, username: byId.get(t.opponentId)!.username, avatarUrl: byId.get(t.opponentId)!.avatar_url ?? null }));
  } catch {
    return [];
  }
}
