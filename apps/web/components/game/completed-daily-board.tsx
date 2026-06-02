'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { evaluateGuess, TileState, GameStatus, BoardState } from '@wordle-duel/core';
import type { GauntletProgress, GauntletStageConfig, GauntletStageResult } from '@wordle-duel/core';
import { Board } from '@/components/game/board';
import { useWordDefinition } from '@/hooks/use-word-definition';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';
import { getTodayLocal, formatHintsLabel } from '@/lib/daily-service';
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
            ? 'linear-gradient(90deg, #22c55e, #4ade80)'
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
              background: won ? '#dcfce7' : '#fee2e2',
              color: won ? '#16a34a' : '#dc2626',
            }}
          >
            {won ? '✓' : '✗'}
          </span>
          <span
            className="text-[10px] font-extrabold uppercase tracking-wider"
            style={{ color: won ? '#22c55e' : 'var(--color-text-muted)' }}
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
    case TileState.CORRECT: return 'bg-green-500 border-green-500';
    case TileState.PRESENT: return 'bg-yellow-500 border-yellow-500';
    case TileState.ABSENT: return 'bg-gray-500 border-gray-500';
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
function CompletedMiniBoard({ solution, guesses, maxGuesses, won, hintEvaluations }: {
  solution: string;
  guesses: string[];
  maxGuesses: number;
  hintEvaluations?: Record<number, import('@wordle-duel/core').GuessResult>;
  won: boolean;
}) {
  return (
    <div className={`relative min-w-0 p-0.5 rounded-lg border-2 ${
      won ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'
    }`}>
      {won && (
        <div className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center z-10">
          ✓
        </div>
      )}
      {/* min-w-0 / min-h-0 at every grid level: grid items default to
          min-width:auto, which lets the aspectRatio tiles size from height and
          overflow their column on some layout passes — the cause of the
          intermittent "boards blow up and clip on re-render" bug. */}
      <div className="grid gap-[1px] min-w-0" style={{ gridTemplateRows: `repeat(${maxGuesses}, minmax(0, auto))` }}>
        {Array.from({ length: maxGuesses }).map((_, rowIndex) => {
          const guess = guesses[rowIndex] || '';
          const isPast = rowIndex < guesses.length;
          const wordLen = solution.length;
          const tiles = isPast
            ? (hintEvaluations?.[rowIndex]
                ? hintEvaluations[rowIndex].tiles.map(t => t.state)
                : evaluateGuessTiles(guess, solution))
            : Array(wordLen).fill(TileState.EMPTY);

          return (
            <div key={rowIndex} className="grid gap-[1px] min-w-0" style={{ gridTemplateColumns: `repeat(${wordLen}, minmax(0, 1fr))` }}>
              {Array.from({ length: wordLen }).map((_, li) => {
                const letter = guess[li] || '';
                const tileState = isPast ? tiles[li] : TileState.EMPTY;
                return (
                  <div
                    key={li}
                    className={`flex items-center justify-center border rounded text-[7px] font-bold leading-none min-w-0 min-h-0 ${
                      tileState === TileState.EMPTY ? 'text-gray-800' : 'text-white'
                    } ${getTileColor(tileState)}`}
                    style={{ aspectRatio: '1' }}
                  >
                    {letter.toUpperCase()}
                  </div>
                );
              })}
            </div>
          );
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
      case 'correct': return 'bg-green-500 border-green-500';
      case 'present': return 'bg-yellow-500 border-yellow-500';
      case 'absent': return 'bg-gray-500 border-gray-500';
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
                  background: stageWon ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${stageWon ? '#bbf7d0' : '#fecaca'}`,
                  cursor: hasBoards ? 'pointer' : 'default',
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black"
                    style={{
                      background: stageWon ? '#dcfce7' : '#fee2e2',
                      color: stageWon ? '#16a34a' : '#dc2626',
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
    </CollapsibleCompletedCard>
  );
}

function GauntletStageMiniBoards({ boards, maxGuesses }: { boards: BoardState[]; maxGuesses: number }) {
  const n = boards.length;
  const gridCols = n === 1 ? 'grid-cols-1' : n <= 4 ? 'grid-cols-2' : 'grid-cols-4';
  // Single-board stages need a max-width so the mini board doesn't
  // stretch to full width and render enormous tiles.
  const maxW = n === 1 ? '140px' : n <= 4 ? '240px' : undefined;
  return (
    <div className={`mx-auto grid ${gridCols} gap-1`} style={maxW ? { maxWidth: maxW } : undefined}>
      {boards.map((board, i) => (
        <CompletedMiniBoard
          key={i}
          solution={board.solution}
          guesses={board.guesses}
          maxGuesses={maxGuesses}
          won={board.status === GameStatus.WON}
        />
      ))}
    </div>
  );
}

export function CompletedDailyBoard({ modeId }: CompletedDailyBoardProps) {
  ensureDictionaryInitialized();

  const isGauntlet = modeId === 'GAUNTLET';
  const isProperNoundle = modeId === 'PROPERNOUNDLE';

  const session = useMemo(
    () => (!isProperNoundle ? loadCompletedSession(modeId) : null),
    [modeId, isProperNoundle],
  );
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

  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  // Gauntlet path
  if (isGauntlet) {
    if (!session) return null;
    const gauntlet = session.state.gauntlet;
    if (!gauntlet) return null;

    const stageResults = gauntlet.stageResults;
    return (
      <GauntletCompletedCard
        won={session.state.status === 'WON'}
        stages={gauntlet.stages}
        stageResults={stageResults}
        stagesCleared={stageResults.filter(r => r.status === GameStatus.WON).length}
        totalGuesses={stageResults.reduce((sum, r) => sum + r.guesses, 0)}
        totalTimeMs={session.elapsedTime * 1000}
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

    return (
      <CollapsibleCompletedCard
        won={pnWon}
        summaryLabel={`${pnSaved.guesses.length}/6 · ${formatTime(pnSaved.elapsedTime)}${pnHintLabel ? ` · ${pnHintLabel}` : ''}`}
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
              {pnSaved.guesses.length}/6
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Guesses
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-black" style={{ color: 'var(--color-text)' }}>
              {formatTime(pnSaved.elapsedTime)}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Time
            </div>
          </div>
        </div>
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

  const singleMaxGuesses = boards[0]?.maxGuesses ?? 6;
  // Six/Seven store each hint as a row in board.hintEvaluations, so the
  // key count is the number of hints the player burned. Surfaced in the
  // summary for hint-bearing modes so it lines up with the leaderboard.
  const singleHints = Object.keys(boards[0]?.hintEvaluations ?? {}).length;
  const singleHintLabel = formatHintsLabel(modeId, singleHints);
  const summaryLabel = isMulti
    ? `${boardsSolved}/${totalBoards} · ${totalGuesses}g · ${formatTime(session.elapsedTime)}`
    : `${(boards[0]?.guesses.length ?? 0)}/${singleMaxGuesses} · ${formatTime(session.elapsedTime)}${singleHintLabel ? ` · ${singleHintLabel}` : ''}`;

  return (
    <CollapsibleCompletedCard won={won} summaryLabel={summaryLabel}>
      {isMulti ? (
        /* ── Multi-board compact grid ── */
        <>
          <div
            className={`mx-auto grid gap-2 ${totalBoards > 4 ? 'grid-cols-4' : 'grid-cols-2'}`}
            style={{ maxWidth: totalBoards > 4 ? 'min(320px, 100%)' : '240px' }}
          >
            {boards.map((board, i) => (
              <CompletedMiniBoard
                key={i}
                solution={board.solution}
                guesses={board.guesses}
                maxGuesses={board.maxGuesses}
                won={board.status === GameStatus.WON}
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
                {totalGuesses}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Guesses
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm font-black" style={{ color: 'var(--color-text)' }}>
                {formatTime(session.elapsedTime)}
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
                {(boards[0]?.guesses.length ?? 0)}/{singleMaxGuesses}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Guesses
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm font-black" style={{ color: 'var(--color-text)' }}>
                {formatTime(session.elapsedTime)}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Time
              </div>
            </div>
          </div>
        </>
      )}
    </CollapsibleCompletedCard>
  );
}
