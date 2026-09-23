'use client';

import { statLines, type ModeAggregates } from '@/lib/mode-stats';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';

interface ModeStatsCardProps {
  /** daily_results / user_stats key ("DUEL", "SUDOKU", …). Picks the stats profile. */
  gameMode: string;
  wins: number;
  losses: number;
  totalGames: number;
  bestScore: number;
  fastestTime: number;
  accentColor: string;
  winStreak?: { current: number; best: number };
  /** modeAggregates(gameMode, matches) — the custom games' own cells (Clean, Pangrams, …). */
  aggregates?: ModeAggregates;
}

/**
 * The 4×2 stat grid on a mode's detail panel. The eight cells come from the
 * per-mode stats registry (lib/mode-stats.ts, More Games §18): the word modes
 * show Wins … Best Streak with "Best" read through the mode's guess
 * semantics; each custom game shows its own eight (Sudoku's Clean and Avg
 * Mistakes, Hubbub's Best Rank and Pangrams, …), the matches-derived ones
 * via `aggregates`. Same registry, same fixtures, on iOS and Android.
 */
export function ModeStatsCard({ gameMode, wins, losses, totalGames, bestScore, fastestTime, winStreak, aggregates }: ModeStatsCardProps) {
  const meta = MODE_BY_DBKEY[gameMode];
  const stats = statLines(
    gameMode,
    { wins, losses, totalGames, bestScore, fastestTime, streak: winStreak?.current || 0, bestStreak: winStreak?.best || 0 },
    meta?.guessSemantics ?? 'guesses',
    meta?.guessBase ?? 1,
    aggregates,
  );

  return (
    <div
      className="p-4"
      style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
    >
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-lg font-black leading-tight" style={{ color: 'var(--color-text)' }}>{s.value}</div>
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
