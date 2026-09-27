// New stats from the audit (Stats + Friends redesign D2, founder 2026-09-26),
// all derived from data the profile already reads — no schema change.
//
//   Free:  Best day (most wins in one day), Best week (most wins Mon–Sun),
//          Comebacks (wins on the very last row), Perfect games.
//   Pro:   Standing trend — your average "Top X%" per day over the last 30
//          days, the same badge formula everywhere.

import { supabase } from './supabase-client';
import { MODE_BY_DBKEY } from './modes.generated';
import { topPercentLabel } from './format';

/** Last-row wins: the mode's maximum guess count for word engines (a "comeback"). */
export const MODE_MAX_GUESSES: Record<string, number> = {
  DUEL: 6, QUORDLE: 9, OCTORDLE: 13, SEQUENCE: 10, RESCUE: 6, PROPERNOUNDLE: 6, DUEL_6: 7, DUEL_7: 8,
};

export interface SignatureStats {
  bestDay: { day: string; wins: number } | null;
  bestWeek: { weekStart: string; wins: number } | null;
  comebacks: number;
  perfectGames: number;
}

function localWeekStartOf(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Pure: fold match rows (created_at, game_mode, won, guessCount) into the four signature facts. */
export function computeSignature(rows: Array<{ day: string; gameMode: string; won: boolean; guessCount: number }>): SignatureStats {
  const byDay = new Map<string, number>();
  const byWeek = new Map<string, number>();
  let comebacks = 0;
  let perfect = 0;
  for (const r of rows) {
    if (!r.won) continue;
    byDay.set(r.day, (byDay.get(r.day) ?? 0) + 1);
    const w = localWeekStartOf(r.day);
    byWeek.set(w, (byWeek.get(w) ?? 0) + 1);
    const max = MODE_MAX_GUESSES[r.gameMode];
    if (max && r.guessCount === max) comebacks++;
    const meta = MODE_BY_DBKEY[r.gameMode];
    if (meta && r.guessCount <= meta.guessBase) perfect++;
  }
  const top = (m: Map<string, number>) => {
    let best: [string, number] | null = null;
    for (const [k, v] of m) if (!best || v > best[1] || (v === best[1] && k > best[0])) best = [k, v];
    return best;
  };
  const bd = top(byDay), bw = top(byWeek);
  return {
    bestDay: bd ? { day: bd[0], wins: bd[1] } : null,
    bestWeek: bw ? { weekStart: bw[0], wins: bw[1] } : null,
    comebacks,
    perfectGames: perfect,
  };
}

export async function fetchSignatureStats(userId: string): Promise<SignatureStats> {
  const { data } = await (supabase as any)
    .from('matches')
    .select('created_at, game_mode, winner_id, player1_score, player1_id, player2_id')
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .is('player2_id', null)
    .order('created_at', { ascending: false })
    .limit(1000) as { data: Array<{ created_at: string; game_mode: string; winner_id: string | null; player1_score: number; player1_id: string }> | null };
  const rows = (data ?? []).map((r) => {
    const d = new Date(r.created_at);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { day, gameMode: r.game_mode, won: r.winner_id === userId, guessCount: r.player1_score ?? 0 };
  });
  return computeSignature(rows);
}

export interface StandingPoint { day: string; topPercent: number; modes: number }

/** Pure: per-day average of the badge percentile over the dailies I played. */
export function computeStandingTrend(
  mine: Array<{ day: string; game_mode: string; composite_score: number }>,
  field: Array<{ day: string; game_mode: string; composite_score: number }>,
): StandingPoint[] {
  const scores = new Map<string, number[]>();
  for (const f of field) {
    const k = `${f.day}|${f.game_mode}`;
    const arr = scores.get(k) ?? [];
    arr.push(f.composite_score);
    scores.set(k, arr);
  }
  const perDay = new Map<string, number[]>();
  for (const m of mine) {
    const arr = scores.get(`${m.day}|${m.game_mode}`) ?? [];
    if (arr.length < 2) continue;
    const better = arr.filter((s) => s > m.composite_score).length;
    const pct = parseInt(topPercentLabel(better + 1, arr.length).label.replace(/\D/g, ''), 10);
    const list = perDay.get(m.day) ?? [];
    list.push(pct);
    perDay.set(m.day, list);
  }
  return [...perDay.entries()]
    .map(([day, pcts]) => ({ day, topPercent: Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length), modes: pcts.length }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}

export async function fetchStandingTrend(userId: string, days = 30): Promise<StandingPoint[]> {
  const to = new Date();
  const from = new Date(); from.setDate(to.getDate() - (days - 1));
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const { data: mine } = await (supabase as any)
    .from('daily_results').select('day, game_mode, composite_score')
    .eq('user_id', userId).eq('play_type', 'solo').gte('day', fmt(from)).lte('day', fmt(to)) as { data: Array<{ day: string; game_mode: string; composite_score: number }> | null };
  if (!mine || mine.length === 0) return [];
  const modes = [...new Set(mine.map((m) => m.game_mode))];
  const { data: field } = await (supabase as any)
    .from('daily_results').select('day, game_mode, composite_score')
    .eq('play_type', 'solo').gte('day', fmt(from)).lte('day', fmt(to)).in('game_mode', modes).limit(20000) as { data: Array<{ day: string; game_mode: string; composite_score: number }> | null };
  return computeStandingTrend(mine, field ?? []);
}
