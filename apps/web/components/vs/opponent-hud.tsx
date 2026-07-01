'use client';

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
    <div
      className="bg-gray-100 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-2 flex items-center gap-3 animate-fade-in-up"
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
        <span
          className="bg-violet-500/30 border border-violet-400/40 text-violet-300 text-xs font-bold px-2 py-0.5 rounded-full animate-fade-in-scale"
        >
          Solved!
        </span>
      )}

      {/* Live opponent tiles. During your own play only render per-board grids
          for <=4 boards — 8 tiny OctoWord grids over your own 8 boards are
          illegible and steal space, so those stay summary-only (the count line
          above); the spectator "still playing" screen renders all boards larger.
          Gauntlet's 21-board count also falls out here (it shows Stage N/5). */}
      {hasTiles && totalBoards <= 4 && (
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
    </div>
  );
}
