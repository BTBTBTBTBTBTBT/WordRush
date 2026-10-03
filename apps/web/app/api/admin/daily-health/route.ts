import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { sweepAll } from '@/lib/supabase-sweep';
import { MORE_GAME_MODES, sweepModesFor } from '@/lib/modes.generated';
import { modeLabel } from '@/lib/mode-labels';
import { headCount, utcDay } from '@/lib/admin/admin-queries';
import { groupHealth, type DailyRow } from '@/lib/admin/admin-aggregates';

export const dynamic = 'force-dynamic';

/** The ten Puzzles (More Games dailies), in catalog order. */
const PUZZLE_MODES = MORE_GAME_MODES.filter((m) => m.dailyEligible && m.dbKey).map((m) => m.dbKey as string);

/**
 * admin > Games & Puzzles > Today: one day's daily health, split the way the
 * Home banner splits it — the Wordocious row (the sweep dailies for that day,
 * SWEEP_ERAS) and the Puzzles row (the ten More Games dailies). Per-game plays
 * and wins, sweeps and flawless counts per row, the VS daily count, the Word
 * of the Day quiz, and whether any daily_seeds rows exist. `day` is a
 * player-local YYYY-MM-DD (daily_results.day); defaults to today in UTC.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const asked = request.nextUrl.searchParams.get('day');
  const day = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : utcDay();

  const [rows, vsPlays, quizAnswered, quizCorrect, seedsRes] = await Promise.all([
    sweepAll<DailyRow>((f, t) =>
      admin.from('daily_results').select('user_id, game_mode, completed').eq('day', day).eq('play_type', 'solo').order('id').range(f, t),
    ),
    headCount(admin.from('daily_results').select('id', { count: 'exact', head: true }).eq('day', day).eq('play_type', 'vs')),
    headCount(admin.from('word_quiz_answers').select('user_id', { count: 'exact', head: true }).eq('day', day)),
    headCount(admin.from('word_quiz_answers').select('user_id', { count: 'exact', head: true }).eq('day', day).eq('correct', true)),
    admin.from('daily_seeds').select('game_mode').eq('day', day),
  ]);

  const wordModes = sweepModesFor(day);
  const label = (g: ReturnType<typeof groupHealth>) => ({ ...g, perMode: g.perMode.map((m) => ({ ...m, label: modeLabel(m.mode) })) });

  return NextResponse.json({
    day,
    players: new Set(rows.map((r) => r.user_id)).size,
    word: { total: wordModes.length, ...label(groupHealth(rows, wordModes)) },
    puzzles: { total: PUZZLE_MODES.length, ...label(groupHealth(rows, PUZZLE_MODES)) },
    vsPlays,
    quiz: { answered: quizAnswered, correct: quizCorrect },
    seeds: seedsRes.error ? null : ((seedsRes.data ?? []) as Array<{ game_mode: string }>).map((s) => s.game_mode),
  });
}
