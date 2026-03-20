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
import { MultiBoard, computeActiveLetterStates } from '@/components/game/multi-board';
import { Keyboard } from '@/components/game/keyboard';
import { VictoryAnimation } from '@/components/effects/victory-animation';
import { GauntletProgress, GauntletStageHeader } from './gauntlet-progress';
import { StageTransition } from './stage-transition';
import { GauntletResults } from './gauntlet-results';

const BLACKOUT_DURATION_MS = 15_000;
const BLACKOUT_LETTER_COUNT = 3;
const ALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function generateSeed(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

function pickBlackoutLetters(
  letterStates: Record<string, 'correct' | 'present' | 'absent'>,
  count: number
): string[] {
  // Pick random letters that haven't been confirmed correct/present
  const candidates = ALL_LETTERS.filter(
    l => letterStates[l] !== 'correct' && letterStates[l] !== 'present'
  );
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function GauntletGame() {
  const [seed, setSeed] = useState(generateSeed);
  const [state, dispatch] = useReducer(gameReducer, initializeGame(seed, GameMode.GAUNTLET));
  const [currentGuess, setCurrentGuess] = useState('');
  const [message, setMessage] = useState('');
  const [showTransition, setShowTransition] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [gameStartTime] = useState(Date.now());

  // Letter Blackout state
  const [blackedOutLetters, setBlackedOutLetters] = useState<Set<string>>(new Set());
  const [blackoutBoardIndex, setBlackoutBoardIndex] = useState<number | null>(null);
  const [blackoutTimeLeft, setBlackoutTimeLeft] = useState(0);
  const blackoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const blackoutCountdownRef = useRef<NodeJS.Timeout | null>(null);

  // Stolen Guess visual feedback
  const [showStolenGuess, setShowStolenGuess] = useState(false);

  const gauntlet = state.gauntlet!;
  const currentStageConfig = gauntlet.stages[gauntlet.currentStage];
  const isSequential = currentStageConfig.sequential;
  const isSingleBoard = currentStageConfig.boardCount === 1;
  const isInBlackout = blackoutBoardIndex !== null;

  // For sequence stages, track the active board (first unsolved in order)
  const sequenceActiveBoardIndex = useMemo(() => {
    if (!isSequential) return -1;
    for (let i = 0; i < state.boards.length; i++) {
      if (state.boards[i]?.status === GameStatus.PLAYING) return i;
    }
    return -1;
  }, [isSequential, state.boards]);

  // Build letter states only from boards still in play (+ completed boards for sequence hints)
  const letterStates = useMemo(() => {
    if (isSequential) {
      // For sequence: show hints from active board + completed boards (not locked future boards)
      const states: Record<string, 'correct' | 'present' | 'absent'> = {};
      for (let i = 0; i < state.boards.length; i++) {
        const board = state.boards[i];
        const isActive = i === sequenceActiveBoardIndex;
        const isCompleted = board.status === GameStatus.WON;
        if (!isActive && !isCompleted) continue;

        for (const guess of board.guesses) {
          const result = evaluateGuess(board.solution, guess);
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

  // Evaluations for single-board view
  const currentBoard = state.boards[state.currentBoardIndex];
  const evaluations = useMemo(() => {
    if (!currentBoard) return [];
    return currentBoard.guesses.map(g => evaluateGuess(currentBoard.solution, g));
  }, [currentBoard]);

  // Detect board failure → trigger Letter Blackout
  // Uses a ref to track whether we've already triggered for this failure,
  // so the effect doesn't depend on letterStates (which would cause cleanup/restart).
  const blackoutTriggeredRef = useRef(false);

  useEffect(() => {
    if (state.status !== GameStatus.PLAYING) return;
    if (blackoutTriggeredRef.current) return; // Already handling a blackout

    const failedIndex = state.boards.findIndex(b => b.status === GameStatus.LOST);
    if (failedIndex === -1) return;

    // Mark as triggered so re-renders don't restart timers
    blackoutTriggeredRef.current = true;

    // Start blackout
    const letters = pickBlackoutLetters(letterStates, BLACKOUT_LETTER_COUNT);
    setBlackedOutLetters(new Set(letters));
    setBlackoutBoardIndex(failedIndex);
    setBlackoutTimeLeft(BLACKOUT_DURATION_MS / 1000);
    setCurrentGuess('');
    setMessage('LETTER BLACKOUT! Board restarting...');

    // Countdown timer (visual)
    const countdownId = setInterval(() => {
      setBlackoutTimeLeft(prev => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    blackoutCountdownRef.current = countdownId;

    // Main blackout timer — restart board after duration
    const timerId = setTimeout(() => {
      clearInterval(countdownId);
      dispatch({ type: 'BLACKOUT_RESTART', boardIndex: failedIndex });
      setBlackedOutLetters(new Set());
      setBlackoutBoardIndex(null);
      setBlackoutTimeLeft(0);
      setMessage('');
      blackoutTriggeredRef.current = false;
    }, BLACKOUT_DURATION_MS);
    blackoutTimerRef.current = timerId;

    return () => {
      clearTimeout(timerId);
      clearInterval(countdownId);
      blackoutTriggeredRef.current = false;
    };
  }, [state.boards, state.status]);

  // Check for stage completion
  useEffect(() => {
    if (state.status !== GameStatus.PLAYING) return;
    if (isInBlackout) return;

    const allBoardsDone = state.boards.every(b => b.status !== GameStatus.PLAYING);
    const allBoardsWon = state.boards.every(b => b.status === GameStatus.WON);

    if (allBoardsDone && allBoardsWon) {
      setShowTransition(true);
    }
  }, [state.boards, state.status, isInBlackout]);

  // Check for game over
  useEffect(() => {
    if (state.status === GameStatus.WON) {
      setShowVictory(true);
    } else if (state.status === GameStatus.LOST) {
      setShowResults(true);
    }
  }, [state.status]);

  const handleKey = useCallback((key: string) => {
    if (state.status !== GameStatus.PLAYING) return;
    if (showTransition || isInBlackout) return;

    // Block blacked-out letters
    if (blackedOutLetters.has(key)) return;

    if (key === 'ENTER') {
      if (currentGuess.length !== 5) {
        setMessage('Not enough letters');
        setTimeout(() => setMessage(''), 1500);
        return;
      }

      if (!isValidWord(currentGuess)) {
        setMessage('Not in word list');
        setTimeout(() => setMessage(''), 1500);
        return;
      }

      if (isSingleBoard) {
        dispatch({ type: 'SUBMIT_GUESS', guess: currentGuess, boardIndex: state.currentBoardIndex });
      } else {
        // For quordle, sequence, octordle, rescue — submit to all playing boards
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
  }, [state, currentGuess, showTransition, isSingleBoard, isInBlackout, blackedOutLetters]);

  // Keyboard event listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Enter') {
        handleKey('ENTER');
      } else if (e.key === 'Backspace') {
        handleKey('BACK');
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleKey(e.key.toUpperCase());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKey]);

  const handleTransitionComplete = useCallback(() => {
    setShowTransition(false);
    dispatch({ type: 'NEXT_STAGE' });
    setCurrentGuess('');
  }, []);

  const handleVictoryComplete = useCallback(() => {
    setShowVictory(false);
    setShowResults(true);
  }, []);

  const handlePlayAgain = useCallback(() => {
    const newSeed = generateSeed();
    setSeed(newSeed);
    dispatch({ type: 'RESET', seed: newSeed, mode: GameMode.GAUNTLET });
    setCurrentGuess('');
    setMessage('');
    setShowTransition(false);
    setShowVictory(false);
    setShowResults(false);
    setBlackedOutLetters(new Set());
    setBlackoutBoardIndex(null);
    setBlackoutTimeLeft(0);
    blackoutTriggeredRef.current = false;
    if (blackoutTimerRef.current) clearTimeout(blackoutTimerRef.current);
    if (blackoutCountdownRef.current) clearInterval(blackoutCountdownRef.current);
  }, []);

  const handleHome = useCallback(() => {
    window.location.href = '/';
  }, []);

  // Public method for multiplayer: opponent completed a stage ahead
  // (Will be wired up when multiplayer gauntlet is implemented)
  const handleStolenGuess = useCallback(() => {
    dispatch({ type: 'STEAL_GUESS' });
    setShowStolenGuess(true);
    setMessage('STOLEN GUESS! Opponent cleared a stage first!');
    setTimeout(() => {
      setShowStolenGuess(false);
      setMessage('');
    }, 3000);
  }, []);

  // Show results screen
  if (showResults) {
    return (
      <GauntletResults
        won={state.status === GameStatus.WON}
        stages={gauntlet.stages}
        stageResults={gauntlet.stageResults}
        totalTimeMs={Date.now() - gameStartTime}
        onPlayAgain={handlePlayAgain}
        onHome={handleHome}
      />
    );
  }

  // Determine which board component to render
  const renderGameArea = () => {
    if (isSingleBoard) {
      const board = state.boards[state.currentBoardIndex];
      if (!board) return null;

      return (
        <div className="flex flex-col items-center gap-1 w-full justify-center">
          <Board
            guesses={board.guesses}
            currentGuess={isInBlackout ? '' : currentGuess}
            maxGuesses={board.maxGuesses}
            evaluations={evaluations}
            solution={board.solution}
            showSolution={board.status === GameStatus.LOST}
            darkMode
          />
        </div>
      );
    } else if (isSequential) {
      // Sequence-style 2x2 grid with sequential board unlocking
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
              currentGuess={idx === sequenceActiveBoardIndex && !isInBlackout ? currentGuess : ''}
            />
          ))}
        </div>
      );
    } else {
      return (
        <MultiBoard
          boards={state.boards}
          currentGuess={isInBlackout ? '' : currentGuess}
        />
      );
    }
  };

  return (
    <div className="h-[100dvh] bg-gradient-to-br from-purple-900 via-pink-800 to-orange-700 flex flex-col">
      {/* Progress Bar + Stage Header */}
      <div className="shrink-0">
        <GauntletProgress
          stages={gauntlet.stages}
          currentStage={gauntlet.currentStage}
          stageResults={gauntlet.stageResults}
        />
        <GauntletStageHeader stage={currentStageConfig} />
      </div>

      {/* Message / Blackout Warning */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="text-center"
          >
            <span className={`backdrop-blur-sm font-bold px-4 py-2 rounded-lg text-sm ${
              isInBlackout
                ? 'bg-red-500/30 text-red-200 border border-red-400/40'
                : showStolenGuess
                  ? 'bg-orange-500/30 text-orange-200 border border-orange-400/40'
                  : 'bg-white/20 text-white'
            }`}>
              {message}
              {isInBlackout && blackoutTimeLeft > 0 && (
                <span className="ml-2 font-mono">{blackoutTimeLeft}s</span>
              )}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stolen Guess Flash */}
      <AnimatePresence>
        {showStolenGuess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.3, 0] }}
            transition={{ duration: 0.6, times: [0, 0.3, 1] }}
            className="fixed inset-0 bg-orange-500 pointer-events-none z-40"
          />
        )}
      </AnimatePresence>

      {/* Blackout Screen Overlay */}
      <AnimatePresence>
        {isInBlackout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-30"
          >
            <div className="absolute inset-0 bg-red-900/20 animate-pulse" />
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <div className="text-center space-y-2">
                <div className="text-6xl font-black text-red-400 animate-pulse">
                  {blackoutTimeLeft}
                </div>
                <div className="text-red-300/70 text-sm font-bold uppercase tracking-wider">
                  Letters Blacked Out
                </div>
              </div>
            </motion.div>
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
          blackedOutLetters={blackedOutLetters.size > 0 ? blackedOutLetters : undefined}
        />
      </div>

      {/* Overlays */}
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

      <AnimatePresence>
        {showVictory && (
          <VictoryAnimation onComplete={handleVictoryComplete} />
        )}
      </AnimatePresence>
    </div>
  );
}

// Mini board for sequence stages in gauntlet — 2x2 grid with sequential unlock
function GauntletSequenceMiniBoard({
  board,
  boardIndex,
  isActive,
  isCompleted,
  isFailed,
  isLocked,
  currentGuess,
}: {
  board: { solution: string; guesses: string[]; maxGuesses: number; status: string };
  boardIndex: number;
  isActive: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  isLocked: boolean;
  currentGuess: string;
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
      {/* Board number / status */}
      <div className={`absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10 ${
        isCompleted ? 'bg-green-500 text-white' :
        isActive ? 'bg-yellow-400 text-black' :
        'bg-zinc-700 text-zinc-400'
      }`}>
        {isCompleted ? '✓' : boardIndex + 1}
      </div>

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
                      isPastGuess && showColors
                        ? getTileColor(tileState)
                        : isPastGuess && !showColors
                        ? 'bg-zinc-700/50 border-zinc-600/50'
                        : letter
                        ? 'bg-zinc-800 border-zinc-500'
                        : 'bg-zinc-800/50 border-zinc-700/30'
                    }`}
                  >
                    {(showColors || isCurrentRow || (isPastGuess && !isLocked)) ? letter.toUpperCase() : isPastGuess ? '•' : ''}
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
