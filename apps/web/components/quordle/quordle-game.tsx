'use client';

import { useReducer, useState, useEffect, useCallback, useMemo } from 'react';
import { GameMode, gameReducer, initializeGame, isWordValid } from '@wordle-duel/core';
import { MultiBoard, computeActiveLetterStates } from '../game/multi-board';
import { Keyboard } from '../game/keyboard';
import { VictoryAnimation } from '../effects/victory-animation';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Target, Clock, ArrowRight } from 'lucide-react';

export function QuordleGame() {
  const [state, dispatch] = useReducer(
    gameReducer,
    initializeGame(Date.now().toString(), GameMode.QUORDLE)
  );

  const [currentGuess, setCurrentGuess] = useState('');
  const [error, setError] = useState('');
  const [showVictory, setShowVictory] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (state.status === 'PLAYING') {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - state.startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.status, state.startTime]);

  useEffect(() => {
    if (state.status === 'WON') setShowVictory(true);
  }, [state.status]);

  const handleKeyPress = useCallback((key: string) => {
    if (state.status !== 'PLAYING') return;
    setError('');

    if (key === 'ENTER') {
      if (currentGuess.length !== 5) { setError('Word must be 5 letters'); return; }
      if (!isWordValid(currentGuess)) { setError('Not in word list'); return; }

      state.boards.forEach((_, index) => {
        if (state.boards[index].status === 'PLAYING') {
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
      if (e.key === 'Enter') handleKeyPress('ENTER');
      else if (e.key === 'Backspace') handleKeyPress('BACK');
      else if (/^[a-zA-Z]$/.test(e.key)) handleKeyPress(e.key.toUpperCase());
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress]);

  const letterStates = useMemo(() => computeActiveLetterStates(state.boards), [state.boards]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const completedBoards = state.boards.filter(b => b.status !== 'PLAYING').length;
  const totalGuesses = state.boards[0]?.guesses.length || 0;

  const handleRestart = () => {
    dispatch({ type: 'RESET', seed: Date.now().toString(), mode: GameMode.QUORDLE });
    setCurrentGuess(''); setError(''); setElapsedTime(0);
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-gradient-to-br from-purple-900 via-pink-800 to-orange-700">
      <AnimatePresence>
        {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} />}
      </AnimatePresence>

      {/* Compact Header */}
      <div className="text-center py-2 px-2 shrink-0">
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400">
          QUORDLE
        </h1>
        <div className="flex justify-center gap-3 mt-1">
          <span className="text-white/70 text-xs font-bold"><Target className="w-3 h-3 inline mr-1 text-green-400" />{completedBoards}/4</span>
          <span className="text-white/70 text-xs font-bold"><Trophy className="w-3 h-3 inline mr-1 text-yellow-400" />{totalGuesses}/{state.boards[0]?.maxGuesses}</span>
          <span className="text-white/70 text-xs font-bold"><Clock className="w-3 h-3 inline mr-1 text-blue-400" />{formatTime(elapsedTime)}</span>
        </div>
        {error && <div className="text-red-300 text-xs font-bold mt-1">{error}</div>}
        {state.status === 'WON' && (
          <div className="mt-1">
            <span className="text-green-300 text-xs font-bold">All 4 solved! </span>
            <button onClick={handleRestart} className="text-yellow-400 text-xs font-bold underline">Play Again</button>
          </div>
        )}
        {state.status === 'LOST' && (
          <div className="mt-1">
            <span className="text-red-300 text-xs font-bold">Game Over! </span>
            <button onClick={handleRestart} className="text-yellow-400 text-xs font-bold underline">Try Again</button>
          </div>
        )}
      </div>

      {/* Boards - fills remaining space */}
      <div className="flex-1 min-h-0 px-2 pb-1">
        <MultiBoard boards={state.boards} currentGuess={currentGuess} />
      </div>

      {/* Keyboard - fixed at bottom */}
      <div className="shrink-0 pb-2 px-2">
        <Keyboard onKey={handleKeyPress} letterStates={letterStates} />
      </div>
    </div>
  );
}
