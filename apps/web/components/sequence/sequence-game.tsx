'use client';

import { useReducer, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GameMode, GameStatus, gameReducer, initializeGame, isValidWord, evaluateGuess, TileState } from '@wordle-duel/core';
import { Keyboard } from '../game/keyboard';
import Link from 'next/link';
import { VictoryAnimation } from '../effects/victory-animation';
import { GameOverAnimation } from '../effects/game-over-animation';
import { AnimatePresence } from 'framer-motion';
import { Trophy, Clock, ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult, type XpResult } from '@/lib/stats-service';
import { XpToast } from '@/components/effects/xp-toast';
import { recordModePlayed } from '@/lib/play-limit-service';
import { generateMultiBoardSummary, generateShareText, copyShareToClipboard } from '@/lib/share-utils';
import { useGamePersistence } from '@/hooks/use-game-persistence';

// Board order: TL(0) → TR(1) → BL(2) → BR(3)
const BOARD_ORDER = [0, 1, 2, 3];

interface SequenceGameProps {
  initialSeed?: string;
  isDaily?: boolean;
}

export function SequenceGame({ initialSeed, isDaily }: SequenceGameProps = {}) {
  const { profile } = useAuth();
  const isPro = (profile as any)?.is_pro ?? false;
  const [gameSeed] = useState(() => initialSeed || Date.now().toString());
  const [state, dispatch] = useReducer(
    gameReducer,
    initializeGame(gameSeed, GameMode.SEQUENCE)
  );

  const [currentGuess, setCurrentGuess] = useState('');
  const [error, setError] = useState('');
  const [showVictory, setShowVictory] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);

  const { isRestored, restoredElapsedTime } = useGamePersistence(GameMode.SEQUENCE, !!isDaily, gameSeed, state, dispatch, elapsedTime);
  const startTimeRef = useRef(state.startTime);

  useEffect(() => {
    if (restoredElapsedTime > 0) {
      startTimeRef.current = Date.now() - restoredElapsedTime * 1000;
      setElapsedTime(restoredElapsedTime);
    }
  }, [restoredElapsedTime]);

  // The active board is the first unsolved board in sequence order
  const activeBoardIndex = useMemo(() => {
    for (const idx of BOARD_ORDER) {
      if (state.boards[idx]?.status === GameStatus.PLAYING) return idx;
    }
    return -1; // all solved or lost
  }, [state.boards]);

  useEffect(() => {
    if (state.status === 'PLAYING') {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.status]);

  useEffect(() => {
    if (state.status === 'WON' && !isRestored) {
      setShowVictory(true);
      setStreak((prev) => prev + 1);
    } else if (state.status === 'LOST') {
      if (!isRestored) setShowGameOver(true);
      setStreak(0);
    }
    if (profile && !isRestored && (state.status === 'WON' || state.status === 'LOST')) {
      const timeMs = Date.now() - startTimeRef.current;
      const guesses = state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0);
      const boardsSolved = state.boards.filter(b => b.status === 'WON').length;
      recordGameResult(profile.id, 'SEQUENCE', 'solo', state.status === 'WON', guesses, timeMs, gameSeed, boardsSolved, 4).then(xp => { if (xp) setXpResult(xp); });
    }
    if (!isRestored && (state.status === 'WON' || state.status === 'LOST')) {
      recordModePlayed('sequence');
    }
  }, [state.status]);

  // Build letter states ONLY from the active board's perspective
  // Previous guesses are evaluated against the current active board's solution
  const letterStates = useMemo(() => {
    const states: Record<string, 'correct' | 'present' | 'absent'> = {};
    if (activeBoardIndex < 0) return states;

    const activeBoard = state.boards[activeBoardIndex];
    if (!activeBoard) return states;

    for (const guess of activeBoard.guesses) {
      const result = evaluateGuess(activeBoard.solution, guess);
      for (const tile of result.tiles) {
        const letter = tile.letter.toUpperCase();
        if (tile.state === 'CORRECT') states[letter] = 'correct';
        else if (tile.state === 'PRESENT' && states[letter] !== 'correct') states[letter] = 'present';
        else if (tile.state === 'ABSENT' && !states[letter]) states[letter] = 'absent';
      }
    }

    return states;
  }, [state.boards, activeBoardIndex]);

  const handleKeyPress = useCallback((key: string) => {
    if (state.status !== 'PLAYING') return;

    setError('');

    if (key === 'ENTER') {
      if (currentGuess.length !== 5) {
        setError('Word must be 5 letters');
        setCurrentGuess('');
        setTimeout(() => setError(''), 1500);
        return;
      }

      if (!isValidWord(currentGuess)) {
        setError('Not in word list');
        setCurrentGuess('');
        setTimeout(() => setError(''), 1500);
        return;
      }

      // Submit guess to ALL boards (like quordle)
      state.boards.forEach((board, index) => {
        if (board.status === GameStatus.PLAYING) {
          dispatch({ type: 'SUBMIT_GUESS', guess: currentGuess, boardIndex: index });
        }
      });

      setCurrentGuess('');
    } else if (key === 'BACK' || key === 'BACKSPACE') {
      setCurrentGuess((prev) => prev.slice(0, -1));
    } else if (currentGuess.length < 5 && /^[A-Z]$/.test(key)) {
      setCurrentGuess((prev) => prev + key);
    }
  }, [state, currentGuess]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') {
        handleKeyPress('ENTER');
      } else if (e.key === 'Backspace') {
        handleKeyPress('BACK');
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleKeyPress(e.key.toUpperCase());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleNextPuzzle = () => {
    dispatch({ type: 'RESET', seed: Date.now().toString(), mode: GameMode.SEQUENCE });
    setCurrentGuess('');
    setError('');
    setElapsedTime(0);
  };

  const solvedCount = state.boards.filter(b => b.status === GameStatus.WON).length;
  const guessesUsed = state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0);
  const maxGuesses = state.boards[0]?.maxGuesses || 10;

  const handleShare = useCallback(async () => {
    const summary = generateMultiBoardSummary(state.boards as any, () => []);
    const text = generateShareText({
      mode: 'Succession',
      won: state.status === 'WON',
      guesses: guessesUsed,
      maxGuesses,
      timeSeconds: elapsedTime,
      boardSummary: summary,
      boardsSolved: solvedCount,
      totalBoards: 4,
    });
    const ok = await copyShareToClipboard(text);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }, [state, guessesUsed, maxGuesses, elapsedTime, solvedCount]);

  return (
    <div className="h-[100dvh] flex flex-col relative" style={{ backgroundColor: '#f8f7ff' }}>
      <AnimatePresence>
        {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} guesses={guessesUsed} maxGuesses={maxGuesses} timeSeconds={elapsedTime} boardsSolved={solvedCount} totalBoards={4} solutions={state.boards.map(b => b.solution)} />}
        {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={guessesUsed} maxGuesses={maxGuesses} timeSeconds={elapsedTime} boardsSolved={solvedCount} totalBoards={4} solutions={state.boards.map(b => b.solution)} />}
      </AnimatePresence>
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      {/* Compact Header */}
      <div className="text-center py-2 px-2 shrink-0">
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400">
          SUCCESSION
        </h1>
        <div className="flex justify-center gap-3 mt-1">
          <span className="text-gray-400 text-xs font-bold"><Trophy className="w-3 h-3 inline mr-1 text-amber-600" />{solvedCount}/4</span>
          <span className="text-gray-400 text-xs font-bold">{guessesUsed}/{maxGuesses} guesses</span>
          <span className="text-gray-400 text-xs font-bold"><Clock className="w-3 h-3 inline mr-1 text-blue-400" />{formatTime(elapsedTime)}</span>
        </div>
        {error && <div className="absolute left-0 right-0 z-20 text-center" style={{ top: '90px' }}><span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-lg">{error}</span></div>}
        {state.status === 'WON' && (
          <div className="mt-1 flex flex-col items-center gap-1">
            <span className="text-green-600 text-xs font-bold">All 4 solved in {guessesUsed} guesses  ·  {formatTime(elapsedTime)}</span>
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 text-xs font-bold underline">Home</Link>
              <button onClick={handleShare} className="text-blue-500 text-xs font-bold underline">{copied ? 'Copied!' : 'Share'}</button>
              {!isDaily && isPro && <button onClick={handleNextPuzzle} className="text-amber-600 text-xs font-bold underline">Play Again</button>}
            </div>
          </div>
        )}
        {state.status === 'LOST' && (
          <div className="mt-1 flex flex-col items-center gap-1">
            <span className="text-red-300 text-xs font-bold">Boards Completed {solvedCount}/4</span>
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 text-xs font-bold underline">Home</Link>
              <button onClick={handleShare} className="text-blue-500 text-xs font-bold underline">{copied ? 'Copied!' : 'Share'}</button>
              {!isDaily && isPro && <button onClick={handleNextPuzzle} className="text-amber-600 text-xs font-bold underline">Try Again</button>}
            </div>
          </div>
        )}
      </div>

      {/* 2x2 Board Grid */}
      <div className="flex-1 min-h-0 px-2 pb-2">
        <div className="grid grid-cols-2 grid-rows-2 gap-2 w-full h-full max-w-lg mx-auto">
            {BOARD_ORDER.map((boardIdx) => {
              const board = state.boards[boardIdx];
              if (!board) return null;

              const isActive = boardIdx === activeBoardIndex;
              const isCompleted = board.status === GameStatus.WON;
              const isFailed = board.status === GameStatus.LOST;
              // A board is "locked" if it comes after the active board in sequence and isn't solved
              const isLocked = !isActive && !isCompleted && !isFailed;

              return (
                <SequenceMiniBoard
                  key={boardIdx}
                  board={board}
                  boardIndex={boardIdx}
                  isActive={isActive}
                  isCompleted={isCompleted}
                  isFailed={isFailed}
                  isLocked={isLocked}
                  currentGuess={isActive ? currentGuess : ''}
                  isInvalidWord={isActive && currentGuess.length === 5 && !isValidWord(currentGuess)}
                />
              );
            })}
          </div>
      </div>

      {/* Keyboard — hidden when game is complete */}
      {state.status === 'PLAYING' && (
        <div className="shrink-0 pb-2 px-2 pt-1">
          <Keyboard onKey={handleKeyPress} letterStates={letterStates} />
        </div>
      )}
    </div>
  );
}

// Mini board for sequence mode — shows/hides colors based on active state
function SequenceMiniBoard({
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
      if (letter === solutionArr[i]) {
        result[i] = TileState.CORRECT;
        used[i] = true;
      }
    });

    guessArr.forEach((letter, i) => {
      if (result[i] === TileState.EMPTY) {
        const foundIndex = solutionArr.findIndex((l, idx) => l === letter && !used[idx]);
        if (foundIndex !== -1) {
          result[i] = TileState.PRESENT;
          used[foundIndex] = true;
        } else {
          result[i] = TileState.ABSENT;
        }
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

  // Show colors only for active or completed boards
  const showColors = isActive || isCompleted || isFailed;

  const allGuesses = [...board.guesses];
  if (isActive && currentGuess.length > 0 && board.guesses.length < board.maxGuesses) {
    allGuesses.push(currentGuess);
  }

  return (
    <div
      className={`relative p-1 rounded-lg border-2 transition-colors duration-300 h-full flex flex-col overflow-hidden ${
        isCompleted
          ? 'border-green-400 bg-green-50 shadow-lg shadow-green-500/20'
          : isFailed
          ? 'border-red-400 bg-red-50'
          : isActive
          ? 'border-yellow-400 bg-white shadow-lg shadow-yellow-500/20'
          : 'border-gray-200 bg-gray-50 opacity-60'
      }`}
    >
      {/* Lock icon for locked boards */}
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Lock className="w-8 h-8 text-gray-300" />
        </div>
      )}

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
                const hasLetter = letter !== '';

                return (
                  <div
                    key={letterIndex}
                    className={`
                      flex items-center justify-center min-h-0
                      border rounded font-bold text-[10px] sm:text-xs
                      ${isCurrentRow && isInvalidWord && hasLetter
                        ? 'bg-red-50 border-red-400 text-red-500'
                        : isPastGuess && showColors
                        ? `${getTileColor(tileState)} text-white`
                        : isPastGuess && !showColors
                        ? 'bg-gray-100 border-gray-300 text-gray-800'
                        : hasLetter
                        ? 'bg-white border-gray-400 text-gray-800'
                        : 'bg-white border-gray-200'
                      }
                    `}
                  >
                    {(showColors || isCurrentRow || (isPastGuess && !isLocked)) ? letter.toUpperCase() : isPastGuess ? '•' : ''}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Show solution on failed boards */}
      {isFailed && (
        <div className="text-center text-xs text-red-300 mt-1 font-bold">
          {board.solution.toUpperCase()}
        </div>
      )}
    </div>
  );
}
