'use client';

import { useMemo } from 'react';
import { evaluateGuess, createInitialState, GameMode } from '@wordle-duel/core';
import { Board } from '@/components/game/board';
import { useWordDefinition } from '@/hooks/use-word-definition';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';
import { getTodayUTC } from '@/lib/daily-service';
import { generateDailySeed } from '@wordle-duel/core';

const SAVE_VERSION = 3;

interface SavedGameState {
  version?: number;
  date: string;
  seed: string;
  mode: string;
  guesses: string[];
  elapsedTime: number;
  gameStatus: string;
}

const MODE_MAP: Record<string, GameMode> = {
  DUEL: GameMode.DUEL,
  QUORDLE: GameMode.QUORDLE,
  OCTORDLE: GameMode.OCTORDLE,
  SEQUENCE: GameMode.SEQUENCE,
  RESCUE: GameMode.RESCUE,
  GAUNTLET: GameMode.GAUNTLET,
};

function loadCompletedGame(modeId: string): SavedGameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = `spellstrike-daily-${modeId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const parsed: SavedGameState = JSON.parse(stored);
    if (parsed.date !== getTodayUTC()) return null;
    if (parsed.gameStatus !== 'WON' && parsed.gameStatus !== 'LOST') return null;
    if (parsed.version !== SAVE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

interface CompletedDailyBoardProps {
  modeId: string;
}

export function CompletedDailyBoard({ modeId }: CompletedDailyBoardProps) {
  ensureDictionaryInitialized();
  const saved = useMemo(() => loadCompletedGame(modeId), [modeId]);

  const gameMode = MODE_MAP[modeId];
  const seed = useMemo(() => {
    if (!saved) return null;
    return generateDailySeed(getTodayUTC(), modeId);
  }, [saved, modeId]);

  const solution = useMemo(() => {
    if (!seed || !gameMode) return null;
    try {
      const state = createInitialState(seed, gameMode);
      return state.boards[0]?.solution || null;
    } catch {
      return null;
    }
  }, [seed, gameMode]);

  const evaluations = useMemo(() => {
    if (!saved || !solution) return [];
    return saved.guesses.map(g => evaluateGuess(solution, g));
  }, [saved, solution]);

  const { definition, loaded: defLoaded } = useWordDefinition(solution);

  if (!saved || !solution || evaluations.length === 0) return null;

  // Only show single-board completed view for now (DUEL mode)
  if (modeId !== 'DUEL') return null;

  const won = saved.gameStatus === 'WON';
  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div
      className="mb-4"
      style={{
        background: '#ffffff',
        border: '1.5px solid #ede9f6',
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

      <div className="px-4 pt-3 pb-4">
        {/* Header */}
        <div className="text-center mb-2">
          <span
            className="text-[10px] font-extrabold uppercase tracking-wider"
            style={{ color: won ? '#22c55e' : '#9ca3af' }}
          >
            {won ? 'Completed' : 'Attempted'} Today
          </span>
        </div>

        {/* Compact board */}
        <div className="mx-auto" style={{ maxWidth: '200px' }}>
          <Board
            guesses={saved.guesses}
            currentGuess=""
            maxGuesses={6}
            evaluations={evaluations}
            showSolution={false}
            solution={solution}
            darkMode
          />
        </div>

        {/* Solution + Definition */}
        <div className="text-center mt-3">
          <div className="text-lg font-black tracking-wider" style={{ color: '#1a1a2e' }}>
            {solution.toUpperCase()}
          </div>
          {defLoaded && (
            <div
              className="mt-2 mx-auto px-3 py-2 text-left"
              style={{
                background: '#f8f7ff',
                borderRadius: '10px',
                border: '1px solid #ede9f6',
                maxWidth: '320px',
              }}
            >
              {definition ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    {definition.phonetic && (
                      <span className="text-[11px] font-medium" style={{ color: '#9ca3af' }}>
                        {definition.phonetic}
                      </span>
                    )}
                    {definition.partOfSpeech && (
                      <span
                        className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: '#ede9f6', color: '#a78bfa' }}
                      >
                        {definition.partOfSpeech}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium mt-1 leading-snug" style={{ color: '#4a4a6a' }}>
                    {definition.definition}
                  </p>
                </>
              ) : (
                <p className="text-xs font-medium italic" style={{ color: '#9ca3af' }}>
                  No definition available for this word.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-5 mt-3">
          <div className="text-center">
            <div className="text-sm font-black" style={{ color: '#1a1a2e' }}>
              {saved.guesses.length}/6
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#9ca3af' }}>
              Guesses
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-black" style={{ color: '#1a1a2e' }}>
              {formatTime(saved.elapsedTime)}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#9ca3af' }}>
              Time
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
