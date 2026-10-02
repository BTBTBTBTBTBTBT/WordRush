'use client';

import type { CSSProperties, ReactNode } from 'react';
import { FinishedDock, FitBox, MoreDisclosure, ResultStrip } from '@/components/game/finished-kit';
import { DailyRankBadge } from '@/components/game/daily-rank-badge';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { BottomNav } from '@/components/ui/bottom-nav';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { MODE_SCORE_CONFIG } from '@/lib/composite-scoring';
import { formatGuessStat, formatShortTime } from '@/lib/format';
import { modeLabel } from '@/lib/mode-labels';
import { getTodayLocal, type DailyCompletion } from '@/lib/daily-service';
import { MORE_PEEK, clockTime, guessStatParts } from '@/lib/puzzle-finished';

// The puzzle games' one-screen finished screen (docs/FINISH_SPEC.md R2),
// composed from the shared finished kit (components/game/finished-kit.tsx):
// under the game's own header, ONE column exactly as tall as the room left
// above the docked tab bar (minus the More row's peek) — the result strip,
// the board in a FitBox (scaled down to whatever height is left), then the
// action dock. Extras (score breakdown, clues, all-words lists, step lists)
// sit in a MoreDisclosure just below the dock: its summary row peeks above
// the tab bar, and opening it scrolls the extras into view — never above the
// buttons.

/**
 * The finished game shell's bottom padding: the docked tab bar's measured
 * room (BottomNav publishes --bottom-nav-h), with the old 80 px estimate as
 * the fallback for the first frame.
 */
export const FINISHED_SHELL_PAD: CSSProperties = { paddingBottom: 'var(--bottom-nav-h, calc(env(safe-area-inset-bottom) + 72px))' };

export function PuzzleFinished({ strip, board, dock, beforeDock, more }: {
  strip: ReactNode;
  /** The finished board(s): scaled to the room the strip and dock leave. */
  board: ReactNode;
  /** <FinishedDock …/>. */
  dock: ReactNode;
  /** A row that must stay on screen between the board and the dock (Hubbub's Keep going). */
  beforeDock?: ReactNode;
  /** <MoreDisclosure …/> with the extras, below the dock. */
  more?: ReactNode;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <div className="flex flex-col px-3 pt-0.5" style={{ height: more ? `calc(100% - ${MORE_PEEK}px)` : '100%' }}>
        <div className="shrink-0 pb-1.5">{strip}</div>
        <FitBox>{board}</FitBox>
        {beforeDock && <div className="shrink-0 flex justify-center pt-1.5">{beforeDock}</div>}
        {dock}
      </div>
      {more && <div className="px-3 pb-3">{more}</div>}
    </div>
  );
}

/**
 * A puzzle daily finished on another device (the web twin of iOS
 * CustomCompletedDailyCard, as components/game/completed-custom-daily.tsx
 * draws it for the word games) in the same one-screen layout: the strip from
 * the daily_results row + "Finished on another device", the board rebuilt
 * from the matches row (when the game could) in the FitBox, the dock (no
 * share: there is no local board state to share) with the rank badge, the
 * score breakdown under More, then the tab bar.
 */
export function PuzzleElsewhere({ dbKey, completion, boardsSolved, totalBoards, hintsUsed = 0, children, moreExtra }: {
  dbKey: string;
  completion: DailyCompletion;
  boardsSolved?: number;
  totalBoards?: number;
  hintsUsed?: number;
  /** The rebuilt finished board, when the game has it. */
  children?: ReactNode;
  /** Extras for the More disclosure beside the score breakdown (clues, word lists). */
  moreExtra?: ReactNode;
}) {
  const meta = MODE_BY_DBKEY[dbKey];
  const title = meta?.title ?? modeLabel(dbKey);
  const won = completion.won;
  const total = totalBoards ?? MODE_SCORE_CONFIG[dbKey]?.totalBoards ?? 1;
  const solved = boardsSolved ?? (won ? total : 0);
  const semantics = meta?.guessSemantics ?? 'guesses';
  const base = meta?.guessBase ?? 1;
  const g = guessStatParts(semantics, base, completion.guesses);
  const stat = [formatGuessStat(semantics, base, completion.guesses), formatShortTime(completion.timeSeconds), `${completion.score.toLocaleString()} pts`].join(' · ');
  return (
    <>
      <PuzzleFinished
        strip={
          <>
            <ResultStrip won={won} guesses={g.value} guessLabel={g.label} time={clockTime(completion.timeSeconds)} points={completion.score}
              srText={`${title} daily: ${won ? 'completed' : 'attempted'} today, finished on another device. ${stat}`} />
            <div className="text-center text-[10px] font-black uppercase mt-1" style={{ letterSpacing: '0.12em', color: 'var(--color-text-muted)' }} aria-hidden>
              Finished on another device
            </div>
          </>
        }
        board={children ? <div className="flex flex-col items-center gap-2 px-1 pb-1">{children}</div> : null}
        dock={<FinishedDock currentMode={dbKey} isDaily extra={<DailyRankBadge gameMode={dbKey} />} />}
        more={
          <MoreDisclosure accent={meta?.accentHex}>
            <div className="flex flex-col gap-3">
              {moreExtra}
              <ScoreBreakdownCard gameMode={dbKey} completed={won} guessCount={completion.guesses} timeSeconds={completion.timeSeconds}
                boardsSolved={solved} totalBoards={total} hintsUsed={hintsUsed} day={getTodayLocal()} />
            </div>
          </MoreDisclosure>
        }
      />
      <BottomNav />
    </>
  );
}
