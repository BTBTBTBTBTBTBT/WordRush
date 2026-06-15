'use client';

import { useMemo, useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { evaluateGuess, TileState, GameStatus, BoardState, generateDailySeed, type GameState, type GameMode } from '@wordle-duel/core';
import type { GauntletProgress, GauntletStageConfig, GauntletStageResult } from '@wordle-duel/core';
import { replayRecordedGuesses } from '@/hooks/use-game-snapshot';
import { supabase } from '@/lib/supabase-client';
import { Board } from '@/components/game/board';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { useWordDefinition } from '@/hooks/use-word-definition';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';
import { getTodayLocal, formatHintsLabel } from '@/lib/daily-service';
import { useAuth } from '@/lib/auth-context';
import { useDailyCompletions } from '@/lib/daily-completions-context';
import { fetchGauntletStages } from '@/lib/stats-service';
import { getDailyPuzzle } from '@/components/propernoundle/puzzle-service';
import { normalizeString } from '@/components/propernoundle/game-logic';
import type { Guess as ProperNoundleGuess, TileState as PNTileState } from '@/components/propernoundle/types';

const MULTI_BOARD_MODES = new Set(['QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE']);

/** Collapsible card wrapper used by all completed daily board variants */
function CollapsibleCompletedCard({
  won,
  summaryLabel,
  children,
}: {
  won: boolean;
  summaryLabel: string;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="mb-4"
      style={{
        background: 'var(--color-surface)',
        border: '1.5px solid var(--color-border)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      {/* Top accent */}
      <div
        className="h-1"
        style={{
          background: won
            ? 'linear-gradient(90deg, #7c3aed, #a78bfa)'
            : 'linear-gradient(90deg, #9ca3af, #d1d5db)',
        }}
      />

      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5"
      >
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0"
            style={{
              background: won ? '#f5f3ff' : '#fee2e2',
              color: won ? '#7c3aed' : '#dc2626',
            }}
          >
            {won ? '✓' : '✗'}
          </span>
          <span
            className="text-[10px] font-extrabold uppercase tracking-wider"
            style={{ color: won ? '#7c3aed' : 'var(--color-text-muted)' }}
          >
            {won ? 'Completed' : 'Attempted'} Today
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
            {summaryLabel}
          </span>
          <ChevronDown
            className="w-3.5 h-3.5 transition-transform duration-200"
            style={{
              color: 'var(--color-text-muted)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </div>
      </button>

      {/* Collapsible content */}
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: expanded ? '2000px' : '0px', opacity: expanded ? 1 : 0 }}
      >
        <div className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
}

interface SavedSession {
  version: number;
  date: string;
  mode: string;
  isDaily: boolean;
  seed: string;
  elapsedTime: number;
  savedAt: number;
  state: {
    status: string;
    boards: BoardState[];
    gauntlet?: GauntletProgress;
  };
}

function loadCompletedSession(modeId: string): SavedSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = `wordocious-session-${modeId}-daily`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const parsed: SavedSession = JSON.parse(stored);
    if (parsed.date !== getTodayLocal()) return null;
    if (parsed.state.status !== 'WON' && parsed.state.status !== 'LOST') return null;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ProperNoundle uses a completely different persistence format
interface SavedProperNoundleState {
  date: string;
  puzzleId: string;
  guesses: ProperNoundleGuess[];
  gameStatus: 'playing' | 'won' | 'lost';
  letterStates: Record<string, PNTileState>;
  elapsedTime: number;
  // Persisted by propernoundle-game.tsx; only the used-flags are read here
  // (to show the hint count in the completed-today summary).
  hintState?: {
    hintUsed?: boolean;
    vowelUsed?: boolean;
    consonantUsed?: boolean;
  };
}

function loadCompletedProperNoundle(): SavedProperNoundleState | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('wordocious-propernoundle-daily');
    if (!stored) return null;
    const parsed: SavedProperNoundleState = JSON.parse(stored);
    if (parsed.date !== getTodayLocal()) return null;
    if (parsed.gameStatus !== 'won' && parsed.gameStatus !== 'lost') return null;
    // Drop saves whose puzzleId doesn't match today's daily. The caller
    // also checks this downstream, but wiping here clears the stale
    // localStorage entry instead of carrying it forward across refreshes.
    const today = getDailyPuzzle();
    if (!parsed.puzzleId || parsed.puzzleId !== today.id) {
      localStorage.removeItem('wordocious-propernoundle-daily');
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

interface CompletedDailyBoardProps {
  modeId: string;
}

const getTileColor = (state: TileState) => {
  switch (state) {
    case TileState.CORRECT: return 'tile-correct';
    case TileState.PRESENT: return 'tile-present';
    case TileState.ABSENT: return 'tile-absent';
    case TileState.HINT_USED: return 'bg-gray-100 border-gray-200';
    default: return 'bg-white border-gray-300';
  }
};

const evaluateGuessTiles = (guess: string, solution: string): TileState[] => {
  const len = solution.length;
  const result: TileState[] = Array(len).fill(TileState.EMPTY);
  const solutionArray = solution.split('');
  const guessArray = guess.split('');
  const used = Array(len).fill(false);

  guessArray.forEach((letter, i) => {
    if (letter === solutionArray[i]) { result[i] = TileState.CORRECT; used[i] = true; }
  });
  guessArray.forEach((letter, i) => {
    if (result[i] === TileState.EMPTY) {
      const f = solutionArray.findIndex((l, idx) => l === letter && !used[idx]);
      if (f !== -1) { result[i] = TileState.PRESENT; used[f] = true; }
      else { result[i] = TileState.ABSENT; }
    }
  });
  return result;
};

// ── Compact mini board for multi-board completed view ──
// Uses a FIXED tile size (px) rather than aspect-ratio + auto rows. The latter
// let empty rows collapse to ~0 height on some layout passes, so boards with
// fewer guesses rendered shorter than their neighbours (the "wonky"/uneven
// grid). A definite tile size makes every board the same height = crisp grid,
// mirroring the native CompletedMiniBoardView.
function CompletedMiniBoard({ solution, guesses, maxGuesses, won, hintEvaluations, tileSize = 16 }: {
  solution: string;
  guesses: string[];
  maxGuesses: number;
  hintEvaluations?: Record<number, import('@wordle-duel/core').GuessResult>;
  won: boolean;
  tileSize?: number;
}) {
  const wordLen = solution.length;
  const fontSize = Math.max(6, Math.round(tileSize * 0.5));
  return (
    <div className={`relative p-0.5 rounded-lg border-2 ${
      won ? 'border-violet-400 bg-violet-50' : 'border-red-400 bg-red-50'
    }`}>
      {won && (
        <div className="absolute -top-1.5 -right-1.5 bg-violet-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center z-10">
          ✓
        </div>
      )}
      <div
        className="grid gap-[1px]"
        style={{
          gridTemplateColumns: `repeat(${wordLen}, ${tileSize}px)`,
          gridTemplateRows: `repeat(${maxGuesses}, ${tileSize}px)`,
        }}
      >
        {Array.from({ length: maxGuesses }).flatMap((_, rowIndex) => {
          const guess = guesses[rowIndex] || '';
          const isPast = rowIndex < guesses.length;
          const tiles = isPast
            ? (hintEvaluations?.[rowIndex]
                ? hintEvaluations[rowIndex].tiles.map(t => t.state)
                : evaluateGuessTiles(guess, solution))
            : Array(wordLen).fill(TileState.EMPTY);

          return Array.from({ length: wordLen }).map((_, li) => {
            const letter = guess[li] || '';
            const tileState = isPast ? tiles[li] : TileState.EMPTY;
            return (
              <div
                key={`${rowIndex}-${li}`}
                className={`flex items-center justify-center border rounded font-bold leading-none ${
                  tileState === TileState.EMPTY ? 'text-gray-800' : 'text-white'
                } ${getTileColor(tileState)}`}
                style={{ width: tileSize, height: tileSize, fontSize }}
              >
                {letter.toUpperCase()}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}

// ── ProperNoundle mini board with variable-length word groups ──
function CompletedProperNoundleMiniBoard({ guesses, maxGuesses, answerDisplay }: {
  guesses: ProperNoundleGuess[];
  maxGuesses: number;
  answerDisplay: string;
}) {
  const wordGroups = answerDisplay.split(' ').map(word => normalizeString(word).length);
  const totalLetters = wordGroups.reduce((a, b) => a + b, 0);

  const getPNTileColor = (state: PNTileState) => {
    switch (state) {
      case 'correct': return 'tile-correct';
      case 'present': return 'tile-present';
      case 'absent': return 'tile-absent';
      default: return 'bg-white border-gray-300';
    }
  };

  return (
    <div className="grid gap-[2px]" style={{ gridTemplateRows: `repeat(${maxGuesses}, 1fr)` }}>
      {Array.from({ length: maxGuesses }).map((_, rowIndex) => {
        const guess = guesses[rowIndex];
        const isPast = rowIndex < guesses.length;

        let letterIdx = 0;
        return (
          <div key={rowIndex} className="flex items-center justify-center gap-[6px]">
            {wordGroups.map((groupLen, gi) => {
              const groupTiles = [];
              for (let ti = 0; ti < groupLen; ti++) {
                const idx = letterIdx++;
                const letter = isPast && guess ? (guess.word[idx] || '') : '';
                const tileState = isPast && guess && guess.tiles[idx] ? guess.tiles[idx] : 'empty';
                groupTiles.push(
                  <div
                    key={`${gi}-${ti}`}
                    className={`flex items-center justify-center border rounded text-[6px] font-bold leading-none ${
                      tileState === 'empty' ? 'text-gray-800' : 'text-white'
                    } ${getPNTileColor(tileState)}`}
                    style={{
                      width: `${Math.min(16, Math.floor(200 / totalLetters))}px`,
                      aspectRatio: '1',
                    }}
                  >
                    {letter.toUpperCase()}
                  </div>
                );
              }
              return (
                <div key={gi} className="flex gap-[1px]">
                  {groupTiles}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function GauntletCompletedCard({
  won, stages, stageResults, stagesCleared, totalGuesses, totalTimeMs,
}: {
  won: boolean;
  stages: GauntletStageConfig[];
  stageResults: GauntletStageResult[];
  stagesCleared: number;
  totalGuesses: number;
  totalTimeMs: number;
}) {
  const [expandedStage, setExpandedStage] = useState<number | null>(null);

  const fmtTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  // Cumulative boards solved across all stages (cleared stage = full boardCount,
  // failed stage = its WON snapshot count); denominator = every stage's boards.
  const cumulativeBoardsSolved = stageResults.reduce((sum, r) => {
    const stage = stages.find(s => s.stageIndex === r.stageIndex);
    if (!stage) return sum;
    if (r.status === GameStatus.WON) return sum + stage.boardCount;
    return sum + (r.boardsSnapshot?.filter(b => b.status === GameStatus.WON).length ?? 0);
  }, 0);
  const cumulativeTotalBoards = Math.max(1, stages.reduce((sum, s) => sum + s.boardCount, 0));

  return (
    <CollapsibleCompletedCard
      won={won}
      summaryLabel={`${stagesCleared}/5 · ${totalGuesses}g · ${fmtTime(totalTimeMs)}`}
    >
      {/* Summary stats */}
      <div className="flex justify-center gap-5 mb-3">
        <div className="text-center">
          <div className="text-sm font-black" style={{ color: 'var(--color-text)' }}>
            {stagesCleared}/5
          </div>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Stages
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm font-black" style={{ color: 'var(--color-text)' }}>
            {totalGuesses}
          </div>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Guesses
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm font-black" style={{ color: 'var(--color-text)' }}>
            {fmtTime(totalTimeMs)}
          </div>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Time
          </div>
        </div>
      </div>

      {/* Compact stage rows */}
      <div className="space-y-1">
        {stages.map((stage, i) => {
          const result = stageResults.find(r => r.stageIndex === i);
          if (!result) return null;
          const stageWon = result.status === GameStatus.WON;
          const hasBoards = !!result.boardsSnapshot?.length;
          const isExpanded = expandedStage === i;

          return (
            <div key={i}>
              <button
                type="button"
                onClick={() => hasBoards && setExpandedStage(isExpanded ? null : i)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors"
                style={{
                  background: stageWon ? '#f5f3ff' : '#fef2f2',
                  border: `1px solid ${stageWon ? '#ddd6fe' : '#fecaca'}`,
                  cursor: hasBoards ? 'pointer' : 'default',
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black"
                    style={{
                      background: stageWon ? '#f5f3ff' : '#fee2e2',
                      color: stageWon ? '#7c3aed' : '#dc2626',
                    }}
                  >
                    {stageWon ? '✓' : '✗'}
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: 'var(--color-text)' }}>
                    {stage.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                    {result.guesses}g · {fmtTime(result.timeMs)}
                  </span>
                  {hasBoards && (
                    <span
                      className="text-[8px] transition-transform"
                      style={{
                        color: 'var(--color-text-muted)',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    >
                      ▼
                    </span>
                  )}
                </div>
              </button>
              {isExpanded && hasBoards && (
                <div className="px-1 pt-1.5 pb-1">
                  <GauntletStageMiniBoards
                    boards={result.boardsSnapshot!}
                    maxGuesses={stage.maxGuesses}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Score breakdown — cumulative run values, matching the native
          completed-today card (iOS/Android) and the post-game results. */}
      <div className="mt-3">
        <ScoreBreakdownCard
          gameMode="GAUNTLET"
          completed={won}
          guessCount={totalGuesses}
          timeSeconds={Math.floor(totalTimeMs / 1000)}
          boardsSolved={cumulativeBoardsSolved}
          totalBoards={cumulativeTotalBoards}
        />
      </div>
    </CollapsibleCompletedCard>
  );
}

function GauntletStageMiniBoards({ boards, maxGuesses }: { boards: BoardState[]; maxGuesses: number }) {
  const n = boards.length;
  // Fixed tile size keeps every board the same height (crisp, uniform) and
  // scales down as the board count grows so the row still fits.
  const tileSize = n === 1 ? 22 : n <= 4 ? 16 : 11;
  const maxW = n === 1 ? '160px' : n <= 4 ? '240px' : '320px';
  return (
    <div className="mx-auto flex flex-wrap justify-center gap-1.5 pt-2" style={{ maxWidth: maxW }}>
      {boards.map((board, i) => (
        <CompletedMiniBoard
          key={i}
          solution={board.solution}
          guesses={board.guesses}
          maxGuesses={maxGuesses}
          won={board.status === GameStatus.WON}
          tileSize={tileSize}
        />
      ))}
    </div>
  );
}

export function CompletedDailyBoard({ modeId }: CompletedDailyBoardProps) {
  ensureDictionaryInitialized();

  const isGauntlet = modeId === 'GAUNTLET';
  const isProperNoundle = modeId === 'PROPERNOUNDLE';

  const localSession = useMemo(
    () => (!isProperNoundle ? loadCompletedSession(modeId) : null),
    [modeId, isProperNoundle],
  );
  // Cross-device: a daily finished on another device (e.g. the native app) has
  // no local session, so this card used to render nothing for non-gauntlet
  // modes. Reconstruct the boards from the recorded matches row (same engine
  // replay the game pages use) so "Completed Today" shows everywhere. Gauntlet
  // has its own server fallback below; ProperNoundle is handled separately.
  const [serverSession, setServerSession] = useState<{ state: GameState; elapsedTime: number } | null>(null);
  const session = localSession ?? serverSession;
  const pnSaved = useMemo(() => isProperNoundle ? loadCompletedProperNoundle() : null, [isProperNoundle]);
  const pnPuzzle = useMemo(() => isProperNoundle ? getDailyPuzzle() : null, [isProperNoundle]);

  const boards = session?.state.boards ?? [];
  const solution = boards[0]?.solution || null;

  const evaluations = useMemo(() => {
    if (!session || !solution || MULTI_BOARD_MODES.has(modeId) || isGauntlet) return [];
    const board = boards[0];
    return board.guesses.map((g, i) => {
      // Use stored hint evaluation for hint rows (Six/Seven)
      if (board.hintEvaluations?.[i]) return board.hintEvaluations[i];
      return evaluateGuess(solution, g);
    });
  }, [session, solution, modeId, isGauntlet]);

  const { definition, loaded: defLoaded } = useWordDefinition(
    (MULTI_BOARD_MODES.has(modeId) || isProperNoundle || isGauntlet) ? null : solution
  );

  // Gauntlet played on another device has no local session — pull the per-stage
  // breakdown from the server (matches.gauntlet_stages) so the card still renders.
  const { profile } = useAuth();
  // The recorded daily_results row (same source the leaderboard renders from).
  // Using its time/guess values keeps this card EXACTLY in sync with the
  // leaderboard row — the local session timer can drift ~1s from what was
  // recorded, which otherwise made the time + score disagree.
  const { todayDailies } = useDailyCompletions();
  const recorded = todayDailies.get(modeId);
  const [serverGauntlet, setServerGauntlet] = useState<
    { stages: GauntletStageConfig[]; stageResults: GauntletStageResult[]; won: boolean; totalTimeMs: number } | null
  >(null);
  useEffect(() => {
    if (!isGauntlet || session || !profile) return;
    let cancelled = false;
    fetchGauntletStages(profile.id, generateDailySeed(getTodayLocal(), 'GAUNTLET'))
      .then(r => { if (!cancelled && r) setServerGauntlet(r); });
    return () => { cancelled = true; };
  }, [isGauntlet, session, profile]);

  // Non-gauntlet cross-device fallback: no local session but a recorded daily
  // result exists → replay the matches row through the engine so the card
  // renders (same path useServerDailyReplay uses for the game pages).
  useEffect(() => {
    if (isGauntlet || isProperNoundle || localSession || !profile || !recorded) return;
    let cancelled = false;
    const seed = generateDailySeed(getTodayLocal(), modeId);
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from('matches')
          .select('player1_guesses, player1_time')
          .eq('player1_id', profile.id)
          .eq('seed', seed)
          .order('created_at', { ascending: false })
          .limit(1);
        const row = data?.[0];
        if (cancelled || !row) return;
        const guesses: string[] = Array.isArray(row.player1_guesses) ? row.player1_guesses : [];
        if (guesses.length === 0) return;
        const state = replayRecordedGuesses(modeId as GameMode, seed, guesses);
        if (cancelled || !state) return;
        setServerSession({ state, elapsedTime: Math.max(0, Math.round(Number(row.player1_time) || 0)) });
      } catch { /* offline / RLS — leave the card hidden, no worse than before */ }
    })();
    return () => { cancelled = true; };
  }, [isGauntlet, isProperNoundle, localSession, profile, recorded, modeId]);

  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  // Gauntlet path — prefer the local session; otherwise use the server-persisted
  // stage breakdown (cross-device). Returns null only when neither is available.
  if (isGauntlet) {
    const localGauntlet = session?.state.gauntlet ?? null;
    const stages = localGauntlet?.stages ?? serverGauntlet?.stages ?? null;
    const stageResults = localGauntlet?.stageResults ?? serverGauntlet?.stageResults ?? null;
    if (!stages || !stageResults) return null;
    const won = session ? session.state.status === 'WON' : (serverGauntlet?.won ?? false);
    const totalTimeMs = session ? session.elapsedTime * 1000 : (serverGauntlet?.totalTimeMs ?? 0);
    return (
      <GauntletCompletedCard
        won={won}
        stages={stages}
        stageResults={stageResults}
        stagesCleared={stageResults.filter(r => r.status === GameStatus.WON).length}
        totalGuesses={stageResults.reduce((sum, r) => sum + r.guesses, 0)}
        totalTimeMs={totalTimeMs}
      />
    );
  }

  // ProperNoundle path
  if (isProperNoundle) {
    if (!pnSaved || !pnPuzzle) return null;
    if (pnSaved.puzzleId !== pnPuzzle.id) return null;

    const pnWon = pnSaved.gameStatus === 'won';
    // ProperNoundle has three independent hint actions (clue / vowel /
    // consonant); count whichever were used so the summary matches the
    // leaderboard's hint column.
    const pnHints =
      (pnSaved.hintState?.hintUsed ? 1 : 0) +
      (pnSaved.hintState?.vowelUsed ? 1 : 0) +
      (pnSaved.hintState?.consonantUsed ? 1 : 0);
    const pnHintLabel = formatHintsLabel('PROPERNOUNDLE', pnHints);
    // Match the leaderboard row (recorded daily_results), not the local timer.
    const pnTime = recorded?.timeSeconds ?? pnSaved.elapsedTime;
    const pnGuesses = recorded?.guesses ?? pnSaved.guesses.length;

    return (
      <CollapsibleCompletedCard
        won={pnWon}
        summaryLabel={`${pnGuesses}/6 · ${formatTime(pnTime)}${pnHintLabel ? ` · ${pnHintLabel}` : ''}`}
      >
        {/* Compact ProperNoundle board */}
        <div className="mx-auto" style={{ maxWidth: '240px' }}>
          <CompletedProperNoundleMiniBoard
            guesses={pnSaved.guesses}
            maxGuesses={6}
            answerDisplay={pnPuzzle.display}
          />
        </div>

        {/* Answer display */}
        <div className="text-center mt-3">
          <div className="text-lg font-black tracking-wider" style={{ color: 'var(--color-text)' }}>
            {pnPuzzle.display.toUpperCase()}
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-5 mt-3">
          <div className="text-center">
            <div className="text-sm font-black" style={{ color: 'var(--color-text)' }}>
              {pnGuesses}/6
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Guesses
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-black" style={{ color: 'var(--color-text)' }}>
              {formatTime(pnTime)}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Time
            </div>
          </div>
        </div>
        <ScoreBreakdownCard
          gameMode="PROPERNOUNDLE"
          completed={pnWon}
          guessCount={pnGuesses}
          timeSeconds={pnTime}
          boardsSolved={pnWon ? 1 : 0}
          totalBoards={1}
          hintsUsed={pnHints}
        />
      </CollapsibleCompletedCard>
    );
  }

  // Standard modes
  if (!session) return null;

  const won = session.state.status === 'WON';

  const isMulti = MULTI_BOARD_MODES.has(modeId);
  const boardsSolved = boards.filter(b => b.status === GameStatus.WON).length;
  const totalBoards = boards.length;
  const totalGuesses = boards.reduce((sum, b) => sum + b.guesses.length, 0);

  // Prefer the recorded daily_results values (exactly what the leaderboard row
  // shows) over the local session — the live timer can drift ~1s from what was
  // recorded, and multi-board guess_count is the turn count, not the per-board
  // sum. Falls back to local session until the recorded row loads.
  const displayTime = recorded?.timeSeconds ?? session.elapsedTime;
  const displayGuesses = recorded?.guesses ?? (isMulti ? totalGuesses : (boards[0]?.guesses.length ?? 0));

  const singleMaxGuesses = boards[0]?.maxGuesses ?? 6;
  // Six/Seven store each hint as a row in board.hintEvaluations, so the
  // key count is the number of hints the player burned. Surfaced in the
  // summary for hint-bearing modes so it lines up with the leaderboard.
  const singleHints = Object.keys(boards[0]?.hintEvaluations ?? {}).length;
  const singleHintLabel = formatHintsLabel(modeId, singleHints);
  const summaryLabel = isMulti
    ? `${boardsSolved}/${totalBoards} · ${displayGuesses}g · ${formatTime(displayTime)}`
    : `${displayGuesses}/${singleMaxGuesses} · ${formatTime(displayTime)}${singleHintLabel ? ` · ${singleHintLabel}` : ''}`;

  return (
    <CollapsibleCompletedCard won={won} summaryLabel={summaryLabel}>
      {isMulti ? (
        /* ── Multi-board compact grid ── */
        <>
          <div
            className="mx-auto flex flex-wrap justify-center gap-2 pt-2"
            style={{ maxWidth: totalBoards > 4 ? 'min(320px, 100%)' : '240px' }}
          >
            {boards.map((board, i) => (
              <CompletedMiniBoard
                key={i}
                solution={board.solution}
                guesses={board.guesses}
                maxGuesses={board.maxGuesses}
                won={board.status === GameStatus.WON}
                tileSize={totalBoards > 4 ? 12 : 20}
              />
            ))}
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-5 mt-3">
            <div className="text-center">
              <div className="text-sm font-black" style={{ color: 'var(--color-text)' }}>
                {boardsSolved}/{totalBoards}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Boards
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm font-black" style={{ color: 'var(--color-text)' }}>
                {displayGuesses}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Guesses
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm font-black" style={{ color: 'var(--color-text)' }}>
                {formatTime(displayTime)}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Time
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ── Single-board (Classic) ── */
        <>
          {/* Compact board */}
          <div className="mx-auto" style={{ maxWidth: '200px' }}>
            <Board
              guesses={boards[0]?.guesses ?? []}
              currentGuess=""
              maxGuesses={singleMaxGuesses}
              evaluations={evaluations}
              showSolution={false}
              solution={solution!}
              darkMode
              wordLength={solution!.length}
            />
          </div>

          {/* Solution + Definition */}
          <div className="text-center mt-3">
            <div className="text-lg font-black tracking-wider" style={{ color: 'var(--color-text)' }}>
              {solution!.toUpperCase()}
            </div>
            {defLoaded && (
              <div
                className="mt-2 mx-auto px-3 py-2 text-left"
                style={{
                  background: 'var(--color-bg)',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border)',
                  maxWidth: '320px',
                }}
              >
                {definition ? (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      {definition.phonetic && (
                        <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                          {definition.phonetic}
                        </span>
                      )}
                      {definition.partOfSpeech && (
                        <span
                          className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--color-border)', color: '#a78bfa' }}
                        >
                          {definition.partOfSpeech}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium mt-1 leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
                      {definition.definition}
                    </p>
                  </>
                ) : (
                  <p className="text-xs font-medium italic" style={{ color: 'var(--color-text-muted)' }}>
                    No definition available for this word.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-5 mt-3">
            <div className="text-center">
              <div className="text-sm font-black" style={{ color: 'var(--color-text)' }}>
                {displayGuesses}/{singleMaxGuesses}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Guesses
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm font-black" style={{ color: 'var(--color-text)' }}>
                {formatTime(displayTime)}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Time
              </div>
            </div>
          </div>
        </>
      )}
      {/* Full score breakdown (same card as post-game) below the stats. */}
      <ScoreBreakdownCard
        gameMode={modeId}
        completed={won}
        guessCount={displayGuesses}
        timeSeconds={displayTime}
        boardsSolved={boardsSolved}
        totalBoards={totalBoards}
        hintsUsed={singleHints}
      />
    </CollapsibleCompletedCard>
  );
}
