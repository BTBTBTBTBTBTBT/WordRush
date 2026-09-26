'use client';

import { Trophy, Clock, Target, Flame, Crown, Zap } from 'lucide-react';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { formatGuessStat } from '@/lib/format';
import { fewestRecordLabel } from '@/lib/mode-stats';
import { fetchAllTimeRecords, type AllTimeRecord } from '@/lib/daily-service';

// Record-row chrome shared by the Records page (global Hall of Fame / by-mode
// records) and the Stats tab (your own records — Stats + Friends redesign D2
// step 3, founder 2026-09-26: the Records tab goes "so long as the
// information expected still populates elsewhere"). One table, one formatter.

// All-Time and Your Records both need the full record list — share one
// session-lived fetch (fresh on reload; records change rarely) instead of
// re-querying per visit.
let allTimeRecordsPromise: Promise<AllTimeRecord[]> | null = null;
export function fetchAllTimeRecordsShared(): Promise<AllTimeRecord[]> {
  if (!allTimeRecordsPromise) {
    allTimeRecordsPromise = fetchAllTimeRecords().catch((e) => {
      allTimeRecordsPromise = null;  // don't memoize a failure
      throw e;
    });
  }
  return allTimeRecordsPromise;
}

export const RECORD_LABELS: Record<string, { label: string; icon: typeof Trophy; format: (v: number) => string }> = {
  fastest_win: { label: 'Fastest Win', icon: Clock, format: (v) => v < 60 ? `${v}s` : `${Math.floor(v / 60)}m ${v % 60}s` },
  fewest_guesses: { label: 'Fewest Guesses', icon: Target, format: (v) => `${v} guesses` },
  most_games_played: { label: 'Most Games Played', icon: Zap, format: (v) => `${v} games` },
  longest_streak: { label: 'Longest Streak', icon: Flame, format: (v) => `${v} wins` },
  most_gold_medals: { label: 'Most Gold Medals', icon: Crown, format: (v) => `${v} golds` },
  highest_level: { label: 'Highest Level', icon: Trophy, format: (v) => `Level ${v}` },
  most_daily_completions: { label: 'Most Dailies Completed', icon: Target, format: (v) => `${v} dailies` },
};

// More Games §11: "fewest guesses" reads through the mode's guess semantics —
// Sudocious "0 mistakes", Letter Ladder "Par" — and the label follows.
export const recordValue = (rt: string, v: number, gameMode?: string | null): string => {
  const meta = gameMode ? MODE_BY_DBKEY[gameMode] : undefined;
  if (rt === 'fewest_guesses' && meta && meta.guessSemantics !== 'guesses') {
    return formatGuessStat(meta.guessSemantics, meta.guessBase, v);
  }
  return RECORD_LABELS[rt]?.format(v) ?? String(v);
};
export const recordLabel = (rt: string, gameMode?: string | null): string => {
  const meta = gameMode ? MODE_BY_DBKEY[gameMode] : undefined;
  if (rt !== 'fewest_guesses' || !meta) return RECORD_LABELS[rt]?.label ?? rt;
  // "Fewest Mistakes" / "Best vs Par" / "Fewest Misses" / "Best Rank" — the shared table.
  return fewestRecordLabel(meta.guessSemantics);
};

export const PER_MODE_RECORD_TYPES = ['fastest_win', 'fewest_guesses', 'most_games_played', 'longest_streak'];
export const GLOBAL_RECORD_TYPES = ['longest_streak', 'highest_level', 'most_gold_medals', 'most_daily_completions'];

export function formatRecordTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// Streak shields are granted every 7 days (/api/shields/grant-milestone
// MILESTONE_EVERY=7) — the "next shield" card counts toward the next multiple
// of 7, NOT the [7, 30, 100] STREAK MEDAL milestones (lib/daily-service.ts).
export const SHIELD_EVERY = 7;

export type UserStatRow = { game_mode: string; play_type: string; wins: number; losses: number; total_games: number; best_score: number | null; fastest_time: number | null };

/** One personal record: icon, value, small label — dimmed when there is none yet. */
export function MyStatCell({ icon: Icon, value, label, color, dim }: { icon: typeof Trophy; value: string; label: string; color: string; dim?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 p-2">
      <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: dim ? 'var(--color-text-muted)' : color }} />
      <div className="min-w-0 flex-1">
        <div className="font-black text-base leading-tight" style={{ color: dim ? 'var(--color-text-muted)' : 'var(--color-text)' }}>{value}</div>
        <div className="text-[10px] font-bold leading-tight mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
      </div>
    </div>
  );
}
