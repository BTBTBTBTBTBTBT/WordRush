'use client';

import { useReducer, useState, useEffect } from 'react';
import { GameMode, gameReducer, initializeGame, isWordValid } from '@wordle-duel/core';
import { MultiBoard } from '../game/multi-board';
import { Keyboard } from '../game/keyboard';
import { VictoryAnimation } from '../effects/victory-animation';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Target, Clock } from 'lucide-react';

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
    if (state.status === 'WON') {
      setShowVictory(true);
    }
  }, [state.status]);

  const handleKeyPress = (key: string) => {
    if (state.status !== 'PLAYING') return;

    setError('');

    if (key === 'ENTER') {
      if (currentGuess.length !== 5) {
        setError('Word must be 5 letters');
        return;
      }

      if (!isWordValid(currentGuess)) {
        setError('Not in word list');
        return;
      }

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
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [currentGuess, state]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const completedBoards = state.boards.filter((b) => b.status !== 'PLAYING').length;
  const totalGuesses = state.boards.reduce((sum, board) => sum + board.guesses.length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-orange-700 p-4">
      <AnimatePresence>
        {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} />}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center space-y-4"
        >
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 drop-shadow-lg">
            QUORDLE
          </h1>

          <div className="flex justify-center gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-3 border-2 border-white/20">
              <div className="flex items-center gap-2 text-white">
                <Target className="w-5 h-5 text-green-400" />
                <span className="font-bold">{completedBoards}/4 Complete</span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-3 border-2 border-white/20">
              <div className="flex items-center gap-2 text-white">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span className="font-bold">{totalGuesses} Guesses</span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-3 border-2 border-white/20">
              <div className="flex items-center gap-2 text-white">
                <Clock className="w-5 h-5 text-blue-400" />
                <span className="font-bold">{formatTime(elapsedTime)}</span>
              </div>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-red-500/20 border-2 border-red-500 text-white px-6 py-3 rounded-xl font-bold inline-block"
            >
              {error}
            </motion.div>
          )}

          {state.status === 'WON' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-green-500/20 border-2 border-green-400 text-white px-8 py-4 rounded-xl font-bold inline-block"
            >
              🎉 All 4 puzzles solved in {totalGuesses} guesses!
            </motion.div>
          )}

          {state.status === 'LOST' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-red-500/20 border-2 border-red-400 text-white px-8 py-4 rounded-xl font-bold inline-block"
            >
              Game Over! Solutions: {state.boards.map((b) => b.solution.toUpperCase()).join(', ')}
            </motion.div>
          )}
        </motion.div>

        <MultiBoard boards={state.boards} currentGuess={currentGuess} />

        <div className="max-w-2xl mx-auto">
          <Keyboard onKey={handleKeyPress} />
        </div>
      </div>
    </div>
  );
}
