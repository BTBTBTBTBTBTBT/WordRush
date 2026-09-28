'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { MODE_SCORE_CONFIG } from '@/lib/composite-scoring';
import { formatGuessStat, formatShortTime } from '@/lib/format';
import { modeLabel } from '@/lib/mode-labels';
import { getTodayLocal, type DailyCompletion } from '@/lib/daily-service';
import { MORE_HOME_HREF } from '@/lib/more-games';
import { DailyRankBadge } from '@/components/game/daily-rank-badge';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { NextDailyCta } from '@/components/game/next-daily-cta';
import { BottomNav } from '@/components/ui/bottom-nav';

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
  /** The finished board, when the game can rebuild it — rendered above the card. */
  children?: ReactNode;
}

/**
 * The web twin of iOS CustomCompletedDailyCard (founder, 2026-09-28): what a
 * More Games daily shows when today's result exists in daily_results but this
 * browser has no local save — the puzzle was finished on another device. The
 * game keeps its own header; this fills the band below it with the same
 * post-game pieces the local finish renders (result card → DailyRankBadge →
 * ScoreBreakdownCard → NextDailyCta with its Pro "Keep playing: Unlimited" link
 * → BottomNav), so the screen reads as finished, never as an empty board.
 */
export function CompletedCustomDaily({ dbKey, completion, boardsSolved, totalBoards, hintsUsed = 0, children }: CompletedCustomDailyProps) {
  const meta = MODE_BY_DBKEY[dbKey];
  const title = meta?.title ?? modeLabel(dbKey);
  const accent = meta?.accentHex ?? '#7c3aed';
  const won = completion.won;
  const total = totalBoards ?? MODE_SCORE_CONFIG[dbKey]?.totalBoards ?? 1;
  const solved = boardsSolved ?? (won ? total : 0);
  // The mode's own words for guess_count (misses, checks, mistakes, Par, rank …).
  const stat = [
    formatGuessStat(meta?.guessSemantics ?? 'guesses', meta?.guessBase ?? 1, completion.guesses),
    formatShortTime(completion.timeSeconds),
    `${completion.score.toLocaleString()} pts`,
  ].join(' · ');

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {children && (
          <div className="flex flex-col items-center gap-2 px-3 py-2">
            {children}
          </div>
        )}
        <div className="px-4 pb-4 pt-2 animate-fade-in-up">
          <div className="flex items-center gap-3 rounded-xl p-3 bg-white border border-gray-100 shadow-sm">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-xl font-black"
              style={{ backgroundColor: `${accent}15`, border: `2px solid ${accent}44`, color: accent }}
              aria-hidden>
              {won ? '✓' : '✗'}
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: accent }}>{title} · Daily</span>
              <span className={`text-sm font-bold ${won ? 'text-green-600' : 'text-red-500'}`}>
                {won ? 'Completed today' : 'Attempted today'}
              </span>
              <span className="text-xs text-gray-400">Finished on another device</span>
              <span className="text-xs text-gray-400">{stat}</span>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <Link href={MORE_HOME_HREF} className="text-gray-400 text-xs font-bold underline">Home</Link>
                <span
                  className="inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={won
                    ? { background: '#dcfce7', border: '1px solid #86efac', color: '#166534' }
                    : { background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b' }}
                  aria-label={won ? 'Win' : 'Loss'}>
                  {won ? 'W' : 'L'}
                </span>
                <DailyRankBadge gameMode={dbKey} />
              </div>
            </div>
          </div>
          <ScoreBreakdownCard gameMode={dbKey} completed={won} guessCount={completion.guesses} timeSeconds={completion.timeSeconds}
            boardsSolved={solved} totalBoards={total} hintsUsed={hintsUsed} day={getTodayLocal()} />
          <NextDailyCta currentMode={dbKey} />
        </div>
      </div>
      <BottomNav />
    </>
  );
}
