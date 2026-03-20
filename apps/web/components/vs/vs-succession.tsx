'use client';

import { useReducer, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GameMode, GameStatus, gameReducer, initializeGame, isValidWord, evaluateGuess, TileState } from '@wordle-duel/core';
import { Keyboard } from '@/components/game/keyboard';
import { OpponentHUD } from './opponent-hud';
import { Trophy, Clock, Lock } from 'lucide-react';
import type { VsGameComponentProps } from './vs-classic';

const BOARD_ORDER = [0, 1, 2, 3];

export function VsSuccession({ seed, mode, onBoardSolved, onCompleted, opponentProgress, startTime }: VsGameComponentProps) {
  const [state, dispatch] = useReducer(
    gameReducer,
    initializeGame(seed, GameMode.SEQUENCE)
  );

  const [currentGuess, setCurrentGuess] = useState('');
  const [error, setError] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [hasReported, setHasReported] = useState(false);
  const prevSolvedRef = useRef(0);

  const activeBoardIndex = useMemo(() => {
    for (const idx of BOARD_ORDER) {
      if (state.boards[idx]?.status === GameStatus.PLAYING) return idx;
    }
    return -1;
  }, [state.boards]);

  useEffect(() => {
    if (state.status === 'PLAYING') {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.status, startTime]);

  // Track board solves
  useEffect(() => {
    const solvedCount = state.boards.filter(b => b.status === GameStatus.WON).length;
    if (solvedCount > prevSolvedRef.current) {
      for (let i = prevSolvedRef.current; i < solvedCount; i++) {
        onBoardSolved(i);
      }
      prevSolvedRef.current = solvedCount;
    }
  }, [state.boards, onBoardSolved]);

  // Report completion
  useEffect(() => {
    if (hasReported) return;
    if (state.status === GameStatus.WON || state.status === GameStatus.LOST) {
      setHasReported(true);
      const totalGuesses = state.boards[0]?.guesses.length || 0;
      onCompleted(state.status === GameStatus.WON ? 'won' : 'lost', totalGuesses, Date.now() - startTime);
    }
  }, [state.status, hasReported, state.boards, startTime, onCompleted]);

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

      // Submit guess to ALL playing boards (same as solo sequence)
      state.boards.forEach((board, index) => {
        if (board.status === GameStatus.PLAYING) {
          dispatch({ type: 'SUBMIT_GUESS', guess: currentGuess, boardIndex: index });
        }
      });
      setCurrentGuess('');
    } else if (key === 'BACK' || key === 'BACKSPACE') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (currentGuess.length < 5 && /^[A-Z]$/.test(key)) {
      setCurrentGuess(prev => prev + key);
    }
  }, [state, currentGuess]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') handleKeyPress('ENTER');
      else if (e.key === 'Backspace') handleKeyPress('BACK');
      else if (/^[a-zA-Z]$/.test(e.key)) handleKeyPress(e.key.toUpperCase());
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const solvedCount = state.boards.filter(b => b.status === GameStatus.WON).length;
  const guessesUsed = state.boards[0]?.guesses.length || 0;
  const maxGuesses = state.boards[0]?.maxGuesses || 10;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="text-center py-2 px-2 shrink-0">
        <div className="flex justify-center gap-3 mt-1">
          <span className="text-white/70 text-xs font-bold"><Trophy className="w-3 h-3 inline mr-1 text-yellow-400" />{solvedCount}/4</span>
          <span className="text-white/70 text-xs font-bold">{guessesUsed}/{maxGuesses} guesses</span>
          <span className="text-white/70 text-xs font-bold"><Clock className="w-3 h-3 inline mr-1 text-blue-400" />{formatTime(elapsedTime)}</span>
        </div>
        {error && <div className="absolute left-0 right-0 z-20 text-center" style={{ top: '90px' }}><span className="bg-black/70 text-white text-xs font-bold px-3 py-1 rounded-lg">{error}</span></div>}
      </div>

      {/* Opponent HUD */}
      <div className="flex justify-center px-4 mb-1">
        <OpponentHUD
          attempts={opponentProgress.attempts}
          boardsSolved={opponentProgress.boardsSolved}
          totalBoards={opponentProgress.totalBoards}
        />
      </div>

      {/* 2x2 Board Grid */}
      <div className="flex-1 min-h-0 px-2 pb-1">
        <div className="grid grid-cols-2 gap-2 w-full h-full max-w-lg mx-auto">
          {BOARD_ORDER.map((boardIdx) => {
            const board = state.boards[boardIdx];
            if (!board) return null;

            const isActive = boardIdx === activeBoardIndex;
            const isCompleted = board.status === GameStatus.WON;
            const isFailed = board.status === GameStatus.LOST;
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
              />
            );
          })}
        </div>
      </div>

      {/* Keyboard */}
      <div className="shrink-0 pb-2 px-2">
        <Keyboard onKey={handleKeyPress} letterStates={letterStates} />
      </div>
    </div>
  );
}

function SequenceMiniBoard({
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
        const foundIndex = solutionArr.findIndex((l, idx) => l === letter && !used[idx]);
        if (foundIndex !== -1) { result[i] = TileState.PRESENT; used[foundIndex] = true; }
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
      className={`relative p-1 rounded-lg border-2 transition-all duration-300 h-full flex flex-col ${
        isCompleted
          ? 'border-green-400 bg-green-900/20 shadow-lg shadow-green-500/20'
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
                const hasLetter = letter !== '';

                return (
                  <div
                    key={letterIndex}
                    className={`
                      flex-1 flex items-center justify-center
                      border rounded text-white font-bold text-[10px] sm:text-xs
                      ${isPastGuess && showColors
                        ? getTileColor(tileState)
                        : isPastGuess && !showColors
                        ? 'bg-zinc-700/50 border-zinc-600/50'
                        : hasLetter
                        ? 'bg-zinc-800 border-zinc-500'
                        : 'bg-zinc-800/50 border-zinc-700/30'
                      }
                    `}
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
