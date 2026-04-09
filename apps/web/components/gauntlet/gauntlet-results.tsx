'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trophy, XCircle, Clock, Hash, Home, RotateCcw, BarChart3, Zap, Timer, Share2 } from 'lucide-react';
import { GameStatus, GauntletStageConfig, GauntletStageResult } from '@wordle-duel/core';
import { Button } from '@/components/ui/button';
import { GauntletStats, getGauntletStats, recordGauntletGame } from '@/lib/gauntlet-stats';
import { generateShareText, copyShareToClipboard } from '@/lib/share-utils';

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

  const handleShare = useCallback(async () => {
    const stageSummary = stageResults.map((r, i) =>
      `${r.status === GameStatus.WON ? '\u{2705}' : '\u{274C}'} Stage ${i + 1}: ${r.guesses} guesses`
    ).join('\n');
    const text = generateShareText({
      mode: 'Gauntlet',
      won,
      guesses: totalGuesses,
      maxGuesses: totalGuesses,
      timeSeconds: Math.floor(totalTimeMs / 1000),
      boardSummary: stageSummary,
      boardsSolved: stagesCompleted,
      totalBoards: 5,
    });
    const ok = await copyShareToClipboard(text);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }, [won, totalGuesses, totalTimeMs, stageResults, stagesCompleted]);

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
    <div className="min-h-screen flex items-center justify-center p-4 overflow-y-auto" style={{ backgroundColor: '#f8f7ff' }}>
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

            return (
              <motion.div
                key={i}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.9 + i * 0.1 }}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  isCompleted
                    ? 'bg-green-500/10 border border-green-400/20'
                    : isFailed
                      ? 'bg-red-500/10 border border-red-400/20'
                      : 'bg-gray-50 border border-white/5'
                }`}
              >
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
                <div className="flex items-center gap-4 text-sm">
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
                </div>
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
    </div>
  );
}
