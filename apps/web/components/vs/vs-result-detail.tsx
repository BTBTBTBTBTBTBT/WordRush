'use client';

import { useMemo } from 'react';
import {
  evaluateGuess,
  createInitialState,
  gameReducer,
  GameMode,
  GameStatus,
  type GauntletProgress,
} from '@wordle-duel/core';
import type { OpponentGuessLogEntry } from '@/lib/adapters/match-service';
import {
  CompletedMiniBoard,
  GauntletStageBreakdown,
  type RecapBoard,
} from '@/components/game/completed-mini-board';

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
  /** Match mode + seed — multi-board modes replay each player's guess list
   *  through the engine (from the seed) to rebuild the full board set. */
  mode?: GameMode;
  seed?: string;
  /** Per-side elapsed (ms) — feeds the Gauntlet stage review's TIME stat. */
  myTimeMs?: number;
  opponentTimeMs?: number;
}

/**
 * Rebuild one player's full board set by replaying their flat guess list
 * through the real reducer from the deterministic match seed (which also
 * regenerates Deliverance's prefilled rows) — the same replay the solo
 * "view solved puzzle" path uses. Falls back to a flat per-board rebuild
 * when the seed doesn't reproduce the recorded solutions.
 */
function reconstructRecapBoards(
  mode: GameMode,
  seed: string,
  solutions: string[],
  guesses: string[],
): RecapBoard[] {
  if (seed) {
    let state = createInitialState(seed, mode);
    const seedMatches =
      solutions.length === 0 ||
      (state.boards.length === solutions.length &&
        new Set(state.boards.map(b => b.solution.toUpperCase())).size ===
          new Set([...state.boards.map(b => b.solution.toUpperCase()), ...solutions.map(s => s.toUpperCase())]).size);
    if (seedMatches && !state.gauntlet) {
      const applyToAll = state.boards.length > 1 && mode !== GameMode.SEQUENCE;
      let safety = 0;
      for (const raw of guesses) {
        if (state.status !== GameStatus.PLAYING || ++safety > 200) break;
        const guess = String(raw ?? '').toUpperCase();
        if (!guess) continue;
        if (mode === GameMode.SEQUENCE) {
          const idx = state.boards.findIndex(b => b.status === GameStatus.PLAYING);
          if (idx < 0) break;
          state = gameReducer(state, { type: 'SUBMIT_GUESS', guess, boardIndex: idx });
        } else {
          state = gameReducer(state, { type: 'SUBMIT_GUESS', guess, applyToAll });
        }
      }
      return state.boards.map(b => ({
        solution: b.solution,
        guesses: b.guesses,
        maxGuesses: b.maxGuesses,
        won: b.status === GameStatus.WON,
      }));
    }
  }
  // Legacy flat rebuild: each board gets the shared guesses up to (and
  // including) its solve.
  return solutions.map(sol => {
    const g: string[] = [];
    let solved = false;
    for (const guess of guesses) {
      g.push(guess.toUpperCase());
      if (guess.toUpperCase() === sol.toUpperCase()) { solved = true; break; }
    }
    return { solution: sol, guesses: g, maxGuesses: Math.max(1, g.length), won: solved };
  });
}

/**
 * Deterministically rebuild a Gauntlet run's per-stage breakdown by replaying
 * the flat guess list through the engine (the `NEXT_STAGE` reducer records
 * each cleared stage's snapshot, so a pure replay reproduces the run).
 */
function gauntletReconstruct(
  seed: string,
  guesses: string[],
): { progress: GauntletProgress; won: boolean } | null {
  if (!seed) return null;
  let state = createInitialState(seed, GameMode.GAUNTLET);
  if (!state.gauntlet) return null;
  let idx = 0;
  let safety = 0;
  while (idx < guesses.length && state.status === GameStatus.PLAYING && safety < 1000) {
    safety += 1;
    const multi = state.boards.length > 1;
    state = gameReducer(state, {
      type: 'SUBMIT_GUESS',
      guess: String(guesses[idx] ?? '').toUpperCase(),
      boardIndex: multi ? undefined : 0,
      applyToAll: multi,
    });
    idx += 1;
    // Stage cleared but run not finished → advance (records the won stage's
    // result + boards snapshot, then sets up the next stage).
    if (
      state.status === GameStatus.PLAYING &&
      state.gauntlet &&
      state.boards.every(b => b.status === GameStatus.WON)
    ) {
      state = gameReducer(state, { type: 'NEXT_STAGE' });
    }
  }
  if (!state.gauntlet || state.gauntlet.stageResults.length === 0) return null;
  return { progress: state.gauntlet, won: state.status === GameStatus.WON };
}

/**
 * Final boards WITH letters — yours from local play, the opponent's
 * reconstructed from the match-end guess log. Single-board modes render the
 * two boards side-by-side for direct comparison; multi-board modes render
 * each player's FULL board set as the same compact per-board recap the solo
 * post-game uses (every board visible with its solved/failed frame — the old
 * 2-boards-plus-"+N more" stack read as a wall of ambiguous letters).
 * Gauntlet matches get the solo-style expandable stage-by-stage review.
 */
export function FinalBoards({
  myName, opponentName, myGuessLog, opponentGuessLog, solutions,
  mode = GameMode.DUEL, seed = '', myTimeMs = 0, opponentTimeMs = 0,
}: FinalBoardsProps) {
  const mine = useMemo(() => evaluateLog(myGuessLog, solutions), [myGuessLog, solutions]);
  const theirs = useMemo(() => evaluateLog(opponentGuessLog, solutions), [opponentGuessLog, solutions]);

  if (mine.size === 0 && theirs.size === 0) return null;

  const mySolved = logSolved(myGuessLog, solutions);
  const oppSolved = logSolved(opponentGuessLog, solutions);

  // ── Gauntlet: the solo-style stage-by-stage fan-down per player (a flat
  // 21-board letter wall was unreadable). ─────────────────────────────────
  if (mode === GameMode.GAUNTLET) {
    const gauntletSection = (label: string, words: string[], accent: string, timeMs: number) => {
      const rec = words.length > 0 ? gauntletReconstruct(seed, words) : null;
      return (
        <div className="flex flex-col items-center gap-2">
          <div className="text-[10px] font-extrabold uppercase tracking-wider truncate max-w-full" style={{ color: accent }}>
            {label}
          </div>
          {words.length === 0 ? (
            <div className="text-[10px] font-bold py-2" style={{ color: 'var(--color-text-muted)' }}>No guesses</div>
          ) : rec ? (
            <div className="w-full">
              <GauntletStageBreakdown
                stages={rec.progress.stages}
                stageResults={rec.progress.stageResults}
                stagesCleared={rec.progress.stageResults.filter(r => r.status === GameStatus.WON).length}
                totalGuesses={rec.progress.stageResults.reduce((sum, r) => sum + r.guesses, 0)}
                totalTimeMs={timeMs}
              />
            </div>
          ) : (
            <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
              {words.length} guesses
            </div>
          )}
        </div>
      );
    };
    return (
      <div
        className="rounded-2xl p-4 space-y-3 animate-fade-in-up"
        style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
      >
        {gauntletSection(myName, myGuessLog.map(e => e.guess), '#7c3aed', myTimeMs)}
        <div className="h-px" style={{ background: 'var(--color-border)' }} />
        {gauntletSection(opponentName, opponentGuessLog.map(e => e.guess), '#ec4899', opponentTimeMs)}
      </div>
    );
  }

  // ── Multi-board (QuadWord/OctoWord/Succession/Deliverance): each player's
  // FULL board set as the compact solo-style recap. ────────────────────────
  if (solutions.length > 1) {
    const recapSection = (label: string, words: string[], accent: string, solved: boolean) => {
      const boards = reconstructRecapBoards(mode, seed, solutions, words);
      const rowCount = Math.max(1, ...boards.map(b => b.guesses.length));
      return (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider truncate" style={{ color: accent }}>
              {label}
            </span>
            <SolveBadge solved={solved} size={9} />
          </div>
          {words.length === 0 ? (
            <div className="text-[10px] font-bold py-2" style={{ color: 'var(--color-text-muted)' }}>No guesses</div>
          ) : (
            <div
              className="mx-auto flex flex-wrap justify-center gap-2"
              style={{ maxWidth: boards.length > 4 ? 'min(320px, 100%)' : '240px' }}
            >
              {boards.map((board, i) => (
                <CompletedMiniBoard
                  key={i}
                  solution={board.solution}
                  guesses={board.guesses}
                  maxGuesses={rowCount}
                  won={board.won}
                  tileSize={boards.length > 4 ? 12 : 20}
                />
              ))}
            </div>
          )}
        </div>
      );
    };
    return (
      <div
        className="rounded-2xl p-4 space-y-3 animate-fade-in-up"
        style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
      >
        {recapSection(myName, myGuessLog.map(e => e.guess), '#7c3aed', mySolved)}
        <div className="h-px" style={{ background: 'var(--color-border)' }} />
        {recapSection(opponentName, opponentGuessLog.map(e => e.guess), '#ec4899', oppSolved)}
      </div>
    );
  }

  // ── Single board (Classic/Six/Seven/ProperNoundle): side-by-side letters. ─
  const renderSide = (label: string, boards: Map<number, EvaluatedRow[]>, accent: string, solved: boolean) => {
    const indices = Array.from(boards.keys()).sort((a, b) => a - b);
    return (
      <div className="flex-1 min-w-0 flex flex-col items-center gap-2">
        <div className="text-[10px] font-extrabold uppercase tracking-wider truncate max-w-full" style={{ color: accent }}>
          {label}
        </div>
        {/* At-a-glance outcome for this side's boards. */}
        <SolveBadge solved={solved} size={9} />
        {indices.length === 0 ? (
          <div className="text-[10px] font-bold py-3" style={{ color: 'var(--color-text-muted)' }}>No guesses</div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {indices.map((idx) => (
              <LetterBoard key={idx} rows={boards.get(idx)!} />
            ))}
          </div>
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
      {/* Reveal the answer so a missed board isn't a mystery. */}
      {solutions[0] && (
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
