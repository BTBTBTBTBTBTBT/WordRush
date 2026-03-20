'use client';

import { motion } from 'framer-motion';
import { Trophy, XCircle, Clock, Hash, Home, RotateCcw } from 'lucide-react';
import { GameStatus, GauntletStageConfig, GauntletStageResult } from '@wordle-duel/core';
import { Button } from '@/components/ui/button';

interface GauntletResultsProps {
  won: boolean;
  stages: GauntletStageConfig[];
  stageResults: GauntletStageResult[];
  totalTimeMs: number;
  onPlayAgain: () => void;
  onHome: () => void;
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
}: GauntletResultsProps) {
  const totalGuesses = stageResults.reduce((sum, r) => sum + r.guesses, 0);
  const stagesCompleted = stageResults.filter(r => r.status === GameStatus.WON).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-orange-700 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 15 }}
        className="max-w-lg w-full space-y-6"
      >
        {/* Header */}
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', damping: 10 }}
          >
            {won ? (
              <Trophy className="w-20 h-20 text-yellow-400 mx-auto" fill="currentColor" />
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
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/10">
            <Trophy className="w-5 h-5 text-green-400 mx-auto mb-1" />
            <div className="text-2xl font-black text-white">{stagesCompleted}/5</div>
            <div className="text-white/50 text-xs">Stages</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/10">
            <Hash className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <div className="text-2xl font-black text-white">{totalGuesses}</div>
            <div className="text-white/50 text-xs">Guesses</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/10">
            <Clock className="w-5 h-5 text-orange-400 mx-auto mb-1" />
            <div className="text-2xl font-black text-white">{formatTime(totalTimeMs)}</div>
            <div className="text-white/50 text-xs">Time</div>
          </div>
        </motion.div>

        {/* Per-Stage Breakdown */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 space-y-2"
        >
          <h3 className="text-white/60 text-sm font-bold uppercase tracking-wider mb-3">Stage Breakdown</h3>
          {stages.map((stage, i) => {
            const result = stageResults.find(r => r.stageIndex === i);
            const isCompleted = result?.status === GameStatus.WON;
            const isFailed = result?.status === GameStatus.LOST;
            const isSkipped = !result;

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
                      : 'bg-white/5 border border-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isCompleted ? 'bg-green-500/30 text-green-300' :
                    isFailed ? 'bg-red-500/30 text-red-300' :
                    'bg-white/10 text-white/30'
                  }`}>
                    {i + 1}
                  </div>
                  <span className={`font-bold ${
                    isCompleted ? 'text-green-300' :
                    isFailed ? 'text-red-300' :
                    'text-white/30'
                  }`}>
                    {stage.name}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  {result ? (
                    <>
                      <span className="text-white/50">
                        {result.guesses} guess{result.guesses !== 1 ? 'es' : ''}
                      </span>
                      <span className="text-white/50">
                        {formatTime(result.timeMs)}
                      </span>
                    </>
                  ) : (
                    <span className="text-white/20">—</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="flex gap-3"
        >
          <Button
            onClick={onPlayAgain}
            className="flex-1 bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 hover:from-yellow-500 hover:via-pink-600 hover:to-purple-600 text-white font-bold py-6"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Play Again
          </Button>
          <Button
            onClick={onHome}
            className="bg-white/10 border-2 border-white/20 hover:bg-white/20 text-white font-bold py-6"
          >
            <Home className="w-5 h-5 mr-2" />
            Home
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
