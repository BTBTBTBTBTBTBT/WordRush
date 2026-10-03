import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { sweepAll } from '@/lib/supabase-sweep';
import { headCount, isoDaysAgo, usernames } from '@/lib/admin/admin-queries';
import { tallyBy } from '@/lib/admin/admin-aggregates';
import { modeLabel } from '@/lib/mode-labels';

export const dynamic = 'force-dynamic';

/** Bot-ladder milestones that are server-visible (the ladder itself is per-device localStorage). */
const BOT_MILESTONES = ['wake_up_call', 'halfway_hero', 'boss_battle', 'meet_the_cast', 'daily_duelist'] as const;

/**
 * admin > Competition > VS & Bots. People VS = matches; race-my-run
 * challenges = vs_challenges + vs_challenge_entries; bot games = user_stats
 * rows with play_type 'vs_cpu' (bot games never write match rows). The bot
 * ladder and Bot of the Day progress live in each device's localStorage
 * (lib/bot/cpu-progression.ts), so the only server-side signal is the bot
 * achievements. Read-only; tables that aren't applied come back null.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const since7 = isoDaysAgo(7);
  const since1 = isoDaysAgo(1);
  const nowIso = new Date().toISOString();

  const [
    matches7, matches1, forfeits7,
    challengesAll, challenges7, challengesOpen, entries7,
    pings7,
    cpuRows, milestoneCounts,
    challenge30, recentChallengesRes,
  ] = await Promise.all([
    headCount(admin.from('matches').select('id', { count: 'exact', head: true }).gte('created_at', since7)),
    headCount(admin.from('matches').select('id', { count: 'exact', head: true }).gte('created_at', since1)),
    headCount(admin.from('matches').select('id', { count: 'exact', head: true }).gte('created_at', since7).eq('forfeit', true)),
    headCount(admin.from('vs_challenges').select('id', { count: 'exact', head: true })),
    headCount(admin.from('vs_challenges').select('id', { count: 'exact', head: true }).gte('created_at', since7)),
    headCount(admin.from('vs_challenges').select('id', { count: 'exact', head: true }).gt('expires_at', nowIso)),
    headCount(admin.from('vs_challenge_entries').select('challenge_id', { count: 'exact', head: true }).gte('created_at', since7)),
    headCount(admin.from('vs_looking_pings').select('user_id', { count: 'exact', head: true }).gte('last_sent_at', since7)),
    sweepAll<{ user_id: string; game_mode: string; wins: number; losses: number; total_games: number }>((f, t) =>
      admin.from('user_stats').select('user_id, game_mode, wins, losses, total_games').eq('play_type', 'vs_cpu').order('id').range(f, t),
    ),
    Promise.all(
      BOT_MILESTONES.map(async (key) => ({
        key,
        count: await headCount(admin.from('achievements').select('id', { count: 'exact', head: true }).eq('achievement_key', key)),
      })),
    ),
    admin.from('vs_challenges').select('game_mode, is_link').gte('created_at', isoDaysAgo(30)).limit(2000),
    admin
      .from('vs_challenges')
      .select('id, code, challenger_id, game_mode, solved, guesses, time_ms, is_link, invitee_ids, created_at, expires_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  // Bot games by mode (lifetime totals from user_stats).
  const cpuByMode = new Map<string, { mode: string; games: number; wins: number; losses: number; players: number }>();
  for (const r of cpuRows) {
    const m = cpuByMode.get(r.game_mode) ?? { mode: r.game_mode, games: 0, wins: 0, losses: 0, players: 0 };
    m.games += r.total_games ?? 0;
    m.wins += r.wins ?? 0;
    m.losses += r.losses ?? 0;
    m.players++;
    cpuByMode.set(r.game_mode, m);
  }
  const cpuPlayers = new Set(cpuRows.filter((r) => (r.total_games ?? 0) > 0).map((r) => r.user_id)).size;

  // Recent challenges with their entries.
  const recent = (recentChallengesRes.data ?? []) as Array<{
    id: string; code: string; challenger_id: string; game_mode: string; solved: boolean; guesses: number; time_ms: number;
    is_link: boolean; invitee_ids: string[] | null; created_at: string; expires_at: string;
  }>;
  const ids = recent.map((c) => c.id);
  const { data: entryRows } = ids.length
    ? await admin.from('vs_challenge_entries').select('challenge_id, user_id, outcome').in('challenge_id', ids)
    : { data: [] as Array<{ challenge_id: string; user_id: string; outcome: string }> };
  const entries = (entryRows ?? []) as Array<{ challenge_id: string; user_id: string; outcome: string }>;
  const names = await usernames(admin, [...recent.map((c) => c.challenger_id), ...entries.map((e) => e.user_id)]);

  const c30 = (challenge30.data ?? []) as Array<{ game_mode: string; is_link: boolean }>;

  return NextResponse.json({
    people: { matches7, matches1, forfeits7, pings7 },
    challenges: {
      all: challengesAll,
      last7: challenges7,
      open: challengesOpen,
      entries7,
      byMode30: tallyBy(c30, (c) => modeLabel(c.game_mode)),
      links30: c30.filter((c) => c.is_link).length,
      direct30: c30.filter((c) => !c.is_link).length,
      recent: recent.map((c) => {
        const es = entries.filter((e) => e.challenge_id === c.id);
        return {
          id: c.id,
          code: c.code,
          challengerId: c.challenger_id,
          challenger: names.get(c.challenger_id) ?? c.challenger_id.slice(0, 8),
          mode: modeLabel(c.game_mode),
          run: c.solved ? `${c.guesses} guesses · ${(c.time_ms / 1000).toFixed(0)}s` : 'did not solve',
          kind: c.is_link ? 'link' : `${c.invitee_ids?.length ?? 0} friend${(c.invitee_ids?.length ?? 0) === 1 ? '' : 's'}`,
          // Entry outcomes are from the entrant's side: an entrant's 'win' beat the challenger.
          entries: es.map((e) => ({ player: names.get(e.user_id) ?? e.user_id.slice(0, 8), outcome: e.outcome })),
          created_at: c.created_at,
          open: Date.parse(c.expires_at) > Date.now(),
        };
      }),
    },
    bots: {
      players: cpuPlayers,
      byMode: [...cpuByMode.values()].map((m) => ({ ...m, mode: modeLabel(m.mode) })).sort((a, b) => b.games - a.games),
      milestones: milestoneCounts,
    },
  });
}
