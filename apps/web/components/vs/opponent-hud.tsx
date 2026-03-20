'use client';

import { motion } from 'framer-motion';

interface OpponentHUDProps {
  attempts: number;
  boardsSolved: number;
  totalBoards: number;
  currentStage?: number;
}

export function OpponentHUD({ attempts, boardsSolved, totalBoards, currentStage }: OpponentHUDProps) {
  const allSolved = boardsSolved >= totalBoards && totalBoards > 0;

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-2 flex items-center gap-3"
    >
      <span className="text-white/60 text-xs font-bold uppercase tracking-wider">Opponent</span>
      <div className="h-4 w-px bg-white/20" />

      {currentStage !== undefined ? (
        // Gauntlet mode
        <span className="text-white/80 text-xs font-bold">
          Stage {currentStage + 1}/5 | {attempts} guesses
        </span>
      ) : totalBoards === 1 ? (
        // Single board mode
        <span className="text-white/80 text-xs font-bold">
          {attempts} guesses
        </span>
      ) : (
        // Multi board mode
        <span className="text-white/80 text-xs font-bold">
          {boardsSolved}/{totalBoards} boards | {attempts} guesses
        </span>
      )}

      {allSolved && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="bg-green-500/30 border border-green-400/40 text-green-300 text-xs font-bold px-2 py-0.5 rounded-full"
        >
          Solved!
        </motion.span>
      )}
    </motion.div>
  );
}
