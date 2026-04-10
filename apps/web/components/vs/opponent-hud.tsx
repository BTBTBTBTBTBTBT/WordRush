'use client';

import { motion } from 'framer-motion';
import { OpponentMiniBoard, OpponentMultiMiniBoard } from './opponent-mini-board';

interface OpponentHUDProps {
  attempts: number;
  boardsSolved: number;
  totalBoards: number;
  currentStage?: number;
  opponentTiles?: Record<number, string[][]>;
  maxGuesses?: number;
  wordLength?: number;
}

export function OpponentHUD({ attempts, boardsSolved, totalBoards, currentStage, opponentTiles, maxGuesses = 6, wordLength = 5 }: OpponentHUDProps) {
  const allSolved = boardsSolved >= totalBoards && totalBoards > 0;
  const hasTiles = opponentTiles && Object.keys(opponentTiles).length > 0;

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="bg-gray-100 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-2 flex items-center gap-3"
    >
      <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">Opponent</span>
      <div className="h-4 w-px bg-gray-200" />

      {currentStage !== undefined ? (
        <span className="text-gray-700 text-xs font-bold">
          Stage {currentStage + 1}/5 | {attempts} guesses
        </span>
      ) : totalBoards === 1 ? (
        <span className="text-gray-700 text-xs font-bold">
          {attempts} guesses
        </span>
      ) : (
        <span className="text-gray-700 text-xs font-bold">
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

      {/* Live opponent tiles */}
      {hasTiles && (
        <>
          <div className="h-4 w-px bg-gray-200" />
          {totalBoards === 1 ? (
            <OpponentMiniBoard
              tiles={opponentTiles[0] || []}
              maxGuesses={maxGuesses}
              wordLength={wordLength}
            />
          ) : (
            <OpponentMultiMiniBoard
              opponentTiles={opponentTiles}
              totalBoards={totalBoards}
              maxGuesses={maxGuesses}
              wordLength={wordLength}
            />
          )}
        </>
      )}
    </motion.div>
  );
}
