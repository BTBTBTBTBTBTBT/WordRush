'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Check, Zap } from 'lucide-react';
import { GauntletStageConfig } from '@wordle-duel/core';
import { useEffect } from 'react';

interface StageTransitionProps {
  completedStage: GauntletStageConfig;
  nextStage: GauntletStageConfig | null;
  onComplete: () => void;
}

export function StageTransition({ completedStage, nextStage, onComplete }: StageTransitionProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onComplete}
    >
      <div className="text-center space-y-8">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 12, stiffness: 200 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/30 border-4 border-green-400"
        >
          <Check className="w-10 h-10 text-green-300" />
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="text-green-400 text-sm font-bold uppercase tracking-wider mb-1">
            Stage Complete
          </div>
          <div className="text-white/60 text-lg">
            {completedStage.name}
          </div>
        </motion.div>

        {nextStage && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, type: 'spring', damping: 15 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-center gap-2 text-yellow-400 text-sm font-bold uppercase tracking-wider">
              <Zap className="w-4 h-4" fill="currentColor" />
              Next Up
              <Zap className="w-4 h-4" fill="currentColor" />
            </div>
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400"
            >
              {nextStage.name}
            </motion.div>
            <div className="text-white/40 text-sm">
              {nextStage.boardCount} board{nextStage.boardCount > 1 ? 's' : ''} &middot; {nextStage.maxGuesses} guesses
              {nextStage.sequential ? ' · sequential' : ''}
              {nextStage.hasPrefill ? ' · pre-filled clues' : ''}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
