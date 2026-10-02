'use client';

import { Icon3D } from '@/components/ui/icon3d';
import type { ReactNode } from 'react';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { MODE_SCORE_CONFIG } from '@/lib/composite-scoring';
import { formatGuessStat, formatShortTime } from '@/lib/format';
import { guessStatParts } from '@/lib/finished-stat';
import { modeLabel } from '@/lib/mode-labels';
import { getTodayLocal, type DailyCompletion } from '@/lib/daily-service';
import { DailyRankBadge } from '@/components/game/daily-rank-badge';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { BottomNav } from '@/components/ui/bottom-nav';
import { FinishedDock, ResultStrip } from '@/components/game/finished-kit';
import { FinishedScreen, clockTime } from '@/components/game/finished-screen';
import { SOFT_INK } from '@/lib/soft-surface';

interface CompletedCustomDailyProps {
  /** daily_results / matches game_mode key (SUDOKU, WORDSEARCH, ...). */
  dbKey: string;
  completion: DailyCompletion;
  /** Loss-progress inputs for the breakdown when the game could rebuild them
   *  (Spyglass passes found/total from its matches row). Defaults: a win is
   *  every board, a loss none, no hints. */
  boardsSolved?: number;
  totalBoards?: number;
  hintsUsed?: number;
  /** ProperNoundle's near-miss credit on a loss (most green tiles in any row),
   *  rebuilt from the matches row (founder, 2026-09-28: exact everywhere). */
  bestCorrectLetters?: number;
  /** The finished board, when the game can rebuild it — rendered above the card. */
  children?: ReactNode;
}

/**
 * The web twin of iOS CustomCompletedDailyCard (founder, 2026-09-28): what a
 * More Games daily shows when today's result exists in daily_results but this
 * browser has no local save — the puzzle was finished on another device. The
 * game keeps its own header; this fills the band below it as the one-screen
 * finished screen (docs/FINISH_SPEC.md R2): the result strip (W / L · the
 * mode's guess stat · time · points) + "Finished on another device" and the
 * daily rank, the rebuilt board (children) scaled to the room left, the dock
 * (Next daily / Leaderboard + the Pro Unlimited card), and the score
 * breakdown under "More" — then BottomNav. The parent column ends above the
 * tab bar (its finished bottom padding), so the dock never needs a scroll.
 */
export function CompletedCustomDaily({ dbKey, completion, boardsSolved, totalBoards, hintsUsed = 0, bestCorrectLetters, children }: CompletedCustomDailyProps) {
  const meta = MODE_BY_DBKEY[dbKey];
  const title = meta?.title ?? modeLabel(dbKey);
  const won = completion.won;
  const total = totalBoards ?? MODE_SCORE_CONFIG[dbKey]?.totalBoards ?? 1;
  const solved = boardsSolved ?? (won ? total : 0);
  const semantics = meta?.guessSemantics ?? 'guesses';
  const base = meta?.guessBase ?? 1;
  // The mode's own words for guess_count (misses, checks, mistakes, Par, rank …).
  const statLine = [
    formatGuessStat(semantics, base, completion.guesses),
    formatShortTime(completion.timeSeconds),
    `${completion.score.toLocaleString()} pts`,
  ].join(' · ');
  const stat = guessStatParts(semantics, base, completion.guesses);

  return (
    <>
      <FinishedScreen
        strip={
          <ResultStrip
            won={won}
            guesses={stat.value}
            guessLabel={stat.label}
            time={clockTime(completion.timeSeconds)}
            points={completion.score}
            srText={`${title} · Daily · ${won ? 'Completed today' : 'Attempted today'} · Finished on another device · ${statLine}`}
          />
        }
        sub={
          <div className="flex items-center justify-center gap-x-2 gap-y-1 flex-wrap">
            <span className="text-[11px] font-extrabold" style={{ color: SOFT_INK.label }} aria-hidden="true">Finished on another device</span>
            <DailyRankBadge gameMode={dbKey} />
          </div>
        }
        board={children ? (
          <div className="flex flex-col items-center gap-2">{children}</div>
        ) : (
          // No board to rebuild: the big W / L badge and the day's verdict.
          <div className="flex flex-col items-center gap-2 pt-4" aria-hidden="true">
            <Icon3D name={won ? 'badge-w' : 'badge-l'} size={72} />
            <span className={`text-sm font-black ${won ? 'text-green-600' : 'text-red-500'}`}>{won ? 'Completed today' : 'Attempted today'}</span>
          </div>
        )}
        dock={<FinishedDock currentMode={dbKey} isDaily />}
        more={
          <ScoreBreakdownCard gameMode={dbKey} completed={won} guessCount={completion.guesses} timeSeconds={completion.timeSeconds}
            boardsSolved={solved} totalBoards={total} hintsUsed={hintsUsed} bestCorrectLetters={bestCorrectLetters} day={getTodayLocal()} />
        }
        moreLabel="Score breakdown"
        moreAccent={meta?.accentHex}
      />
      <BottomNav />
    </>
  );
}
