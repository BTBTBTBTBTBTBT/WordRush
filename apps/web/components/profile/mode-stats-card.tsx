'use client';

import { useState } from 'react';
import { statLines, type ModeAggregates } from '@/lib/mode-stats';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { SoftNum } from '@/components/ui/soft-number';
import { cardBarStyle, softCard } from '@/lib/soft-surface';
import { HeroStatsRow } from '@/components/stats/stat-hero';

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
 * A mode's stats (FRIDAY-QUEUE item 16, founder 10-07: "8 stat boxes -> 4 hero stats"): Record W–L, a Win-rate
 * ring, Streak (best small under it) and Fastest, each with a soft 3D icon, then "More stats" folding the
 * per-mode registry's eight cells (lib/mode-stats.ts, More Games §18) so nothing is lost — GAMES is wins plus
 * losses, so it never needs its own big box. "Best 4" lives in the guess chart. Same numbers on iOS and Android
 * (core heroStats).
 */
export function ModeStatsCard({ gameMode, wins, losses, totalGames, bestScore, fastestTime, accentColor, winStreak, aggregates }: ModeStatsCardProps) {
  const [more, setMore] = useState(false);
  const meta = MODE_BY_DBKEY[gameMode];
  const stats = statLines(
    gameMode,
    { wins, losses, totalGames, bestScore, fastestTime, streak: winStreak?.current || 0, bestStreak: winStreak?.best || 0 },
    meta?.guessSemantics ?? 'guesses',
    meta?.guessBase ?? 1,
    aggregates,
  );

  return (
    // A1 + A2: the game's wash and 10 px top bar; the four heroes, then the folded registry.
    <div className="overflow-hidden" style={softCard(accentColor, { radius: 18 })}>
      <div aria-hidden="true" style={cardBarStyle(accentColor)} />
      <div className="p-4 pb-3">
        <HeroStatsRow
          accent={accentColor}
          input={{ wins, losses, streak: winStreak?.current || 0, bestStreak: winStreak?.best || 0, fastestSeconds: fastestTime }}
        />
        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          aria-expanded={more}
          className="mt-3 mx-auto flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] active:scale-95 transition-transform"
          style={{ color: accentColor }}
        >
          More stats <span aria-hidden="true" style={{ display: 'inline-block', transform: more ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
        </button>
        {more && (
          <div className="grid grid-cols-4 gap-3 mt-3 animate-fade-in-up">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <SoftNum size={16} as="div" className="soft-num-auto leading-tight">{s.value}</SoftNum>
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
