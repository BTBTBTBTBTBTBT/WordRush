'use client';

import { useReducer, useState, useEffect, useMemo, useCallback } from 'react';
import { GameMode, GameStatus, evaluateGuess, gameReducer, createInitialState, generateMatchSeed, isValidWord } from '@wordle-duel/core';
import { Board } from '@/components/game/board';
import { Keyboard } from '@/components/game/keyboard';
import { VictoryAnimation } from '@/components/effects/victory-animation';
import { AnimatePresence } from 'framer-motion';
import { Trophy, RotateCcw, Home, Flame } from 'lucide-react';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';

interface PracticeGameProps {
  mode: GameMode;
  onBack: () => void;
}

export function PracticeGame({ mode, onBack }: PracticeGameProps) {
  ensureDictionaryInitialized();
  const [state, dispatch] = useReducer(gameReducer, createInitialState(generateMatchSeed(), mode));
  const [currentGuess, setCurrentGuess] = useState('');
  const [message, setMessage] = useState('');
  const [showVictory, setShowVictory] = useState(false);

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
    if (state.status === GameStatus.WON) setShowVictory(true);
  }, [state.status]);

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

  const handleReset = () => {
    dispatch({ type: 'RESET', seed: generateMatchSeed(), mode });
    setCurrentGuess('');
    setMessage('');
  };

  const guessesUsed = currentBoard.guesses.length;
  const maxGuesses = currentBoard.maxGuesses;

  return (
    <div className="h-[100dvh] flex flex-col bg-gradient-to-br from-blue-900 via-cyan-800 to-teal-700 relative">
      <AnimatePresence>
        {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} />}
      </AnimatePresence>

      {/* Header */}
      <div className="text-center py-2 px-2 shrink-0">
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-teal-400">
          CLASSIC
        </h1>
        <div className="flex justify-center gap-3 mt-1">
          <span className="text-white/70 text-xs font-bold">
            <Trophy className="w-3 h-3 inline mr-1 text-yellow-400" />{guessesUsed}/{maxGuesses} guesses
          </span>
        </div>
        {message && (
          <div className="absolute left-0 right-0 z-20 text-center" style={{ top: '90px' }}>
            <span className="bg-black/70 text-white text-xs font-bold px-3 py-1 rounded-lg">{message}</span>
          </div>
        )}
        {state.status === GameStatus.WON && (
          <div className="mt-1 flex items-center justify-center gap-3">
            <span className="text-green-300 text-xs font-bold">Solved in {guessesUsed}!</span>
            <button onClick={handleReset} className="text-yellow-400 text-xs font-bold underline">Play Again</button>
          </div>
        )}
        {state.status === GameStatus.LOST && (
          <div className="mt-1 flex items-center justify-center gap-3">
            <span className="text-red-300 text-xs font-bold">The word was {currentBoard.solution.toUpperCase()}</span>
            <button onClick={handleReset} className="text-yellow-400 text-xs font-bold underline">Try Again</button>
          </div>
        )}
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
        />
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 px-4 pb-1 flex justify-center gap-4">
        <button onClick={onBack} className="text-white/50 text-xs font-bold flex items-center gap-1">
          <Home className="w-3 h-3" /> Home
        </button>
        <button onClick={handleReset} className="text-white/50 text-xs font-bold flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> New Puzzle
        </button>
      </div>

      {/* Keyboard */}
      <div className="shrink-0 pb-2 px-2">
        <Keyboard onKey={handleKey} letterStates={letterStates} />
      </div>
    </div>
  );
}
