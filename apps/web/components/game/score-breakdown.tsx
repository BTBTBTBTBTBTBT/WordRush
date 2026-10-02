'use client';

import { computeScoreBreakdown } from '@/lib/daily-service';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { SoftNum } from '@/components/ui/soft-number';
import { cardBarStyle } from '@/lib/soft-surface';

/** "Guess bonus" reads through the mode's guess semantics (More Games §11):
 *  Sudocious and Starsweep count mistakes, so their row says "Mistake bonus". */
export function guessBonusLabel(gameMode: string): string {
  switch (MODE_BY_DBKEY[gameMode]?.guessSemantics) {
    case 'mistakes': return 'Mistake bonus';
    case 'checks': return 'Check bonus';
    case 'misses': return 'Miss bonus';
    case 'overPar': return 'Par bonus';
    case 'rank': return 'Rank bonus';
    default: return 'Guess bonus';
  }
}

interface ScoreBreakdownCardProps {
  gameMode: string;
  completed: boolean;
  guessCount: number;
  timeSeconds: number;
  boardsSolved: number;
  totalBoards: number;
  hintsUsed?: number;
  /** GAUNTLET loss: stages fully cleared (drives the stage-depth ladder). */
  stagesCompleted?: number;
  /** Single-board loss: best green-letter count (drives near-miss credit). */
  bestCorrectLetters?: number;
  /** The PUZZLE's day (YYYY-MM-DD). Pre-cutover days render with the frozen
   *  V1 formula so the card always matches the score that was recorded.
   *  Omit for practice/undated games (current formula). */
  day?: string;
}

const fmtTime = (s: number) => {
  if (s <= 0) return '0s';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

/**
 * Renders the leaderboard composite-score breakdown on the post-game
 * screen. Same formula as the leaderboard reads — if a number on this
 * card changes, the leaderboard placement changes with it. Hides the
 * hint-penalty row for modes that don't expose hints so the card stays
 * tight for Classic/Quordle/etc.
 */
export function ScoreBreakdownCard(props: ScoreBreakdownCardProps) {
  const {
    gameMode, completed, guessCount, timeSeconds,
    boardsSolved, totalBoards, hintsUsed = 0,
    stagesCompleted, bestCorrectLetters, day,
  } = props;
  const b = computeScoreBreakdown(
    gameMode, completed, guessCount, timeSeconds, boardsSolved, totalBoards, hintsUsed,
    stagesCompleted, bestCorrectLetters, day,
  );

  const guessesLeft = Math.max(0, b.maxGuesses - guessCount);
  const timeUnder = Math.max(0, b.timeCap - timeSeconds);

  // FINISH_SPEC B6: a lavender card with a purple top bar, dashed dividers,
  // purple values and the total as a big soft number.
  return (
    <div
      className="w-full max-w-[400px] mx-auto mt-3 overflow-hidden"
      style={{
        background: 'linear-gradient(#7c3aed12, #7c3aed12), var(--color-card-base, #ffffff)',
        borderRadius: 20,
        border: '1.5px solid #e2d3ff',
        boxShadow: '0 8px 20px rgba(60, 30, 110, 0.10)',
      }}
    >
      <div aria-hidden="true" style={{ ...cardBarStyle('#7c3aed'), background: 'linear-gradient(90deg, #7c3aed, #a855f7)' }} />
      <div className="px-3.5 pt-2.5 pb-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-black uppercase" style={{ letterSpacing: '0.12em', color: '#5b3c96' }}>
          Score Breakdown
        </span>
        <span className="flex items-baseline gap-1.5" aria-label={`${b.total.toFixed(0)} points`}>
          <SoftNum size={30}>{Math.round(b.total).toLocaleString('en-US')}</SoftNum>
          <small className="font-black" style={{ fontSize: 12, letterSpacing: '0.1em', color: '#6d28d9' }}>PTS</small>
        </span>
      </div>

      <Row
        label={completed ? 'Win bonus' : 'Did not finish'}
        detail={completed ? '' : 'no win bonus'}
        value={b.basePoints}
      />
      {completed && b.guessBonusApplies && (
        <Row
          label={guessBonusLabel(gameMode)}
          detail={`${guessesLeft} unused × ${b.guessWeight}`}
          value={b.guessBonus}
        />
      )}
      {completed && (
        <Row
          label="Speed bonus"
          detail={timeSeconds > b.timeCap ? `${fmtTime(timeSeconds - b.timeCap)} over ${fmtTime(b.timeCap)}` : `${fmtTime(timeUnder)} under ${fmtTime(b.timeCap)}`}
          value={b.timeBonus}
        />
      )}
      {b.completionBonus > 0 && (
        <Row
          label={
            completed ? 'Completion bonus'
            : gameMode === 'GAUNTLET' ? 'Stage progress'
            : totalBoards > 1 ? 'Completion bonus'
            : 'Near miss'
          }
          detail={
            completed
              ? (totalBoards > 1 ? `${boardsSolved}/${totalBoards} boards` : 'puzzle solved')
              : gameMode === 'GAUNTLET'
                ? `${stagesCompleted ?? 0}/5 stages cleared`
                : totalBoards > 1
                  ? `${boardsSolved}/${totalBoards} boards`
                  : `${bestCorrectLetters ?? 0} correct letter${(bestCorrectLetters ?? 0) === 1 ? '' : 's'}`
          }
          value={Math.round(b.completionBonus * 100) / 100}
        />
      )}
      {b.hasHints && (
        <Row
          label="Hint penalty"
          detail={
            hintsUsed === 0
              ? 'no hints — full credit'
              : `${hintsUsed} hint${hintsUsed === 1 ? '' : 's'} × ${b.hintCost}`
          }
          value={-b.hintPenalty}
          highlight={hintsUsed === 0 && completed ? 'pure' : undefined}
        />
      )}
      </div>
    </div>
  );
}

function Row({
  label, detail, value, highlight,
}: {
  label: string;
  detail: string;
  value: number;
  highlight?: 'pure';
}) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const abs = Math.abs(Math.round(value * 100) / 100);
  return (
    <div className="flex items-baseline justify-between gap-2 py-1.5 px-0.5 [&+&]:border-t [&+&]:border-dashed" style={{ borderColor: 'rgba(124, 58, 237, 0.18)' }}>
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span
          className="text-[14px] font-black"
          style={{
            color: highlight === 'pure' ? '#7c3aed' : 'var(--color-text)',
          }}
        >
          {label}
        </span>
        {detail && (
          <span className="text-[11.5px] font-bold truncate" style={{ color: '#7a6a95' }}>
            {detail}
          </span>
        )}
      </div>
      <span
        className="text-[15px] font-black shrink-0 ml-2 tabular-nums"
        style={{
          color:
            value > 0 ? '#6d28d9'
            : value < 0 ? '#dc2626'
            : 'var(--color-text-muted)',
        }}
      >
        {sign}{abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}
      </span>
    </div>
  );
}
