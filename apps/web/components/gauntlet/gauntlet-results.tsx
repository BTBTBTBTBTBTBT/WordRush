'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, XCircle, Clock, Hash, Home, RotateCcw, BarChart3, Zap, Timer, Share2, Eye, X, ChevronRight } from 'lucide-react';
import { BoardState, evaluateGuess, GameStatus, GauntletStageConfig, GauntletStageResult, TileState } from '@wordle-duel/core';
import { Button } from '@/components/ui/button';
import { GauntletStats, getGauntletStats, recordGauntletGame } from '@/lib/gauntlet-stats';
import { shareResult } from '@/lib/share-utils';

interface GauntletResultsProps {
  won: boolean;
  stages: GauntletStageConfig[];
  stageResults: GauntletStageResult[];
  totalTimeMs: number;
  onPlayAgain: () => void;
  onHome: () => void;
  showPlayAgain?: boolean;
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
}: GauntletResultsProps) {
  const totalGuesses = stageResults.reduce((sum, r) => sum + r.guesses, 0);
  const stagesCompleted = stageResults.filter(r => r.status === GameStatus.WON).length;
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

  const [stats, setStats] = useState<GauntletStats | null>(null);

  // Record this game and load stats on mount
  useEffect(() => {
    const updated = recordGauntletGame(won, totalGuesses, totalTimeMs);
    setStats(updated);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const winRate = stats && stats.gamesPlayed > 0
    ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
    : 0;
  const avgTime = stats && stats.gamesPlayed > 0
    ? stats.totalTimeMs / stats.gamesPlayed
    : null;
  const avgGuesses = stats && stats.gamesPlayed > 0
    ? Math.round(stats.totalGuesses / stats.gamesPlayed)
    : null;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 overflow-y-auto"
      style={{
        backgroundColor: '#f8f7ff',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 15 }}
        className="max-w-lg w-full space-y-6 py-6"
      >
        {/* Header */}
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', damping: 10 }}
          >
            {won ? (
              <Trophy className="w-20 h-20 text-amber-600 mx-auto" fill="currentColor" />
            ) : (
              <XCircle className="w-20 h-20 text-red-400 mx-auto" />
            )}
          </motion.div>
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className={`text-5xl font-black ${
              won
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400'
                : 'text-red-300'
            }`}
          >
            {won ? 'GAUNTLET CLEARED!' : 'GAUNTLET FAILED'}
          </motion.h1>
        </div>

        {/* Summary Stats */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="grid grid-cols-3 gap-3"
        >
          <div className="bg-gray-100 backdrop-blur-sm rounded-xl p-4 text-center border border-gray-200">
            <Trophy className="w-5 h-5 text-green-400 mx-auto mb-1" />
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
        </motion.div>

        {/* Per-Stage Breakdown */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="bg-gray-100 backdrop-blur-sm rounded-2xl p-4 border border-gray-200 space-y-2"
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
                    isCompleted ? 'bg-green-500/30 text-green-600' :
                    isFailed ? 'bg-red-500/30 text-red-300' :
                    'bg-gray-100 text-gray-300'
                  }`}>
                    {i + 1}
                  </div>
                  <span className={`font-bold ${
                    isCompleted ? 'text-green-600' :
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
                        isCompleted ? 'text-green-500/70' :
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
                ? 'bg-green-500/10 border border-green-400/20' + (canReview ? ' hover:bg-green-500/20 active:bg-green-500/20' : '')
                : isFailed
                  ? 'bg-red-500/10 border border-red-400/20' + (canReview ? ' hover:bg-red-500/20 active:bg-red-500/20' : '')
                  : 'bg-gray-50 border border-white/5'
            }`;

            return (
              <motion.div
                key={i}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.9 + i * 0.1 }}
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
              </motion.div>
            );
          })}
        </motion.div>

        {/* All-Time Stats */}
        {stats && stats.gamesPlayed > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.4 }}
            className="bg-gray-100 backdrop-blur-sm rounded-2xl p-4 border border-gray-200"
          >
            <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-3">All-Time Stats</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-2">
                <BarChart3 className="w-4 h-4 text-purple-400 shrink-0" />
                <div>
                  <div className="text-gray-800 font-bold text-lg">{stats.gamesPlayed}</div>
                  <div className="text-gray-400 text-xs">Games Played</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2">
                <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <div className="text-gray-800 font-bold text-lg">{winRate}%</div>
                  <div className="text-gray-400 text-xs">Win Rate</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2">
                <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                <div>
                  <div className="text-gray-800 font-bold text-lg">{avgTime ? formatTime(avgTime) : '—'}</div>
                  <div className="text-gray-400 text-xs">Avg Time</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2">
                <Timer className="w-4 h-4 text-green-400 shrink-0" />
                <div>
                  <div className="text-gray-800 font-bold text-lg">{stats.bestTimeMs ? formatTime(stats.bestTimeMs) : '—'}</div>
                  <div className="text-gray-400 text-xs">Best Time</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 col-span-2">
                <Hash className="w-4 h-4 text-orange-400 shrink-0" />
                <div>
                  <div className="text-gray-800 font-bold text-lg">{avgGuesses ?? '—'}</div>
                  <div className="text-gray-400 text-xs">Avg Guesses per Game</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="flex gap-3"
        >
          {showPlayAgain && (
            <Button
              onClick={onPlayAgain}
              className="flex-1 bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 hover:from-yellow-500 hover:via-pink-600 hover:to-purple-600 text-white font-bold py-6"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Play Again
            </Button>
          )}
          <Button
            onClick={handleShare}
            className="bg-blue-50 border-2 border-blue-200 hover:bg-blue-100 text-blue-600 font-bold py-6"
          >
            <Share2 className="w-5 h-5 mr-2" />
            {copied ? 'Copied!' : 'Share'}
          </Button>
          <Button
            onClick={onHome}
            className="bg-gray-100 border-2 border-gray-200 hover:bg-gray-200 text-gray-700 font-bold py-6"
          >
            <Home className="w-5 h-5 mr-2" />
            Home
          </Button>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {reviewStage && reviewResult?.boardsSnapshot?.length && (
          <StageReviewModal
            stage={reviewStage}
            result={reviewResult}
            onClose={() => setReviewStageIndex(null)}
          />
        )}
      </AnimatePresence>
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5"
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
        <h2 className={`text-2xl font-black mb-1 ${won ? 'text-green-600' : 'text-red-400'}`}>
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
            {boards.map((b, i) => (
              <span
                key={i}
                className={`text-xs font-black px-2 py-0.5 rounded ${
                  b.status === GameStatus.WON
                    ? 'bg-green-100 text-green-700'
                    : b.status === GameStatus.LOST
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-200 text-gray-700'
                }`}
              >
                {b.solution.toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        {/* Final board state — mirrors MiniBoard's tile rendering so the
            review looks like a paused version of the in-app stage view. */}
        <div className={`grid ${gridCols} gap-2`}>
          {boards.map((board, i) => (
            <StageReviewBoard key={i} board={board} />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

const REVIEW_TILE_CLASS: Record<TileState, string> = {
  [TileState.CORRECT]: 'bg-green-500 border-green-500 text-white',
  [TileState.PRESENT]: 'bg-yellow-500 border-yellow-500 text-white',
  [TileState.ABSENT]: 'bg-gray-400 border-gray-400 text-white',
  [TileState.EMPTY]: 'bg-white border-gray-300 text-gray-800',
};

function StageReviewBoard({ board }: { board: BoardState }) {
  const prefills = board.prefilledGuesses ?? [];
  const prefillCount = prefills.length;
  const totalRows = prefillCount + board.maxGuesses;
  const width = board.solution.length;
  const won = board.status === GameStatus.WON;
  const lost = board.status === GameStatus.LOST;

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

  return (
    <div
      className={`p-1.5 rounded-lg border-2 ${
        won ? 'border-green-400 bg-green-50' :
        lost ? 'border-red-400 bg-red-50' :
        'border-gray-200 bg-white'
      }`}
    >
      <div className="flex flex-col gap-[2px]">
        {rows.map((row, rIdx) => (
          <div
            key={rIdx}
            className={`grid gap-[2px] ${row.kind === 'prefill' ? 'opacity-75' : ''}`}
            style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}
          >
            {row.tiles.map((t, tIdx) => (
              <div
                key={tIdx}
                className={`aspect-square flex items-center justify-center rounded border text-[10px] sm:text-xs font-bold ${REVIEW_TILE_CLASS[t.state]}`}
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
