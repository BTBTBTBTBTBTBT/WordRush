'use client';

import { useReducer, useState, useEffect, useMemo, useCallback } from 'react';
import { GameMode, GameStatus, evaluateGuess, gameReducer, createInitialState, isValidWord } from '@wordle-duel/core';
import { Board } from '@/components/game/board';
import { Keyboard } from '@/components/game/keyboard';
import { OpponentHUD } from './opponent-hud';
import { Clock } from 'lucide-react';

export interface VsGameComponentProps {
  seed: string;
  mode: GameMode;
  onBoardSolved: (boardIndex: number) => void;
  onCompleted: (status: 'won' | 'lost', totalGuesses: number, timeMs: number) => void;
  opponentProgress: { attempts: number; boardsSolved: number; totalBoards: number };
  startTime: number;
}

export function VsClassic({ seed, mode, onBoardSolved, onCompleted, opponentProgress, startTime }: VsGameComponentProps) {
  const [state, dispatch] = useReducer(gameReducer, createInitialState(seed, mode));
  const [currentGuess, setCurrentGuess] = useState('');
  const [message, setMessage] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [hasReported, setHasReported] = useState(false);

  const currentBoard = state.boards[state.currentBoardIndex];

  const evaluations = useMemo(() => {
    return currentBoard.guesses.map(g => evaluateGuess(currentBoard.solution, g));
  }, [currentBoard.guesses, currentBoard.solution]);

  const letterStates = useMemo(() => {
    const states: Record<string, 'correct' | 'present' | 'absent'> = {};
    for (const eval_ of evaluations) {
      for (const tile of eval_.tiles) {
        const letter = tile.letter.toUpperCase();
        if (tile.state === 'CORRECT') states[letter] = 'correct';
        else if (tile.state === 'PRESENT' && states[letter] !== 'correct') states[letter] = 'present';
        else if (tile.state === 'ABSENT' && !states[letter]) states[letter] = 'absent';
      }
    }
    return states;
  }, [evaluations]);

  useEffect(() => {
    if (state.status === GameStatus.PLAYING) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.status, startTime]);

  useEffect(() => {
    if (hasReported) return;
    if (state.status === GameStatus.WON) {
      setHasReported(true);
      onBoardSolved(0);
      onCompleted('won', currentBoard.guesses.length, Date.now() - startTime);
    } else if (state.status === GameStatus.LOST) {
      setHasReported(true);
      onCompleted('lost', currentBoard.guesses.length, Date.now() - startTime);
    }
  }, [state.status, hasReported, currentBoard.guesses.length, startTime, onBoardSolved, onCompleted]);

  const handleKey = useCallback((key: string) => {
    if (currentBoard.status !== GameStatus.PLAYING) return;
    setMessage('');

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
      dispatch({ type: 'SUBMIT_GUESS', guess: currentGuess });
      setCurrentGuess('');
    } else if (key === 'BACK') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess(prev => prev + key);
    }
  }, [currentGuess, currentBoard.status]);

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

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const guessesUsed = currentBoard.guesses.length;
  const maxGuesses = currentBoard.maxGuesses;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="text-center py-2 px-2 shrink-0">
        <div className="flex justify-center gap-3 mt-1">
          <span className="text-gray-400 text-xs font-bold">{guessesUsed}/{maxGuesses} guesses</span>
          <span className="text-gray-400 text-xs font-bold"><Clock className="w-3 h-3 inline mr-1 text-blue-400" />{formatTime(elapsedTime)}</span>
        </div>
        {message && (
          <div className="absolute left-0 right-0 z-20 text-center" style={{ top: '90px' }}>
            <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-lg">{message}</span>
          </div>
        )}
      </div>

      {/* Opponent HUD */}
      <div className="flex justify-center px-4 mb-2">
        <OpponentHUD
          attempts={opponentProgress.attempts}
          boardsSolved={opponentProgress.boardsSolved}
          totalBoards={opponentProgress.totalBoards}
        />
      </div>

      {/* Board */}
      <div className="flex-1 flex items-center justify-center px-4 min-h-0">
        <Board
          guesses={currentBoard.guesses}
          currentGuess={currentGuess}
          maxGuesses={currentBoard.maxGuesses}
          evaluations={evaluations}
          showSolution={currentBoard.status === GameStatus.LOST}
          solution={currentBoard.solution}
          darkMode
          isInvalidWord={currentGuess.length === 5 && !isValidWord(currentGuess)}
        />
      </div>

      {/* Keyboard */}
      <div className="shrink-0 pb-2 px-2">
        <Keyboard onKey={handleKey} letterStates={letterStates} />
      </div>
    </div>
  );
}
