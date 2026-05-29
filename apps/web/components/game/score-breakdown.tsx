'use client';

import { computeScoreBreakdown } from '@/lib/daily-service';

interface ScoreBreakdownCardProps {
  gameMode: string;
  completed: boolean;
  guessCount: number;
  timeSeconds: number;
  boardsSolved: number;
  totalBoards: number;
  hintsUsed?: number;
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
  } = props;
  const b = computeScoreBreakdown(
    gameMode, completed, guessCount, timeSeconds, boardsSolved, totalBoards, hintsUsed,
  );

  const guessesLeft = Math.max(0, b.maxGuesses - guessCount);
  const timeUnder = Math.max(0, b.timeCap - timeSeconds);

  return (
    <div
      className="w-full max-w-[400px] mx-auto mt-3 px-3 py-2.5"
      style={{
        background: 'var(--color-bg)',
        borderRadius: '12px',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          Score Breakdown
        </span>
        <span className="text-sm font-black" style={{ color: 'var(--color-text)' }}>
          {b.total.toFixed(0)} pts
        </span>
      </div>

      <Row
        label={completed ? 'Win bonus' : 'Did not finish'}
        detail={completed ? '' : 'no win bonus'}
        value={b.basePoints}
      />
      {completed && (
        <Row
          label="Guess bonus"
          detail={`${guessesLeft} unused × ${b.guessWeight}`}
          value={b.guessBonus}
        />
      )}
      {completed && (
        <Row
          label="Time bonus"
          detail={`${fmtTime(timeUnder)} under ${fmtTime(b.timeCap)}`}
          value={b.timeBonus}
        />
      )}
      {totalBoards > 1 && (
        <Row
          label="Completion bonus"
          detail={`${boardsSolved}/${totalBoards} boards`}
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
    <div className="flex items-baseline justify-between py-0.5">
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span
          className="text-xs font-bold"
          style={{
            color: highlight === 'pure' ? '#16a34a' : 'var(--color-text)',
          }}
        >
          {label}
        </span>
        {detail && (
          <span className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>
            {detail}
          </span>
        )}
      </div>
      <span
        className="text-xs font-black shrink-0 ml-2"
        style={{
          color:
            value > 0 ? 'var(--color-text)'
            : value < 0 ? '#dc2626'
            : 'var(--color-text-muted)',
        }}
      >
        {sign}{abs.toFixed(0)}
      </span>
    </div>
  );
}
