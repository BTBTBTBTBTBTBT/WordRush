'use client';

import { createContext, useContext } from 'react';
import { OpponentMiniBoard, OpponentMultiMiniBoard } from './opponent-mini-board';

/**
 * Set by vs-game during a challenge-send game (VS overhaul §3): there is no
 * opponent yet, so every mode's HUD reads "YOUR RUN · <who races it>" instead
 * of an empty "Opponent · 0 guesses" strip.
 */
export const VsSoloHudContext = createContext<string | null>(null);

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
  const solo = useContext(VsSoloHudContext);
  const allSolved = boardsSolved >= totalBoards && totalBoards > 0;

  if (solo) {
    return (
      <div className="rounded-xl px-4 py-2 flex items-center gap-3 animate-fade-in-up" style={{ background: '#ccfbf1' }}>
        <span className="text-xs font-black uppercase tracking-wider" style={{ color: '#0f766e' }}>Your run</span>
        <div className="h-4 w-px" style={{ background: 'rgba(15, 118, 110, 0.25)' }} />
        <span className="text-xs font-bold" style={{ color: '#134e4a' }}>{solo}</span>
      </div>
    );
  }

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
      {/* Render the EMPTY grid from the start (no hasTiles gate) so the board is
          visible the whole match and never flickers in on the opponent's first guess. */}
      {totalBoards <= 4 && (
        <>
          <div className="h-4 w-px bg-gray-200" />
          {totalBoards === 1 ? (
            <OpponentMiniBoard
              tiles={opponentTiles?.[0] || []}
              maxGuesses={maxGuesses}
              wordLength={wordLength}
            />
          ) : (
            <OpponentMultiMiniBoard
              opponentTiles={opponentTiles ?? {}}
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
