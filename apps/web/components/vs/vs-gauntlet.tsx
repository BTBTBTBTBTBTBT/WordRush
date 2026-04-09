'use client';

import { useReducer, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  gameReducer,
  initializeGame,
  GameMode,
  GameStatus,
  TileState,
  GAUNTLET_STAGES,
  isValidWord,
  evaluateGuess,
} from '@wordle-duel/core';
import { Board } from '@/components/game/board';
import { MultiBoard, computeActiveLetterStates, computePerBoardLetterStates } from '@/components/game/multi-board';
import { Keyboard } from '@/components/game/keyboard';
import { GauntletProgress, GauntletStageHeader } from '@/components/gauntlet/gauntlet-progress';
import { StageTransition } from '@/components/gauntlet/stage-transition';
import { OpponentHUD } from './opponent-hud';
import { Lock } from 'lucide-react';

export interface VsGauntletProps {
  seed: string;
  mode: GameMode;
  onBoardSolved: (boardIndex: number) => void;
  onCompleted: (status: 'won' | 'lost', totalGuesses: number, timeMs: number) => void;
  opponentProgress: { attempts: number; boardsSolved: number; totalBoards: number; currentStage?: number };
  startTime: number;
  onStageCompleted?: (stageIndex: number) => void;
}

export function VsGauntlet({ seed, mode, onBoardSolved, onCompleted, opponentProgress, startTime, onStageCompleted }: VsGauntletProps) {
  const [state, dispatch] = useReducer(gameReducer, initializeGame(seed, GameMode.GAUNTLET));
  const [currentGuess, setCurrentGuess] = useState('');
  const [message, setMessage] = useState('');
  const [showTransition, setShowTransition] = useState(false);
  const [hasReported, setHasReported] = useState(false);
  const prevSolvedRef = useRef(0);

  const gauntlet = state.gauntlet!;
  const currentStageConfig = gauntlet.stages[gauntlet.currentStage];
  const isSequential = currentStageConfig.sequential;
  const isSingleBoard = currentStageConfig.boardCount === 1;

  // For sequence stages, track the active board
  const sequenceActiveBoardIndex = useMemo(() => {
    if (!isSequential) return -1;
    for (let i = 0; i < state.boards.length; i++) {
      if (state.boards[i]?.status === GameStatus.PLAYING) return i;
    }
    return -1;
  }, [isSequential, state.boards]);

  // Build letter states
  const letterStates = useMemo(() => {
    if (isSequential && sequenceActiveBoardIndex >= 0) {
      const states: Record<string, 'correct' | 'present' | 'absent'> = {};
      const activeBoard = state.boards[sequenceActiveBoardIndex];
      if (activeBoard) {
        for (const guess of activeBoard.guesses) {
          const result = evaluateGuess(activeBoard.solution, guess);
          for (const tile of result.tiles) {
            const letter = tile.letter.toUpperCase();
            if (tile.state === 'CORRECT') states[letter] = 'correct';
            else if (tile.state === 'PRESENT' && states[letter] !== 'correct') states[letter] = 'present';
            else if (tile.state === 'ABSENT' && !states[letter]) states[letter] = 'absent';
          }
        }
      }
      return states;
    }
    return computeActiveLetterStates(state.boards);
  }, [state.boards, isSequential, sequenceActiveBoardIndex]);

  const boardLetterStates = useMemo(() => {
    if (isSingleBoard || isSequential) return undefined;
    return computePerBoardLetterStates(state.boards);
  }, [state.boards, isSingleBoard, isSequential]);

  // Evaluations for single-board view
  const currentBoard = state.boards[state.currentBoardIndex];
  const evaluations = useMemo(() => {
    if (!currentBoard) return [];
    return currentBoard.guesses.map(g => evaluateGuess(currentBoard.solution, g));
  }, [currentBoard]);

  // Track board solves across all stages
  useEffect(() => {
    const solvedCount = state.boards.filter(b => b.status === GameStatus.WON).length;
    if (solvedCount > prevSolvedRef.current) {
      for (let i = prevSolvedRef.current; i < solvedCount; i++) {
        onBoardSolved(i);
      }
      prevSolvedRef.current = solvedCount;
    }
  }, [state.boards, onBoardSolved]);

  // Check for stage completion (no blackout in VS)
  useEffect(() => {
    if (state.status !== GameStatus.PLAYING) return;

    const allBoardsDone = state.boards.every(b => b.status !== GameStatus.PLAYING);
    const allBoardsWon = state.boards.every(b => b.status === GameStatus.WON);

    if (allBoardsDone && allBoardsWon) {
      setShowTransition(true);
      onStageCompleted?.(gauntlet.currentStage);
    }

    // In VS gauntlet, if any board is lost, the stage is failed (no blackout restart)
    if (allBoardsDone && !allBoardsWon) {
      if (!hasReported) {
        setHasReported(true);
        const totalGuesses = state.boards.reduce((sum, b) => sum + b.guesses.length, 0);
        onCompleted('lost', totalGuesses, Date.now() - startTime);
      }
    }
  }, [state.boards, state.status, gauntlet.currentStage, onStageCompleted, hasReported, onCompleted, startTime]);

  // Check for game over
  useEffect(() => {
    if (hasReported) return;
    if (state.status === GameStatus.WON) {
      setHasReported(true);
      const totalGuesses = gauntlet.stageResults.reduce((sum, r) => sum + r.guesses, 0) +
        state.boards.reduce((sum, b) => sum + b.guesses.length, 0);
      onCompleted('won', totalGuesses, Date.now() - startTime);
    } else if (state.status === GameStatus.LOST) {
      setHasReported(true);
      const totalGuesses = gauntlet.stageResults.reduce((sum, r) => sum + r.guesses, 0) +
        state.boards.reduce((sum, b) => sum + b.guesses.length, 0);
      onCompleted('lost', totalGuesses, Date.now() - startTime);
    }
  }, [state.status, hasReported, gauntlet.stageResults, state.boards, startTime, onCompleted]);

  const handleKey = useCallback((key: string) => {
    if (state.status !== GameStatus.PLAYING) return;
    if (showTransition) return;

    if (key === 'ENTER') {
      if (currentGuess.length !== 5) {
        setMessage('Not enough letters');
        setCurrentGuess('');
        setTimeout(() => setMessage(''), 1500);
        return;
      }
      if (!isValidWord(currentGuess)) {
        setMessage('Not in word list');
        setCurrentGuess('');
        setTimeout(() => setMessage(''), 1500);
        return;
      }

      if (isSingleBoard) {
        dispatch({ type: 'SUBMIT_GUESS', guess: currentGuess, boardIndex: state.currentBoardIndex });
      } else {
        state.boards.forEach((board, index) => {
          if (board.status === GameStatus.PLAYING) {
            dispatch({ type: 'SUBMIT_GUESS', guess: currentGuess, boardIndex: index });
          }
        });
      }
      setCurrentGuess('');
    } else if (key === 'BACK') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess(prev => prev + key);
    }
  }, [state, currentGuess, showTransition, isSingleBoard]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') handleKey('ENTER');
      else if (e.key === 'Backspace') handleKey('BACK');
      else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKey]);

  const handleTransitionComplete = useCallback(() => {
    setShowTransition(false);
    dispatch({ type: 'NEXT_STAGE' });
    setCurrentGuess('');
    prevSolvedRef.current = 0; // Reset for new stage boards
  }, []);

  const renderGameArea = () => {
    if (isSingleBoard) {
      const board = state.boards[state.currentBoardIndex];
      if (!board) return null;

      return (
        <div className="flex flex-col items-center gap-1 w-full justify-center">
          <Board
            guesses={board.guesses}
            currentGuess={currentGuess}
            maxGuesses={board.maxGuesses}
            evaluations={evaluations}
            solution={board.solution}
            showSolution={board.status === GameStatus.LOST}
            darkMode
            isInvalidWord={currentGuess.length === 5 && !isValidWord(currentGuess)}
          />
        </div>
      );
    } else if (isSequential) {
      return (
        <div className="grid grid-cols-2 gap-2 w-full h-full max-w-lg mx-auto">
          {state.boards.map((board, idx) => (
            <GauntletSequenceMiniBoard
              key={idx}
              board={board}
              boardIndex={idx}
              isActive={idx === sequenceActiveBoardIndex}
              isCompleted={board.status === GameStatus.WON}
              isFailed={board.status === GameStatus.LOST}
              isLocked={idx !== sequenceActiveBoardIndex && board.status === GameStatus.PLAYING}
              currentGuess={idx === sequenceActiveBoardIndex ? currentGuess : ''}
              isInvalidWord={idx === sequenceActiveBoardIndex && currentGuess.length === 5 && !isValidWord(currentGuess)}
            />
          ))}
        </div>
      );
    } else {
      return (
        <MultiBoard
          boards={state.boards}
          currentGuess={currentGuess}
          isInvalidWord={currentGuess.length === 5 && !isValidWord(currentGuess)}
        />
      );
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Progress Bar + Stage Header */}
      <div className="shrink-0">
        <GauntletProgress
          stages={gauntlet.stages}
          currentStage={gauntlet.currentStage}
          stageResults={gauntlet.stageResults}
        />
        <GauntletStageHeader stage={currentStageConfig} />
      </div>

      {/* Opponent HUD */}
      <div className="flex justify-center px-4 mb-1">
        <OpponentHUD
          attempts={opponentProgress.attempts}
          boardsSolved={opponentProgress.boardsSolved}
          totalBoards={opponentProgress.totalBoards}
          currentStage={opponentProgress.currentStage}
        />
      </div>

      {/* Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute left-0 right-0 z-20 flex justify-center"
            style={{ top: '180px' }}
          >
            <span className="bg-black/70 text-white font-bold px-4 py-2 rounded-lg text-sm shadow-lg">
              {message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Area */}
      <div className="flex-1 flex items-center justify-center px-4 min-h-0">
        {renderGameArea()}
      </div>

      {/* Keyboard */}
      <div className="shrink-0 pb-2 px-2">
        <Keyboard
          onKey={handleKey}
          letterStates={letterStates}
          boardLetterStates={boardLetterStates}
        />
      </div>

      {/* Stage Transition Overlay */}
      <AnimatePresence>
        {showTransition && (
          <StageTransition
            completedStage={currentStageConfig}
            nextStage={gauntlet.currentStage + 1 < gauntlet.totalStages
              ? gauntlet.stages[gauntlet.currentStage + 1]
              : null
            }
            onComplete={handleTransitionComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function GauntletSequenceMiniBoard({
  board,
  boardIndex,
  isActive,
  isCompleted,
  isFailed,
  isLocked,
  currentGuess,
  isInvalidWord,
}: {
  board: { solution: string; guesses: string[]; maxGuesses: number; status: string };
  boardIndex: number;
  isActive: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  isLocked: boolean;
  currentGuess: string;
  isInvalidWord?: boolean;
}) {
  const evalGuess = (guess: string, solution: string): TileState[] => {
    const result: TileState[] = Array(5).fill(TileState.EMPTY);
    const solutionArr = solution.split('');
    const guessArr = guess.split('');
    const used = Array(5).fill(false);

    guessArr.forEach((letter, i) => {
      if (letter === solutionArr[i]) { result[i] = TileState.CORRECT; used[i] = true; }
    });
    guessArr.forEach((letter, i) => {
      if (result[i] === TileState.EMPTY) {
        const f = solutionArr.findIndex((l, idx) => l === letter && !used[idx]);
        if (f !== -1) { result[i] = TileState.PRESENT; used[f] = true; }
        else { result[i] = TileState.ABSENT; }
      }
    });
    return result;
  };

  const getTileColor = (state: TileState) => {
    switch (state) {
      case TileState.CORRECT: return 'bg-green-600 border-green-400';
      case TileState.PRESENT: return 'bg-yellow-500 border-yellow-300';
      case TileState.ABSENT: return 'bg-zinc-700 border-zinc-600';
      default: return 'bg-zinc-800 border-zinc-600';
    }
  };

  const showColors = isActive || isCompleted || isFailed;
  const allGuesses = [...board.guesses];
  if (isActive && currentGuess.length > 0 && board.guesses.length < board.maxGuesses) {
    allGuesses.push(currentGuess);
  }

  return (
    <div
      className={`relative p-1 rounded-lg border-2 h-full flex flex-col transition-all duration-300 ${
        isCompleted
          ? 'border-green-400 bg-green-900/20'
          : isFailed
          ? 'border-red-400 bg-red-900/20'
          : isActive
          ? 'border-yellow-400 bg-zinc-900/50 shadow-lg shadow-yellow-500/20'
          : 'border-zinc-700/50 bg-zinc-900/30 opacity-60'
      }`}
    >
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Lock className="w-8 h-8 text-zinc-500/50" />
        </div>
      )}

      <div className="flex flex-col gap-[2px] flex-1">
        {Array.from({ length: board.maxGuesses }).map((_, rowIndex) => {
          const guess = allGuesses[rowIndex] || '';
          const isPastGuess = rowIndex < board.guesses.length;
          const isCurrentRow = rowIndex === board.guesses.length && isActive;
          const tiles = isPastGuess && showColors
            ? evalGuess(guess, board.solution)
            : Array(5).fill(TileState.EMPTY);

          return (
            <div key={rowIndex} className="flex gap-[2px] flex-1">
              {Array.from({ length: 5 }).map((_, letterIndex) => {
                const letter = guess[letterIndex] || '';
                const tileState = tiles[letterIndex];

                return (
                  <div
                    key={letterIndex}
                    className={`flex-1 flex items-center justify-center border rounded text-white font-bold text-[10px] sm:text-xs ${
                      isCurrentRow && isInvalidWord && letter
                        ? 'bg-red-900/40 border-red-400 text-red-400'
                        : isPastGuess && showColors
                        ? getTileColor(tileState)
                        : isPastGuess && !showColors
                        ? 'bg-zinc-700/50 border-zinc-600/50'
                        : letter
                        ? 'bg-zinc-800 border-zinc-500'
                        : 'bg-zinc-800/50 border-zinc-700/30'
                    }`}
                  >
                    {(showColors || isCurrentRow || (isPastGuess && !isLocked)) ? letter.toUpperCase() : isPastGuess ? '\u2022' : ''}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {isFailed && (
        <div className="text-center text-xs text-red-300 mt-1 font-bold">
          {board.solution.toUpperCase()}
        </div>
      )}
    </div>
  );
}
