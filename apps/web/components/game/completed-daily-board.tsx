'use client';

import { useMemo } from 'react';
import { evaluateGuess, createInitialState, GameMode, TileState, gameReducer, GameStatus } from '@wordle-duel/core';
import { Board } from '@/components/game/board';
import { useWordDefinition } from '@/hooks/use-word-definition';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';
import { getTodayLocal } from '@/lib/daily-service';
import { generateDailySeed } from '@wordle-duel/core';
import { getDailyPuzzle } from '@/components/propernoundle/puzzle-service';
import { normalizeString } from '@/components/propernoundle/game-logic';
import type { Guess as ProperNoundleGuess, TileState as PNTileState } from '@/components/propernoundle/types';

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

const MULTI_BOARD_MODES = new Set(['QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE']);

function loadCompletedGame(modeId: string): SavedGameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = `wordocious-daily-${modeId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const parsed: SavedGameState = JSON.parse(stored);
    if (parsed.date !== getTodayLocal()) return null;
    if (parsed.gameStatus !== 'WON' && parsed.gameStatus !== 'LOST') return null;
    if (parsed.version !== SAVE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ProperNoundle uses a completely different persistence format
interface SavedProperNoundleState {
  date: string;
  puzzleId: string;
  guesses: ProperNoundleGuess[];
  gameStatus: 'playing' | 'won' | 'lost';
  letterStates: Record<string, PNTileState>;
  elapsedTime: number;
}

function loadCompletedProperNoundle(): SavedProperNoundleState | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('wordocious-propernoundle-daily');
    if (!stored) return null;
    const parsed: SavedProperNoundleState = JSON.parse(stored);
    if (parsed.date !== getTodayLocal()) return null;
    if (parsed.gameStatus !== 'won' && parsed.gameStatus !== 'lost') return null;
    // Drop saves whose puzzleId doesn't match today's daily. The caller
    // also checks this downstream, but wiping here clears the stale
    // localStorage entry instead of carrying it forward across refreshes.
    const today = getDailyPuzzle();
    if (!parsed.puzzleId || parsed.puzzleId !== today.id) {
      localStorage.removeItem('wordocious-propernoundle-daily');
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

interface CompletedDailyBoardProps {
  modeId: string;
}

// ── Tile color helper (matches multi-board.tsx) ──
const getTileColor = (state: TileState) => {
  switch (state) {
    case TileState.CORRECT: return 'bg-green-600 border-green-600';
    case TileState.PRESENT: return 'bg-yellow-500 border-yellow-500';
    case TileState.ABSENT: return 'bg-gray-400 border-gray-400';
    default: return 'bg-white border-gray-300';
  }
};

const evaluateGuessTiles = (guess: string, solution: string): TileState[] => {
  const result: TileState[] = Array(5).fill(TileState.EMPTY);
  const solutionArray = solution.split('');
  const guessArray = guess.split('');
  const used = Array(5).fill(false);

  guessArray.forEach((letter, i) => {
    if (letter === solutionArray[i]) { result[i] = TileState.CORRECT; used[i] = true; }
  });
  guessArray.forEach((letter, i) => {
    if (result[i] === TileState.EMPTY) {
      const f = solutionArray.findIndex((l, idx) => l === letter && !used[idx]);
      if (f !== -1) { result[i] = TileState.PRESENT; used[f] = true; }
      else { result[i] = TileState.ABSENT; }
    }
  });
  return result;
};

// ── Compact mini board for multi-board completed view ──
function CompletedMiniBoard({ solution, guesses, maxGuesses, won }: {
  solution: string;
  guesses: string[];
  maxGuesses: number;
  won: boolean;
}) {
  return (
    <div className={`relative p-0.5 rounded-lg border-2 ${
      won ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'
    }`}>
      {won && (
        <div className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center z-10">
          ✓
        </div>
      )}
      <div className="grid gap-[1px]" style={{ gridTemplateRows: `repeat(${maxGuesses}, 1fr)` }}>
        {Array.from({ length: maxGuesses }).map((_, rowIndex) => {
          const guess = guesses[rowIndex] || '';
          const isPast = rowIndex < guesses.length;
          const tiles = isPast ? evaluateGuessTiles(guess, solution) : Array(5).fill(TileState.EMPTY);

          return (
            <div key={rowIndex} className="grid grid-cols-5 gap-[1px]">
              {Array.from({ length: 5 }).map((_, li) => {
                const letter = guess[li] || '';
                const tileState = isPast ? tiles[li] : TileState.EMPTY;
                return (
                  <div
                    key={li}
                    className={`flex items-center justify-center border rounded text-[7px] font-bold leading-none ${
                      tileState === TileState.EMPTY ? 'text-gray-800' : 'text-white'
                    } ${getTileColor(tileState)}`}
                    style={{ aspectRatio: '1' }}
                  >
                    {letter.toUpperCase()}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ProperNoundle mini board with variable-length word groups ──
function CompletedProperNoundleMiniBoard({ guesses, maxGuesses, answerDisplay }: {
  guesses: ProperNoundleGuess[];
  maxGuesses: number;
  answerDisplay: string;
}) {
  const wordGroups = answerDisplay.split(' ').map(word => normalizeString(word).length);
  const totalLetters = wordGroups.reduce((a, b) => a + b, 0);

  const getPNTileColor = (state: PNTileState) => {
    switch (state) {
      case 'correct': return 'bg-green-600 border-green-600';
      case 'present': return 'bg-yellow-500 border-yellow-500';
      case 'absent': return 'bg-gray-400 border-gray-400';
      default: return 'bg-white border-gray-300';
    }
  };

  return (
    <div className="grid gap-[2px]" style={{ gridTemplateRows: `repeat(${maxGuesses}, 1fr)` }}>
      {Array.from({ length: maxGuesses }).map((_, rowIndex) => {
        const guess = guesses[rowIndex];
        const isPast = rowIndex < guesses.length;

        let letterIdx = 0;
        return (
          <div key={rowIndex} className="flex items-center justify-center gap-[6px]">
            {wordGroups.map((groupLen, gi) => {
              const groupTiles = [];
              for (let ti = 0; ti < groupLen; ti++) {
                const idx = letterIdx++;
                const letter = isPast && guess ? (guess.word[idx] || '') : '';
                const tileState = isPast && guess && guess.tiles[idx] ? guess.tiles[idx] : 'empty';
                groupTiles.push(
                  <div
                    key={`${gi}-${ti}`}
                    className={`flex items-center justify-center border rounded text-[6px] font-bold leading-none ${
                      tileState === 'empty' ? 'text-gray-800' : 'text-white'
                    } ${getPNTileColor(tileState)}`}
                    style={{
                      width: `${Math.min(16, Math.floor(200 / totalLetters))}px`,
                      aspectRatio: '1',
                    }}
                  >
                    {letter.toUpperCase()}
                  </div>
                );
              }
              return (
                <div key={gi} className="flex gap-[1px]">
                  {groupTiles}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function CompletedDailyBoard({ modeId }: CompletedDailyBoardProps) {
  ensureDictionaryInitialized();

  // ProperNoundle has its own persistence format
  const isProperNoundle = modeId === 'PROPERNOUNDLE';
  const pnSaved = useMemo(() => isProperNoundle ? loadCompletedProperNoundle() : null, [isProperNoundle]);
  const pnPuzzle = useMemo(() => isProperNoundle ? getDailyPuzzle() : null, [isProperNoundle]);

  const saved = useMemo(() => isProperNoundle ? null : loadCompletedGame(modeId), [modeId, isProperNoundle]);

  const gameMode = MODE_MAP[modeId];
  const seed = useMemo(() => {
    if (!saved) return null;
    return generateDailySeed(getTodayLocal(), modeId);
  }, [saved, modeId]);

  // Reconstruct board states by replaying guesses through the reducer
  const replayedState = useMemo(() => {
    if (!seed || !gameMode) return null;
    if (!saved) return null;
    try {
      let state = createInitialState(seed, gameMode);
      const isMulti = MULTI_BOARD_MODES.has(modeId);

      if (!isMulti) {
        // Single-board: just replay guesses
        for (const guess of saved.guesses) {
          state = gameReducer(state, { type: 'SUBMIT_GUESS', guess });
        }
      } else {
        // All multi-board modes (parallel AND sequential):
        // Each guess goes to all playing boards (matching persistence replay logic)
        for (const guess of saved.guesses) {
          state.boards.forEach((board, index) => {
            if (board.status === 'PLAYING') {
              state = gameReducer(state, { type: 'SUBMIT_GUESS', guess, boardIndex: index });
            }
          });
        }
      }
      return state;
    } catch {
      return null;
    }
  }, [seed, gameMode, saved, modeId]);

  // For single-board: get solution + evaluations
  const solution = useMemo(() => {
    if (!replayedState) return null;
    return replayedState.boards[0]?.solution || null;
  }, [replayedState]);

  const evaluations = useMemo(() => {
    if (!saved || !solution || MULTI_BOARD_MODES.has(modeId)) return [];
    return saved.guesses.map(g => evaluateGuess(solution, g));
  }, [saved, solution, modeId]);

  const { definition, loaded: defLoaded } = useWordDefinition(
    MULTI_BOARD_MODES.has(modeId) || isProperNoundle ? null : solution
  );

  // Gauntlet not supported in daily completed view for now
  if (modeId === 'GAUNTLET') return null;

  // ProperNoundle path
  if (isProperNoundle) {
    if (!pnSaved || !pnPuzzle) return null;
    if (pnSaved.puzzleId !== pnPuzzle.id) return null;

    const pnWon = pnSaved.gameStatus === 'won';
    const pnFormatTime = (s: number) => {
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
        <div
          className="h-1"
          style={{
            background: pnWon
              ? 'linear-gradient(90deg, #22c55e, #4ade80)'
              : 'linear-gradient(90deg, #9ca3af, #d1d5db)',
          }}
        />
        <div className="px-4 pt-3 pb-4">
          <div className="text-center mb-2">
            <span
              className="text-[10px] font-extrabold uppercase tracking-wider"
              style={{ color: pnWon ? '#22c55e' : '#9ca3af' }}
            >
              {pnWon ? 'Completed' : 'Attempted'} Today
            </span>
          </div>

          {/* Compact ProperNoundle board */}
          <div className="mx-auto" style={{ maxWidth: '240px' }}>
            <CompletedProperNoundleMiniBoard
              guesses={pnSaved.guesses}
              maxGuesses={6}
              answerDisplay={pnPuzzle.display}
            />
          </div>

          {/* Answer display */}
          <div className="text-center mt-3">
            <div className="text-lg font-black tracking-wider" style={{ color: '#1a1a2e' }}>
              {pnPuzzle.display.toUpperCase()}
            </div>
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-5 mt-3">
            <div className="text-center">
              <div className="text-sm font-black" style={{ color: '#1a1a2e' }}>
                {pnSaved.guesses.length}/6
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#9ca3af' }}>
                Guesses
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm font-black" style={{ color: '#1a1a2e' }}>
                {pnFormatTime(pnSaved.elapsedTime)}
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

  // Standard modes
  if (!saved || !replayedState) return null;

  const won = saved.gameStatus === 'WON';
  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const isMulti = MULTI_BOARD_MODES.has(modeId);
  const boardsSolved = replayedState.boards.filter(b => b.status === GameStatus.WON).length;
  const totalBoards = replayedState.boards.length;

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

        {isMulti ? (
          /* ── Multi-board compact grid ── */
          <>
            <div
              className={`mx-auto grid gap-2 ${totalBoards > 4 ? 'grid-cols-4' : 'grid-cols-2'}`}
              style={{ maxWidth: totalBoards > 4 ? '320px' : '240px' }}
            >
              {replayedState.boards.map((board, i) => (
                <CompletedMiniBoard
                  key={i}
                  solution={board.solution}
                  guesses={board.guesses}
                  maxGuesses={board.maxGuesses}
                  won={board.status === GameStatus.WON}
                />
              ))}
            </div>

            {/* Stats */}
            <div className="flex justify-center gap-5 mt-3">
              <div className="text-center">
                <div className="text-sm font-black" style={{ color: '#1a1a2e' }}>
                  {boardsSolved}/{totalBoards}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#9ca3af' }}>
                  Boards
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm font-black" style={{ color: '#1a1a2e' }}>
                  {saved.guesses.length}
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
          </>
        ) : (
          /* ── Single-board (Classic) ── */
          <>
            {/* Compact board */}
            <div className="mx-auto" style={{ maxWidth: '200px' }}>
              <Board
                guesses={saved.guesses}
                currentGuess=""
                maxGuesses={6}
                evaluations={evaluations}
                showSolution={false}
                solution={solution!}
                darkMode
              />
            </div>

            {/* Solution + Definition */}
            <div className="text-center mt-3">
              <div className="text-lg font-black tracking-wider" style={{ color: '#1a1a2e' }}>
                {solution!.toUpperCase()}
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
          </>
        )}
      </div>
    </div>
  );
}
