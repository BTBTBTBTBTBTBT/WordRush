'use client';

import { useReducer, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GameMode, GameStatus, gameReducer, initializeGame, isWordValid } from '@wordle-duel/core';
import { MultiBoard, computeActiveLetterStates, computePerBoardLetterStates } from '@/components/game/multi-board';
import { Keyboard } from '@/components/game/keyboard';
import { OpponentHUD } from './opponent-hud';
import { Trophy, Clock } from 'lucide-react';
import type { VsGameComponentProps } from './vs-classic';

export function VsDeliverance({ seed, mode, onBoardSolved, onCompleted, opponentProgress, startTime }: VsGameComponentProps) {
  const [state, dispatch] = useReducer(
    gameReducer,
    initializeGame(seed, GameMode.RESCUE)
  );

  const [currentGuess, setCurrentGuess] = useState('');
  const [error, setError] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [hasReported, setHasReported] = useState(false);
  const prevSolvedRef = useRef(0);

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
        const solvedIdx = state.boards.findIndex((b, idx) => b.status === GameStatus.WON && idx >= i);
        if (solvedIdx !== -1) onBoardSolved(solvedIdx);
      }
      prevSolvedRef.current = solvedCount;
    }
  }, [state.boards, onBoardSolved]);

  // Report completion
  useEffect(() => {
    if (hasReported) return;
    if (state.status === GameStatus.WON || state.status === GameStatus.LOST) {
      setHasReported(true);
      const guessesUsed = state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0);
      onCompleted(state.status === GameStatus.WON ? 'won' : 'lost', guessesUsed, Date.now() - startTime);
    }
  }, [state.status, hasReported, state.boards, startTime, onCompleted]);

  const handleKeyPress = useCallback((key: string) => {
    if (state.status !== 'PLAYING') return;
    setError('');

    if (key === 'ENTER') {
      if (currentGuess.length !== 5) { setError('Word must be 5 letters'); setCurrentGuess(''); setTimeout(() => setError(''), 1500); return; }
      if (!isWordValid(currentGuess)) { setError('Not in word list'); setCurrentGuess(''); setTimeout(() => setError(''), 1500); return; }

      state.boards.forEach((_, index) => {
        if (state.boards[index].status === 'PLAYING') {
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

  const letterStates = useMemo(() => computeActiveLetterStates(state.boards), [state.boards]);
  const boardLetterStates = useMemo(() => computePerBoardLetterStates(state.boards), [state.boards]);

  const completedBoards = state.boards.filter(b => b.status === 'WON').length;
  const guessesUsed = state.boards.reduce((max, board) => Math.max(max, board.guesses.length), 0);
  const maxGuesses = state.boards[0]?.maxGuesses || 6;
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="text-center py-2 px-2 shrink-0">
        <div className="flex justify-center gap-3 mt-1">
          <span className="text-gray-400 text-xs font-bold"><Trophy className="w-3 h-3 inline mr-1 text-amber-600" />{completedBoards}/4</span>
          <span className="text-gray-400 text-xs font-bold">{guessesUsed}/{maxGuesses} guesses</span>
          <span className="text-gray-400 text-xs font-bold"><Clock className="w-3 h-3 inline mr-1 text-blue-400" />{formatTime(elapsedTime)}</span>
        </div>
        {error && <div className="absolute left-0 right-0 z-20 text-center" style={{ top: '90px' }}><span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-lg">{error}</span></div>}
      </div>

      {/* Opponent HUD */}
      <div className="flex justify-center px-4 mb-1">
        <OpponentHUD
          attempts={opponentProgress.attempts}
          boardsSolved={opponentProgress.boardsSolved}
          totalBoards={opponentProgress.totalBoards}
        />
      </div>

      {/* Boards */}
      <div className="flex-1 min-h-0 px-2 pb-1">
        <MultiBoard boards={state.boards} currentGuess={currentGuess} />
      </div>

      {/* Keyboard */}
      <div className="shrink-0 pb-2 px-2">
        <Keyboard onKey={handleKeyPress} letterStates={letterStates} boardLetterStates={boardLetterStates} />
      </div>
    </div>
  );
}
