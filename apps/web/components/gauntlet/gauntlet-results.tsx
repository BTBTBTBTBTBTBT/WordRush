'use client';

import { useEffect, useState, useCallback } from 'react';
import { Trophy, XCircle, Clock, Hash, Eye, X, ChevronRight } from 'lucide-react';
import { BoardState, evaluateGuess, GameStatus, GauntletStageConfig, GauntletStageResult, TileState } from '@wordle-duel/core';
import { recordGauntletGame } from '@/lib/gauntlet-stats';
import { shareResult } from '@/lib/share-utils';
import { DailyRankBadge } from '@/components/game/daily-rank-badge';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { NextDailyCta } from '@/components/game/next-daily-cta';

interface GauntletResultsProps {
  won: boolean;
  stages: GauntletStageConfig[];
  stageResults: GauntletStageResult[];
  totalTimeMs: number;
  onPlayAgain: () => void;
  onHome: () => void;
  showPlayAgain?: boolean;
  isDaily?: boolean;
  /** Whether to record this run into local gauntlet-stats on mount. False when
   *  showing a cross-device revisit (the run wasn't played on this device, so
   *  re-recording would inflate the local games-played count). */
  recordOnMount?: boolean;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

export function GauntletResults({
  won,
  stages,
  stageResults,
  totalTimeMs,
  onPlayAgain,
  onHome,
  showPlayAgain = true,
  isDaily,
  recordOnMount = true,
}: GauntletResultsProps) {
  const totalGuesses = stageResults.reduce((sum, r) => sum + r.guesses, 0);
  const stagesCompleted = stageResults.filter(r => r.status === GameStatus.WON).length;
  // Same cross-stage tally that gauntlet-game.tsx passes to
  // recordGameResult, so the breakdown card's composite score matches
  // the leaderboard value exactly.
  const cumulativeBoardsSolved = stageResults.reduce((sum, r) => {
    const stage = stages[r.stageIndex];
    if (!stage) return sum;
    if (r.status === GameStatus.WON) return sum + stage.boardCount;
    return sum + (r.boardsSnapshot?.filter(b => b.status === GameStatus.WON).length ?? 0);
  }, 0);
  const cumulativeTotalBoards = stages.reduce((sum, s) => sum + s.boardCount, 0) || 21;
  const [copied, setCopied] = useState(false);
  // Stage index currently being reviewed in the modal — null = closed.
  // Drives the "Review" modal that surfaces each stage's final board
  // state so a losing player can see exactly what word(s) they missed,
  // and a winning player can re-check the answers.
  const [reviewStageIndex, setReviewStageIndex] = useState<number | null>(null);
  const reviewStage = reviewStageIndex !== null ? stages[reviewStageIndex] : null;
  const reviewResult = reviewStageIndex !== null ? stageResults.find(r => r.stageIndex === reviewStageIndex) : null;

  const handleShare = useCallback(async () => {
    // Map each stage config to a stageResult if one exists; stages the
    // player never reached render as "unplayed" (treated as LOST in the
    // image so they visually distinguish from the cleared ones).
    const stagesForImage = stages.map((stage, i) => {
      const result = stageResults.find(r => r.stageIndex === i);
      // A cleared stage trivially solved every board. A failed stage
      // may still have partial credit — e.g. QuadWord where the player
      // solved 3 of 4 before running out of guesses. Read the exact
      // count from the snapshot we capture at stage end instead of
      // falling back to 0, which misrepresented the run and showed
      // "0/4 boards" on a stage where the player actually beat 3.
      // The leaderboard score mirrors this: a Gauntlet loss earns a
      // stage-depth ladder for each fully-cleared stage plus a small
      // per-board credit for boards solved in the failed stage
      // (see computeScoreBreakdown in lib/daily-service.ts).
      const boardsSolved = result?.status === GameStatus.WON
        ? stage.boardCount
        : result?.boardsSnapshot?.filter(b => b.status === GameStatus.WON).length ?? 0;
      return {
        name: stage.name,
        status: result?.status ?? GameStatus.LOST,
        guesses: result?.guesses ?? 0,
        boardsSolved,
        totalBoards: stage.boardCount,
      };
    });
    const out = await shareResult({
      layout: 'gauntlet',
      mode: 'Gauntlet',
      won,
      guesses: totalGuesses,
      maxGuesses: totalGuesses,
      timeSeconds: Math.floor(totalTimeMs / 1000),
      stages: stagesForImage,
      stagesCompleted,
      totalStages: stages.length,
    });
    if (out.via !== 'failed') { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }, [won, totalGuesses, totalTimeMs, stages, stageResults, stagesCompleted]);

  // Record this game on mount so the Records menu has the data — the
  // all-time stats live there now rather than cluttering this results screen.
  // Skipped on a cross-device revisit (recordOnMount=false) so we don't
  // re-count a run that wasn't played on this device.
  useEffect(() => {
    if (recordOnMount) recordGauntletGame(won, totalGuesses, totalTimeMs);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="h-screen-stable overflow-y-auto p-4"
      style={{
        backgroundColor: 'var(--color-bg)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)',
      }}
    >
      <div
        className="max-w-lg w-full mx-auto space-y-6 py-6 animate-fade-in-scale"
      >
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="animate-fade-in-scale" style={{ animationDelay: '0.2s' }}>
            {won ? (
              <Trophy className="w-20 h-20 text-amber-600 mx-auto" fill="currentColor" />
            ) : (
              <XCircle className="w-20 h-20 text-red-400 mx-auto" />
            )}
          </div>
          <h1
            className={`text-5xl font-black animate-fade-in-up ${
              won
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400'
                : 'text-red-300'
            }`}
          >
            {won ? 'GAUNTLET CLEARED!' : 'GAUNTLET FAILED'}
          </h1>
          {/* Actions at the top (matches the native completed screens). */}
          <div className="flex items-center justify-center gap-4 pt-1">
            <button onClick={onHome} className="text-sm font-bold underline hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>Home</button>
            <button onClick={handleShare} className="text-sm font-bold underline text-blue-500 hover:opacity-70">{copied ? 'Copied!' : 'Share'}</button>
            {showPlayAgain && (
              <button onClick={onPlayAgain} className="text-sm font-bold underline text-purple-500 hover:opacity-70">Play Again</button>
            )}
          </div>
          {isDaily && (
            <div className="flex justify-center">
              <DailyRankBadge gameMode="GAUNTLET" />
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div
          className="grid grid-cols-3 gap-3 animate-fade-in-up"
          style={{ animationDelay: '0.6s' }}
        >
          <div className="bg-gray-100 backdrop-blur-sm rounded-xl p-4 text-center border border-gray-200">
            <Trophy className="w-5 h-5 text-violet-400 mx-auto mb-1" />
            <div className="text-2xl font-black text-gray-800">{stagesCompleted}/5</div>
            <div className="text-gray-400 text-xs">Stages</div>
          </div>
          <div className="bg-gray-100 backdrop-blur-sm rounded-xl p-4 text-center border border-gray-200">
            <Hash className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <div className="text-2xl font-black text-gray-800">{totalGuesses}</div>
            <div className="text-gray-400 text-xs">Guesses</div>
          </div>
          <div className="bg-gray-100 backdrop-blur-sm rounded-xl p-4 text-center border border-gray-200">
            <Clock className="w-5 h-5 text-orange-400 mx-auto mb-1" />
            <div className="text-2xl font-black text-gray-800">{formatTime(totalTimeMs)}</div>
            <div className="text-gray-400 text-xs">Time</div>
          </div>
        </div>

        {/* Composite-score breakdown — same formula as the leaderboard. */}
        <div className="animate-fade-in-up" style={{ animationDelay: '0.7s' }}>
          <ScoreBreakdownCard
            gameMode="GAUNTLET"
            completed={won}
            guessCount={totalGuesses}
            timeSeconds={Math.floor(totalTimeMs / 1000)}
            boardsSolved={cumulativeBoardsSolved}
            totalBoards={cumulativeTotalBoards}
            stagesCompleted={stagesCompleted}
          />
          {isDaily && <NextDailyCta currentMode="GAUNTLET" />}
        </div>

        {/* Per-Stage Breakdown */}
        <div
          className="bg-gray-100 backdrop-blur-sm rounded-2xl p-4 border border-gray-200 space-y-2 animate-fade-in-up"
          style={{ animationDelay: '0.8s' }}
        >
          <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-3">Stage Breakdown</h3>
          {stages.map((stage, i) => {
            const result = stageResults.find(r => r.stageIndex === i);
            const isCompleted = result?.status === GameStatus.WON;
            const isFailed = result?.status === GameStatus.LOST;
            // Only offer Review when we actually captured the final
            // boards. Older saved sessions that completed before the
            // snapshot landed still show the summary row; the chevron
            // just disappears for those.
            const canReview = !!result?.boardsSnapshot?.length;

            const rowContent = (
              <>
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isCompleted ? 'bg-violet-500/30 text-violet-600' :
                    isFailed ? 'bg-red-500/30 text-red-300' :
                    'bg-gray-100 text-gray-300'
                  }`}>
                    {i + 1}
                  </div>
                  <span className={`font-bold ${
                    isCompleted ? 'text-violet-600' :
                    isFailed ? 'text-red-300' :
                    'text-gray-300'
                  }`}>
                    {stage.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {result ? (
                    <>
                      <span className="text-gray-400">
                        {result.guesses} guess{result.guesses !== 1 ? 'es' : ''}
                      </span>
                      <span className="text-gray-400">
                        {formatTime(result.timeMs)}
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                  {canReview && (
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 ${
                        isCompleted ? 'text-violet-500/70' :
                        isFailed ? 'text-red-400/70' :
                        'text-gray-300'
                      }`}
                      aria-hidden
                    />
                  )}
                </div>
              </>
            );

            const className = `flex items-center justify-between p-3 rounded-lg w-full text-left transition-colors ${
              isCompleted
                ? 'bg-violet-500/10 border border-violet-400/20' + (canReview ? ' hover:bg-violet-500/20 active:bg-violet-500/20' : '')
                : isFailed
                  ? 'bg-red-500/10 border border-red-400/20' + (canReview ? ' hover:bg-red-500/20 active:bg-red-500/20' : '')
                  : 'bg-gray-50 border border-white/5'
            }`;

            return (
              <div
                key={i}
                className="animate-fade-in-up"
                style={{ animationDelay: `${0.9 + i * 0.1}s` }}
              >
                {canReview ? (
                  <button
                    type="button"
                    onClick={() => setReviewStageIndex(i)}
                    className={className}
                    aria-label={`Review ${stage.name}`}
                  >
                    {rowContent}
                  </button>
                ) : (
                  <div className={className}>{rowContent}</div>
                )}
              </div>
            );
          })}
        </div>

      </div>

      {reviewStage && reviewResult?.boardsSnapshot?.length && (
          <StageReviewModal
            stage={reviewStage}
            result={reviewResult}
            onClose={() => setReviewStageIndex(null)}
          />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Stage review modal — renders the stage's final boards so a losing
// player can see which puzzle(s) ended the run plus the revealed
// solution(s). The in-app boards and MultiBoard live in a tree wired to
// the *active* game state; this component is a lightweight static
// renderer that reads directly from the snapshot captured by the reducer
// when the stage ended.
// ────────────────────────────────────────────────────────────────────────

function StageReviewModal({
  stage,
  result,
  onClose,
}: {
  stage: GauntletStageConfig;
  result: GauntletStageResult;
  onClose: () => void;
}) {
  const boards = result.boardsSnapshot ?? [];
  const won = result.status === GameStatus.WON;
  const n = boards.length;
  // Match the in-app multi-board layout: 1 board centered, 2–4 boards
  // in a 2-col grid, 8 boards in a 4-col grid. Keeps the Review visually
  // consistent with how the player saw the stage during play.
  const gridCols = n === 1 ? 'grid-cols-1' : n <= 4 ? 'grid-cols-2' : 'grid-cols-4';
  const solutionsLabel = boards.length === 1 ? 'Answer' : 'Answers';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 overflow-y-auto animate-modal-overlay"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md h-[90vh] overflow-hidden p-5 flex flex-col animate-modal-content"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 rounded-full transition-colors hover:bg-gray-100 text-gray-400"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Eye className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Stage {stage.stageIndex + 1}
          </span>
        </div>
        <h2 className={`text-2xl font-black mb-1 ${won ? 'text-violet-600' : 'text-red-400'}`}>
          {stage.name}
        </h2>
        <div className="text-xs font-bold text-gray-500 mb-4">
          {won ? 'Cleared' : 'Failed'} · {result.guesses} guess{result.guesses !== 1 ? 'es' : ''} · {formatTime(result.timeMs)}
        </div>

        {/* Solutions reveal — the whole point of this modal: show the
            words so a losing player immediately sees what they missed.
            Layout mirrors the VictoryAnimation / GameOverAnimation
            solutions grid used by the standalone multi-board modes:
            4 boards → 2×2, 8 boards → 4×2, single board → centered.
            Aligning the pill position to each board's slot in the
            MiniBoard grid below makes it trivial to eyeball "this is
            the board I failed" without reading the colors. */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mb-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            {solutionsLabel}
          </div>
          <div
            className={
              n === 1
                ? 'flex justify-center'
                : n <= 4
                  ? 'grid grid-cols-2 gap-x-3 gap-y-1.5 justify-items-center'
                  : 'grid grid-cols-4 gap-x-3 gap-y-1.5 justify-items-center'
            }
          >
            {boards.map((b, i) => {
              const boardWon = b.status === GameStatus.WON;
              const boardFailed = !won && !boardWon;
              return (
                <span
                  key={i}
                  className={`text-xs font-black px-2 py-0.5 rounded ${
                    boardWon
                      ? 'bg-violet-100 text-violet-700'
                      : boardFailed
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {b.solution.toUpperCase()}
                </span>
              );
            })}
          </div>
        </div>

        {/* Final board state — mirrors MiniBoard's tile rendering so the
            review looks like a paused version of the in-app stage view.
            `flex-1 min-h-0 auto-rows-fr` lets the boards shrink to fit
            the modal's remaining height instead of forcing a scrollbar
            on Wordle (1 board) and Quordle (2×2) reviews. */}
        <div className={`grid ${gridCols} gap-2 flex-1 min-h-0 auto-rows-fr`}>
          {boards.map((board, i) => (
            <StageReviewBoard key={i} board={board} stageWon={won} />
          ))}
        </div>
      </div>
    </div>
  );
}

const REVIEW_TILE_CLASS: Record<TileState, string> = {
  [TileState.CORRECT]: 'tile-correct text-white',
  [TileState.PRESENT]: 'tile-present text-white',
  [TileState.ABSENT]: 'tile-absent text-white',
  [TileState.EMPTY]: 'bg-white border-gray-300 text-gray-800',
  [TileState.HINT_USED]: 'bg-gray-100 border-gray-200 text-gray-300',
};

function StageReviewBoard({ board, stageWon }: { board: BoardState; stageWon: boolean }) {
  const prefills = board.prefilledGuesses ?? [];
  const prefillCount = prefills.length;
  const totalRows = prefillCount + board.maxGuesses;
  const width = board.solution.length;
  const won = board.status === GameStatus.WON;
  const lost = !stageWon && !won;

  // Pad an empty row for any slot the player never filled, so boards at
  // the same stage render at a consistent height regardless of how far
  // each individual board got (mirrors boardToGrid's pad logic used by
  // the share image).
  const rows: Array<{ kind: 'prefill' | 'guess' | 'empty'; tiles: Array<{ letter: string; state: TileState }> }> = [];
  for (const p of prefills) {
    rows.push({ kind: 'prefill', tiles: p.evaluation.tiles.map(t => ({ letter: t.letter, state: t.state })) });
  }
  for (const guess of board.guesses) {
    const ev = evaluateGuess(board.solution, guess);
    rows.push({ kind: 'guess', tiles: ev.tiles.map(t => ({ letter: t.letter, state: t.state })) });
  }
  while (rows.length < totalRows) {
    rows.push({
      kind: 'empty',
      tiles: Array.from({ length: width }, () => ({ letter: '', state: TileState.EMPTY })),
    });
  }

  // Layout mirrors MiniBoard: the board fills its grid cell and rows
  // distribute the available height via `gridTemplateRows: 1fr`. Tiles
  // drop `aspect-square` so the row's height — not the column width —
  // determines tile height; combined with min-h-0/min-w-0 this lets the
  // whole stack shrink to fit the modal's flex-1 boards container so
  // Wordle and Quordle reviews fit on screen without scrolling.
  return (
    <div
      className={`p-1.5 rounded-lg border-2 h-full min-h-0 min-w-0 flex flex-col ${
        won ? 'border-violet-400 bg-violet-50' :
        lost ? 'border-red-400 bg-red-50' :
        'border-gray-200 bg-white'
      }`}
    >
      <div
        className="grid gap-[2px] flex-1 min-h-0"
        style={{ gridTemplateRows: `repeat(${totalRows}, minmax(0, 1fr))` }}
      >
        {rows.map((row, rIdx) => (
          <div
            key={rIdx}
            className={`grid gap-[2px] min-h-0 ${row.kind === 'prefill' ? 'opacity-75' : ''}`}
            style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
          >
            {row.tiles.map((t, tIdx) => (
              <div
                key={tIdx}
                className={`flex items-center justify-center min-h-0 min-w-0 rounded border text-[10px] sm:text-xs font-bold ${REVIEW_TILE_CLASS[t.state]}`}
              >
                {t.letter ? t.letter.toUpperCase() : ''}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
