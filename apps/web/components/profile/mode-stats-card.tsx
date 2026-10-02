'use client';

import { statLines, type ModeAggregates } from '@/lib/mode-stats';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { SoftNum } from '@/components/ui/soft-number';
import { cardBarStyle, softCard } from '@/lib/soft-surface';

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
 * semantics; each custom game shows its own eight (Sudocious's Clean and Avg
 * Mistakes, Hubbub's Best Rank and Pangrams, …), the matches-derived ones
 * via `aggregates`. Same registry, same fixtures, on iOS and Android.
 */
export function ModeStatsCard({ gameMode, wins, losses, totalGames, bestScore, fastestTime, accentColor, winStreak, aggregates }: ModeStatsCardProps) {
  const meta = MODE_BY_DBKEY[gameMode];
  const stats = statLines(
    gameMode,
    { wins, losses, totalGames, bestScore, fastestTime, streak: winStreak?.current || 0, bestStreak: winStreak?.best || 0 },
    meta?.guessSemantics ?? 'guesses',
    meta?.guessBase ?? 1,
    aggregates,
  );

  return (
    // A1 + A2: the game's wash and 10 px top bar; every cell a soft number.
    <div className="overflow-hidden" style={softCard(accentColor, { radius: 18 })}>
      <div aria-hidden="true" style={cardBarStyle(accentColor)} />
      <div className="grid grid-cols-4 gap-3 p-4">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <SoftNum size={18} as="div" className="soft-num-auto leading-tight">{s.value}</SoftNum>
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
