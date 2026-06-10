'use client';

import { useMemo } from 'react';
import { evaluateGuess } from '@wordle-duel/core';
import type { OpponentGuessLogEntry } from '@/lib/adapters/match-service';

const TILE_BG: Record<string, string> = {
  CORRECT: 'linear-gradient(135deg, #22c55e, #16a34a)',
  PRESENT: 'linear-gradient(135deg, #eab308, #ca8a04)',
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

  const renderSide = (label: string, boards: Map<number, EvaluatedRow[]>, accent: string) => {
    const indices = Array.from(boards.keys()).sort((a, b) => a - b);
    const shown = indices.slice(0, 2);
    const more = indices.length - shown.length;
    return (
      <div className="flex-1 min-w-0 flex flex-col items-center gap-2">
        <div className="text-[10px] font-extrabold uppercase tracking-wider truncate max-w-full" style={{ color: accent }}>
          {label}
        </div>
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
        {renderSide(myName, mine, '#7c3aed')}
        <div className="w-px self-stretch" style={{ background: 'var(--color-border)' }} />
        {renderSide(opponentName, theirs, '#ec4899')}
      </div>
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
