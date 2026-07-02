'use client';

import { useMemo } from 'react';
import { evaluateGuess } from '@wordle-duel/core';
import type { OpponentGuessLogEntry } from '@/lib/adapters/match-service';

const TILE_BG: Record<string, string> = {
  CORRECT: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
  PRESENT: 'linear-gradient(135deg, #f59e0b, #d97706)',
  ABSENT: 'var(--color-text-muted)',
};

interface EvaluatedRow {
  letters: string[];
  states: string[]; // CORRECT | PRESENT | ABSENT
}

function evaluateLog(
  guessLog: OpponentGuessLogEntry[],
  solutions: string[],
): Map<number, EvaluatedRow[]> {
  const byBoard = new Map<number, EvaluatedRow[]>();
  for (const { boardIndex, guess } of guessLog) {
    const solution = solutions[boardIndex];
    const word = guess.toUpperCase();
    let states: string[];
    try {
      // ProperNoundle / length mismatches can throw — fall back to gray.
      states = solution
        ? evaluateGuess(solution.toUpperCase(), word).tiles.map((t: any) => t.state)
        : word.split('').map(() => 'ABSENT');
    } catch {
      states = word.split('').map(() => 'ABSENT');
    }
    const rows = byBoard.get(boardIndex) || [];
    rows.push({ letters: word.split(''), states });
    byBoard.set(boardIndex, rows);
  }
  return byBoard;
}

/**
 * Did this guess log actually solve anything? True when any guess matches its
 * board's solution. Solving beats score, which is the #1 source of confusion
 * when the loser has prettier numbers — so the result screen spells it out.
 */
export function logSolved(guessLog: OpponentGuessLogEntry[], solutions: string[]): boolean {
  return guessLog.some(({ boardIndex, guess }) => {
    const solution = solutions[boardIndex];
    return !!solution && guess.toUpperCase() === solution.toUpperCase();
  });
}

function SolveBadge({ solved, size = 10 }: { solved: boolean; size?: number }) {
  const color = solved ? '#16a34a' : '#dc2626';
  return (
    <span
      className="inline-flex items-center gap-1 font-extrabold rounded-full px-2 py-0.5"
      style={{ color, background: `${color}1a`, fontSize: size }}
    >
      {solved ? '✓ Solved' : '✗ Not solved'}
    </span>
  );
}

interface ScoreCardPlayer {
  name: string;
  score: number;
  guesses: number;
  timeMs: number;
  solved: boolean;
  isWinner: boolean;
}

/**
 * Prominent head-to-head FINAL SCORE card — big totals (winner crowned +
 * highlighted, loser dimmed), the exact calculation under each, and solve
 * badges. Replaces the inverted comparison bars, which read backwards for
 * lower-is-better metrics.
 */
export function ScoreCard({ me, opponent, isDraw }: { me: ScoreCardPlayer; opponent: ScoreCardPlayer; isDraw: boolean }) {
  const clock = (ms: number) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };
  const column = (p: ScoreCardPlayer, accent: string) => {
    const highlighted = p.isWinner || isDraw;
    const timePenalty = Math.max(0, p.score - p.guesses);
    return (
      <div className={`flex-1 min-w-0 flex flex-col items-center gap-1 ${highlighted ? '' : 'opacity-75'}`}>
        <div className="flex items-center gap-1 text-[11px] font-extrabold truncate max-w-full" style={{ color: accent }}>
          {p.isWinner && !isDraw && <span style={{ color: '#f59e0b' }}>👑</span>}
          {p.name}
        </div>
        <div
          className="text-4xl font-black tabular-nums leading-none"
          style={{ color: highlighted ? accent : 'var(--color-text-muted)' }}
        >
          {p.score.toFixed(2)}
        </div>
        <div className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
          {p.guesses} guesses + {timePenalty.toFixed(2)} time
        </div>
        <div className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{clock(p.timeMs)}</div>
        <SolveBadge solved={p.solved} />
      </div>
    );
  };

  return (
    <div
      className="rounded-2xl p-4 space-y-3 animate-fade-in-up"
      style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
    >
      <div className="text-[10px] font-extrabold uppercase tracking-widest text-center" style={{ color: 'var(--color-text-muted)' }}>
        Final Score
      </div>
      <div className="flex items-start gap-2">
        {column(me, '#7c3aed')}
        <div className="text-[13px] font-black pt-8" style={{ color: 'var(--color-text-muted)' }}>VS</div>
        {column(opponent, '#ec4899')}
      </div>
      <div className="text-[9px] font-bold text-center" style={{ color: 'var(--color-text-muted)' }}>
        Score = guesses + time (1 pt per 45s) · lowest score wins — but solving always beats not solving
      </div>
    </div>
  );
}

function LetterBoard({ rows }: { rows: EvaluatedRow[] }) {
  // Shrink tiles for long words so two boards still fit side-by-side.
  const wordLen = rows[0]?.letters.length ?? 5;
  const tile = wordLen <= 5 ? 24 : wordLen === 6 ? 21 : 18;
  return (
    <div className="flex flex-col gap-[3px]">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-[3px]">
          {row.letters.map((letter, ci) => (
            <div
              key={ci}
              className="rounded-[4px] flex items-center justify-center text-white font-black"
              style={{
                width: tile,
                height: tile,
                fontSize: tile * 0.5,
                background: TILE_BG[row.states[ci]] || TILE_BG.ABSENT,
              }}
            >
              {letter}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

interface FinalBoardsProps {
  myName: string;
  opponentName: string;
  myGuessLog: OpponentGuessLogEntry[];
  opponentGuessLog: OpponentGuessLogEntry[];
  solutions: string[];
}

/**
 * Side-by-side final boards WITH letters — yours from local play,
 * the opponent's reconstructed from the match-end guess log. Multi-board
 * modes are capped at 2 rendered boards per player with a "+N more" note.
 */
export function FinalBoards({ myName, opponentName, myGuessLog, opponentGuessLog, solutions }: FinalBoardsProps) {
  const mine = useMemo(() => evaluateLog(myGuessLog, solutions), [myGuessLog, solutions]);
  const theirs = useMemo(() => evaluateLog(opponentGuessLog, solutions), [opponentGuessLog, solutions]);

  if (mine.size === 0 && theirs.size === 0) return null;

  const mySolved = logSolved(myGuessLog, solutions);
  const oppSolved = logSolved(opponentGuessLog, solutions);

  const renderSide = (label: string, boards: Map<number, EvaluatedRow[]>, accent: string, solved: boolean) => {
    const indices = Array.from(boards.keys()).sort((a, b) => a - b);
    const shown = indices.slice(0, 2);
    const more = indices.length - shown.length;
    return (
      <div className="flex-1 min-w-0 flex flex-col items-center gap-2">
        <div className="text-[10px] font-extrabold uppercase tracking-wider truncate max-w-full" style={{ color: accent }}>
          {label}
        </div>
        {/* At-a-glance outcome for this side's boards. */}
        <SolveBadge solved={solved} size={9} />
        {shown.length === 0 ? (
          <div className="text-[10px] font-bold py-3" style={{ color: 'var(--color-text-muted)' }}>No guesses</div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {shown.map((idx) => (
              <LetterBoard key={idx} rows={boards.get(idx)!} />
            ))}
          </div>
        )}
        {more > 0 && (
          <div className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>+{more} more</div>
        )}
      </div>
    );
  };

  return (
    <div
      className="rounded-2xl p-4 animate-fade-in-up"
      style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
    >
      <div className="flex items-start gap-4">
        {renderSide(myName, mine, '#7c3aed', mySolved)}
        <div className="w-px self-stretch" style={{ background: 'var(--color-border)' }} />
        {renderSide(opponentName, theirs, '#ec4899', oppSolved)}
      </div>
      {/* Single-board modes: reveal the answer so a missed board isn't a mystery. */}
      {solutions.length === 1 && solutions[0] && (
        <div className="text-[11px] font-black tracking-widest text-center mt-3" style={{ color: 'var(--color-text)' }}>
          Answer: {solutions[0].toUpperCase()}
        </div>
      )}
    </div>
  );
}

interface ComparisonBarsProps {
  myName: string;
  opponentName: string;
  metrics: Array<{ label: string; mine: number; theirs: number; format: (v: number) => string }>;
}

/**
 * Two horizontal bars per metric (you = purple, them = pink). All three
 * metrics are lower-is-better, so bar length is inverted: the lower
 * value gets the fuller bar.
 */
export function ComparisonBars({ myName, opponentName, metrics }: ComparisonBarsProps) {
  return (
    <div
      className="rounded-2xl p-4 space-y-3 animate-fade-in-up"
      style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
    >
      {metrics.map((m) => {
        const total = m.mine + m.theirs;
        // Inverted share: my bar grows when MY value is lower.
        const myPct = total <= 0 ? 50 : (m.theirs / total) * 100;
        const theirPct = total <= 0 ? 50 : (m.mine / total) * 100;
        return (
          <div key={m.label}>
            <div className="text-[9px] font-extrabold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {m.label}
            </div>
            <div className="space-y-1">
              {[
                { name: myName, pct: myPct, value: m.mine, bg: 'linear-gradient(90deg, #a78bfa, #7c3aed)' },
                { name: opponentName, pct: theirPct, value: m.theirs, bg: 'linear-gradient(90deg, #f472b6, #ec4899)' },
              ].map((row) => (
                <div key={row.name} className="flex items-center gap-2">
                  <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(6, row.pct)}%`, background: row.bg, transition: 'width 600ms ease' }}
                    />
                  </div>
                  <span className="text-[10px] font-extrabold w-14 text-right flex-shrink-0" style={{ color: 'var(--color-text)' }}>
                    {m.format(row.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
