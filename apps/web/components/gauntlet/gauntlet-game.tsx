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
import { VictoryAnimation } from '@/components/effects/victory-animation';
import { GauntletProgress, GauntletStageHeader } from './gauntlet-progress';
import { StageTransition } from './stage-transition';
import { GauntletResults } from './gauntlet-results';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult, type XpResult } from '@/lib/stats-service';
import { XpToast } from '@/components/effects/xp-toast';
import { recordModePlayed } from '@/lib/play-limit-service';
import { loadGameSession, useGameSnapshot } from '@/hooks/use-game-snapshot';

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

interface GauntletGameProps {
  initialSeed?: string;
  isDaily?: boolean;
}

export function GauntletGame({ initialSeed, isDaily }: GauntletGameProps = {}) {
  const { profile, isProActive } = useAuth();
  const isPro = isProActive;
  // Attempt to restore any previously saved mid-game session. Captured in
  // state so the value is stable across re-renders but only computed once on
  // mount — subsequent gets don't hit localStorage.
  const [savedSession] = useState(() => loadGameSession(GameMode.GAUNTLET, !!isDaily));
  const [seed, setSeed] = useState(() => savedSession?.seed ?? initialSeed ?? generateSeed());
  const [state, dispatch] = useReducer(
    gameReducer,
    seed,
    (s) => savedSession?.state ?? initializeGame(s, GameMode.GAUNTLET)
  );
  const [currentGuess, setCurrentGuess] = useState('');
  const [message, setMessage] = useState('');
  const [showTransition, setShowTransition] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  // When a completed session is restored, skip straight to GauntletResults —
  // we don't want to replay the intermediate VictoryAnimation modal, and we
  // definitely don't want to re-record the game stats.
  const [showResults, setShowResults] = useState(() => savedSession?.isCompleted ?? false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);
  const [elapsedTime, setElapsedTime] = useState(() => savedSession?.elapsedTime ?? 0);
  const startTimeRef = useRef(Date.now() - (savedSession?.elapsedTime ?? 0) * 1000);
  // Flag so the game-over effect below doesn't refire victory/loss animations
  // or double-record stats when a completed save is loaded on mount. Reset in
  // handlePlayAgain so a fresh run behaves normally.
  const isRestoredCompletedRef = useRef(savedSession?.isCompleted ?? false);

  // Persistence hook — snapshots the full reducer state to localStorage on
  // every change, and clears on game-end. This lets the user navigate away
  // and return mid-stage without losing progress.
  useGameSnapshot(GameMode.GAUNTLET, !!isDaily, seed, state, elapsedTime);

  // Running timer
  useEffect(() => {
    if (state.status === GameStatus.PLAYING && !showTransition) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.status, showTransition]);

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

  // Build letter states only from boards still in play
  const letterStates = useMemo(() => {
    if (isSequential && sequenceActiveBoardIndex >= 0) {
      // For sequence: show hints ONLY from the active board's perspective
      // All previous guesses are evaluated against the ACTIVE board's solution
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

  // Per-board letter states for quadrant keyboard (multi-board, non-sequential stages)
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

  // Check for game over. Suppressed when the session was restored as already
  // completed — we don't want to replay animations or re-record a win the user
  // already has in their stats.
  useEffect(() => {
    if (isRestoredCompletedRef.current) return;
    if (state.status === GameStatus.WON) {
      setShowVictory(true);
    } else if (state.status === GameStatus.LOST) {
      setShowResults(true);
    }
    if (profile && (state.status === GameStatus.WON || state.status === GameStatus.LOST)) {
      // Use the frozen elapsedTime (timer stops ticking when the stage ends)
      // so this exactly matches the VictoryAnimation and GauntletResults
      // numbers the player sees.
      const timeMs = elapsedTime * 1000;
      // Sum across completed stages. On WON the final NEXT_STAGE has already
      // pushed the last stage into stageResults, so state.boards would be a
      // double-count. On LOST the current stage isn't yet in stageResults, so
      // add its max-across-boards count.
      const completedStageGuesses = state.gauntlet?.stageResults.reduce((sum, r) => sum + r.guesses, 0) ?? 0;
      const currentStageGuesses = state.status === GameStatus.LOST
        ? state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0)
        : 0;
      const totalGuesses = completedStageGuesses + currentStageGuesses;
      const boardsSolved = state.boards.filter(b => b.status === GameStatus.WON).length;
      recordGameResult(profile.id, 'GAUNTLET', 'solo', state.status === GameStatus.WON, totalGuesses, timeMs, seed, boardsSolved, 21).then(xp => { if (xp) setXpResult(xp); });
    }
    if (state.status === GameStatus.WON || state.status === GameStatus.LOST) {
      recordModePlayed('gauntlet');
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
    setElapsedTime(0);
    startTimeRef.current = Date.now();
    blackoutTriggeredRef.current = false;
    // Re-enable the game-over effect for this fresh run. The ref was set on
    // mount if the session was already completed; clearing it here lets
    // VictoryAnimation / stat-recording fire normally when the new run ends.
    isRestoredCompletedRef.current = false;
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

  // The XpToast is lifted out of the main-view JSX into a fragment that
  // wraps BOTH the results screen and the playing view so it survives the
  // showResults transition. Previously it lived inside the playing-view
  // return and the `if (showResults)` early-return unmounted the main tree
  // before the toast could render — so on LOSS it never appeared at all,
  // and on WIN it flashed only during VictoryAnimation before
  // GauntletResults replaced the tree. The `key` prop resets the 3s
  // auto-dismiss timer on the results-screen transition so the player
  // still sees the toast after they dismiss VictoryAnimation.
  const xpToast = xpResult ? (
    <XpToast
      key={showResults ? 'results' : 'playing'}
      xp={xpResult.xpGain}
      streakBonus={xpResult.streakBonus}
      dailyBonus={xpResult.dailyBonus}
      leveledUp={xpResult.leveledUp}
      newLevel={xpResult.newLevel}
    />
  ) : null;

  // Show results screen
  if (showResults) {
    return (
      <>
        {xpToast}
        <GauntletResults
          won={state.status === GameStatus.WON}
          stages={gauntlet.stages}
          stageResults={gauntlet.stageResults}
          totalTimeMs={elapsedTime * 1000}
          onPlayAgain={handlePlayAgain}
          onHome={handleHome}
          showPlayAgain={!isDaily && isPro}
        />
      </>
    );
  }

  // Determine which board component to render
  const renderGameArea = () => {
    if (isSingleBoard) {
      const board = state.boards[state.currentBoardIndex];
      if (!board) return null;

      return (
        <div className="flex flex-col items-center gap-1 w-full h-full justify-center">
          <Board
            guesses={board.guesses}
            currentGuess={isInBlackout ? '' : currentGuess}
            maxGuesses={board.maxGuesses}
            evaluations={evaluations}
            solution={board.solution}
            showSolution={board.status === GameStatus.LOST}
            darkMode
            isInvalidWord={!isInBlackout && currentGuess.length === 5 && !isValidWord(currentGuess)}
          />
        </div>
      );
    } else if (isSequential) {
      // Sequence-style 2x2 grid with sequential board unlocking
      return (
        <div className="grid grid-cols-2 grid-rows-2 gap-2 w-full h-full max-w-lg mx-auto">
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
              isInvalidWord={idx === sequenceActiveBoardIndex && !isInBlackout && currentGuess.length === 5 && !isValidWord(currentGuess)}
            />
          ))}
        </div>
      );
    } else {
      return (
        <MultiBoard
          boards={state.boards}
          currentGuess={isInBlackout ? '' : currentGuess}
          isInvalidWord={!isInBlackout && currentGuess.length === 5 && !isValidWord(currentGuess)}
        />
      );
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col relative" style={{ backgroundColor: '#f8f7ff' }}>
      {/* Progress Bar + Stage Header */}
      <div className="shrink-0">
        <GauntletProgress
          stages={gauntlet.stages}
          currentStage={gauntlet.currentStage}
          stageResults={gauntlet.stageResults}
        />
        <GauntletStageHeader
          stage={currentStageConfig}
          elapsedTime={elapsedTime}
          boardsSolved={state.boards.filter(b => b.status === GameStatus.WON).length}
          totalBoards={currentStageConfig.boardCount}
          guessesUsed={state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0)}
          maxGuesses={currentStageConfig.maxGuesses}
        />
      </div>

      {/* Message / Blackout Warning — absolutely positioned so it doesn't shift layout */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute left-0 right-0 z-20 flex justify-center"
            style={{ top: '140px' }}
          >
            <span className={`backdrop-blur-sm font-bold px-4 py-2 rounded-lg text-sm shadow-lg ${
              isInBlackout
                ? 'bg-red-500/30 text-red-200 border border-red-400/40'
                : showStolenGuess
                  ? 'bg-orange-500/30 text-orange-200 border border-orange-400/40'
                  : 'bg-gray-800 text-white'
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
            className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/40 animate-pulse" />
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="relative z-10"
            >
              <div className="text-center space-y-3">
                <div className="text-9xl font-black text-red-400 drop-shadow-[0_0_30px_rgba(248,113,113,0.6)] animate-pulse">
                  {blackoutTimeLeft}
                </div>
                <div className="text-red-300 text-lg font-bold uppercase tracking-widest">
                  Letters Blacked Out
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Area */}
      <div className={`flex-1 min-h-0 px-1 pb-1 ${isSingleBoard ? 'flex items-center justify-center' : ''}`}>
        {renderGameArea()}
      </div>

      {/* Keyboard — hidden when game is complete so the VictoryAnimation /
          final Results sit over a clean canvas, matching standalone modes. */}
      {state.status === GameStatus.PLAYING && (
        <div className="shrink-0 pb-2 px-2 pt-1">
          <Keyboard
            onKey={handleKey}
            letterStates={letterStates}
            boardLetterStates={boardLetterStates}
            blackedOutLetters={blackedOutLetters.size > 0 ? blackedOutLetters : undefined}
          />
        </div>
      )}

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
          <VictoryAnimation
            onComplete={handleVictoryComplete}
            // Use frozen elapsedTime so the time shown here matches the
            // GauntletStageHeader clock at the moment of completion and the
            // GauntletResults screen that follows — all three must agree.
            timeSeconds={elapsedTime}
            // Show the 8 OctoWord solutions in board-position order. On WON
            // the reducer leaves state.boards as the final stage's boards
            // (the NEXT_STAGE action on the last stage only toggles status →
            // WON without rebuilding boards), so this matches how standalone
            // multi-board modes display their solutions. Full 21-word stage
            // breakdown is shown on the subsequent GauntletResults screen.
            solutions={state.boards.map(b => b.solution)}
          />
        )}
      </AnimatePresence>
      {xpToast}
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
      case TileState.CORRECT: return 'bg-green-600 border-green-600';
      case TileState.PRESENT: return 'bg-yellow-500 border-yellow-500';
      case TileState.ABSENT: return 'bg-gray-400 border-gray-400';
      default: return 'bg-white border-gray-300';
    }
  };

  const showColors = isActive || isCompleted || isFailed;

  const allGuesses = [...board.guesses];
  if (isActive && currentGuess.length > 0 && board.guesses.length < board.maxGuesses) {
    allGuesses.push(currentGuess);
  }

  return (
    <div
      className={`relative p-1 rounded-lg border-2 h-full flex flex-col transition-colors duration-300 overflow-hidden ${
        isCompleted
          ? 'border-green-400 bg-green-50'
          : isFailed
          ? 'border-red-400 bg-red-50'
          : isActive
          ? 'border-yellow-400 bg-white shadow-lg shadow-yellow-500/20'
          : 'border-gray-200 bg-gray-50 opacity-60'
      }`}
    >
      <div className="grid gap-[2px] flex-1" style={{ gridTemplateRows: `repeat(${board.maxGuesses}, 1fr)` }}>
        {Array.from({ length: board.maxGuesses }).map((_, rowIndex) => {
          const guess = allGuesses[rowIndex] || '';
          const isPastGuess = rowIndex < board.guesses.length;
          const isCurrentRow = rowIndex === board.guesses.length && isActive;
          const tiles = isPastGuess && showColors
            ? evalGuess(guess, board.solution)
            : Array(5).fill(TileState.EMPTY);

          return (
            <div key={rowIndex} className="grid grid-cols-5 gap-[2px] min-h-0">
              {Array.from({ length: 5 }).map((_, letterIndex) => {
                const letter = guess[letterIndex] || '';
                const tileState = tiles[letterIndex];

                return (
                  <div
                    key={letterIndex}
                    className={`flex items-center justify-center min-h-0 border rounded font-bold text-[10px] sm:text-xs ${
                      isCurrentRow && isInvalidWord && letter
                        ? 'bg-red-50 border-red-400 text-red-500'
                        : isPastGuess && showColors
                        ? `${getTileColor(tileState)} text-white`
                        : isPastGuess && !showColors
                        ? 'bg-gray-100 border-gray-300 text-gray-800'
                        : letter
                        ? 'bg-white border-gray-400 text-gray-800'
                        : 'bg-white border-gray-200'
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
