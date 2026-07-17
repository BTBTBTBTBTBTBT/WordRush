'use client';

import { useMemo, useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { evaluateGuess, GameStatus, BoardState, generateDailySeed, type GameState, type GameMode } from '@wordle-duel/core';
import type { GauntletProgress, GauntletStageConfig, GauntletStageResult } from '@wordle-duel/core';
import { replayRecordedGuesses } from '@/hooks/use-game-snapshot';
import { supabase } from '@/lib/supabase-client';
import { Board } from '@/components/game/board';
import { CompletedMiniBoard, GauntletStageBreakdown } from '@/components/game/completed-mini-board';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { useWordDefinition } from '@/hooks/use-word-definition';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';
import { getTodayLocal, formatHintsLabel } from '@/lib/daily-service';
import { useAuth } from '@/lib/auth-context';
import { useDailyCompletions } from '@/lib/daily-completions-context';
import { fetchGauntletStages } from '@/lib/stats-service';
import { getDailyPuzzle } from '@/components/propernoundle/puzzle-service';
import { normalizeString, checkWin as pnCheckWin } from '@/components/propernoundle/game-logic';
import type { Guess as ProperNoundleGuess, TileState as PNTileState } from '@/components/propernoundle/types';
import { rebuildPNRow, PN_PLACEHOLDER } from '@/components/propernoundle/reconstruct';

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

// CompletedMiniBoard (compact fixed-tile mini board) lives in
// completed-mini-board.tsx so the post-game + VS result recaps share it.

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
      // Hint rows: same grey as the in-game NoundleBoard (#e5e7eb/#d1d5db) —
      // without this they fell through to the white "empty" style and a hint
      // row was indistinguishable from an unplayed one.
      case 'hint-used': return 'bg-gray-200 border-gray-300';
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
                const raw = isPast && guess ? (guess.word[idx] || '') : '';
                // Placeholders hold a hint row's unrevealed slots — render the
                // tile, never the ' '/'_' character itself.
                const letter = PN_PLACEHOLDER.test(raw) ? '' : raw;
                const tileState = isPast && guess && guess.tiles[idx] ? guess.tiles[idx] : 'empty';
                groupTiles.push(
                  <div
                    key={`${gi}-${ti}`}
                    className={`flex items-center justify-center border rounded text-[6px] font-bold leading-none ${
                      tileState === 'empty' || tileState === 'hint-used' ? 'text-gray-800' : 'text-white'
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
      {/* Summary stats + per-stage rows (shared with the VS result screen). */}
      <GauntletStageBreakdown
        stages={stages}
        stageResults={stageResults}
        stagesCleared={stagesCleared}
        totalGuesses={totalGuesses}
        totalTimeMs={totalTimeMs}
      />

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
          stagesCompleted={stagesCleared}
          day={getTodayLocal()}
        />
      </div>
    </CollapsibleCompletedCard>
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
  // ProperNoundle cross-device: a daily finished on the native app (or another
  // browser) has no local save, so this card used to render nothing. Reconstruct
  // the guesses from the recorded matches row — same fallback the standard modes
  // already have — so "Completed Today" shows the real board everywhere.
  const [pnServerGuesses, setPnServerGuesses] = useState<ProperNoundleGuess[] | null>(null);

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

  // Display guesses for the single-board render. For HINT rows the letter is
  // taken from the evaluation tiles (letter + state travel together) rather
  // than the stored guess string — some recorded hint rows stored the revealed
  // letter left-aligned ("A     ") while the evaluation was positioned, which
  // rendered the letter at slot 0 in gray instead of its real slot in purple.
  // Board pairs guess[i] (letter) with evaluations[i].state, so they MUST align.
  const singleDisplayGuesses = useMemo(() => {
    if (!session || !solution || MULTI_BOARD_MODES.has(modeId) || isGauntlet) return [] as string[];
    const board = boards[0];
    return board.guesses.map((g, i) => {
      const he = board.hintEvaluations?.[i];
      return he ? he.tiles.map(t => (t.letter && t.letter !== ' ' ? t.letter : ' ')).join('') : g;
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
    // Clear any reconstruction from a previously-selected mode FIRST, so when
    // the new mode has no session we render nothing — never the prior mode's
    // board under the new mode's header (the "everything shows Classic" bug).
    setServerSession(null);
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

  // ProperNoundle cross-device fallback: no valid local save but a recorded daily
  // result exists → pull player1_guesses from the matches row and re-derive the
  // tiles against today's answer, so the card renders the real completed board.
  useEffect(() => {
    setPnServerGuesses(null);
    const localValid = !!pnSaved && !!pnPuzzle && pnSaved.puzzleId === pnPuzzle.id;
    if (!isProperNoundle || !pnPuzzle || localValid || !profile || !recorded) return;
    let cancelled = false;
    const seed = generateDailySeed(getTodayLocal(), 'PROPERNOUNDLE');
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from('matches')
          .select('player1_guesses')
          .eq('player1_id', profile.id)
          .eq('seed', seed)
          .order('created_at', { ascending: false })
          .limit(1);
        const row = data?.[0];
        if (cancelled || !row) return;
        const words: string[] = Array.isArray(row.player1_guesses) ? row.player1_guesses : [];
        if (words.length === 0) return;
        const rebuilt: ProperNoundleGuess[] = words.map((w) => rebuildPNRow(w, pnPuzzle.answer));
        if (!cancelled) setPnServerGuesses(rebuilt);
      } catch { /* offline / RLS — leave the card hidden, no worse than before */ }
    })();
    return () => { cancelled = true; };
  }, [isProperNoundle, pnPuzzle, profile, recorded, pnSaved]);

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
    if (!pnPuzzle) return null;
    // Prefer the local save (full hint detail); fall back to the cross-device
    // reconstruction from the matches row so the card shows everywhere.
    const localValid = !!pnSaved && pnSaved.puzzleId === pnPuzzle.id;
    const pnGuessRows: ProperNoundleGuess[] | null = localValid
      ? pnSaved!.guesses
      : pnServerGuesses;
    if (!pnGuessRows || pnGuessRows.length === 0) return null;

    // Won = the final row is all-correct (works for both the local save and the
    // reconstructed rows); the recorded daily_results.won wins when present.
    const lastRow = pnGuessRows[pnGuessRows.length - 1];
    const pnWon = localValid
      ? pnSaved!.gameStatus === 'won'
      : (recorded?.won ?? (lastRow ? pnCheckWin(lastRow.tiles) : false));
    // ProperNoundle has three independent hint actions (clue / vowel /
    // consonant); count whichever were used so the summary matches the
    // leaderboard's hint column. Hint detail only exists in the local save.
    // On the reconstruction path there's no hintState, but hint rows are still
    // identifiable: the evaluator only ever emits correct/present/absent, so a
    // 'hint-used' tile can only come from a hint row (clue, vowel, or
    // consonant — one row each, matching the local count's semantics). Deriving
    // it stops a cross-device card from claiming "No hints — full credit" over
    // a board that visibly shows hint rows.
    const pnHints = localValid
      ? (pnSaved!.hintState?.hintUsed ? 1 : 0) +
        (pnSaved!.hintState?.vowelUsed ? 1 : 0) +
        (pnSaved!.hintState?.consonantUsed ? 1 : 0)
      : pnGuessRows.filter(g => g.tiles.some(t => t === 'hint-used')).length;
    const pnHintLabel = formatHintsLabel('PROPERNOUNDLE', pnHints);
    // Match the leaderboard row (recorded daily_results), not the local timer.
    const pnTime = recorded?.timeSeconds ?? (localValid ? pnSaved!.elapsedTime : 0);
    const pnGuesses = recorded?.guesses ?? pnGuessRows.length;
    // Near-miss credit on a loss: most green tiles in any guess ('hint-used'
    // tiles are not 'correct', so they don't inflate it).
    const pnBestCorrect = pnGuessRows.reduce((best, g) => Math.max(best, g.tiles.filter(t => t === 'correct').length), 0);

    return (
      <CollapsibleCompletedCard
        won={pnWon}
        summaryLabel={`${pnGuesses}/6 · ${formatTime(pnTime)}${pnHintLabel ? ` · ${pnHintLabel}` : ''}`}
      >
        {/* Compact ProperNoundle board */}
        <div className="mx-auto" style={{ maxWidth: '240px' }}>
          <CompletedProperNoundleMiniBoard
            guesses={pnGuessRows}
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
          bestCorrectLetters={pnBestCorrect}
          day={getTodayLocal()}
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
  // Turn count = MAX across boards (shared submissions apply to every board) —
  // the same semantics every recorder and the native cards use. A per-board
  // SUM here read ~60g for an OctoWord day whenever the recorded row hadn't
  // loaded, where iOS/Android read 9g.
  const totalGuesses = boards.reduce((mx, b) => Math.max(mx, b.guesses.length), 0);

  // Prefer the recorded daily_results values (exactly what the leaderboard row
  // shows) over the local session — the live timer can drift ~1s from what was
  // recorded. Falls back to local session until the recorded row loads.
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
              guesses={singleDisplayGuesses}
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
        // Single-board near-miss credit on a loss: best green count from the
        // reconstructed grid (empty / 0 for multi-board modes, which ignore it).
        bestCorrectLetters={evaluations.reduce((best, e, i) =>
          boards[0]?.hintEvaluations?.[i] ? best : Math.max(best, e.tiles.filter(t => t.state === 'CORRECT').length), 0)}
        day={getTodayLocal()}
      />
    </CollapsibleCompletedCard>
  );
}
