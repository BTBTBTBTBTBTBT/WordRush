'use client';

import { useReducer, useState, useEffect } from 'react';
import { GameMode, gameReducer, initializeGame, isWordValid, evaluateGuess } from '@wordle-duel/core';
import { Board } from '../game/board';
import { Keyboard } from '../game/keyboard';
import { VictoryAnimation } from '../effects/victory-animation';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Flame, Clock, ArrowRight } from 'lucide-react';

export function SequenceGame() {
  const [state, dispatch] = useReducer(
    gameReducer,
    initializeGame(Date.now().toString(), GameMode.SEQUENCE)
  );

  const [currentGuess, setCurrentGuess] = useState('');
  const [error, setError] = useState('');
  const [showVictory, setShowVictory] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [streak, setStreak] = useState(0);

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
      setStreak((prev) => prev + 1);
    } else if (state.status === 'LOST') {
      setStreak(0);
    }
  }, [state.status]);

  const currentBoard = state.boards[state.currentBoardIndex];
  const completedBoards = state.boards.filter((b) => b.status === 'WON').length;

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

      dispatch({ type: 'SUBMIT_GUESS', guess: currentGuess });
      setCurrentGuess('');
    } else if (key === 'BACKSPACE') {
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
        handleKeyPress('BACKSPACE');
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

  const handleNextPuzzle = () => {
    dispatch({ type: 'RESET', seed: Date.now().toString(), mode: GameMode.SEQUENCE });
    setCurrentGuess('');
    setError('');
    setElapsedTime(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-900 via-red-800 to-pink-700 p-4">
      <AnimatePresence>
        {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} />}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto space-y-6">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center space-y-4"
        >
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 drop-shadow-lg">
            SEQUENCE
          </h1>

          <div className="flex justify-center gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-3 border-2 border-white/20">
              <div className="flex items-center gap-2 text-white">
                <Flame className="w-5 h-5 text-orange-400" fill="currentColor" />
                <span className="font-bold">{streak} Streak</span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-3 border-2 border-white/20">
              <div className="flex items-center gap-2 text-white">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span className="font-bold">Puzzle {completedBoards + 1}/5</span>
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
              className="space-y-4"
            >
              <div className="bg-green-500/20 border-2 border-green-400 text-white px-8 py-4 rounded-xl font-bold inline-block">
                🔥 All 5 puzzles completed! Streak: {streak} 🔥
              </div>
              <button
                onClick={handleNextPuzzle}
                className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold px-8 py-4 rounded-xl flex items-center gap-2 mx-auto"
              >
                Next Challenge <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {state.status === 'LOST' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="space-y-4"
            >
              <div className="bg-red-500/20 border-2 border-red-400 text-white px-8 py-4 rounded-xl font-bold inline-block">
                Streak broken! Solution: {currentBoard.solution.toUpperCase()}
              </div>
              <button
                onClick={handleNextPuzzle}
                className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold px-8 py-4 rounded-xl flex items-center gap-2 mx-auto"
              >
                Try Again <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </motion.div>

        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }}>
          <Board
            guesses={currentBoard.guesses}
            currentGuess={currentGuess}
            maxGuesses={currentBoard.maxGuesses}
            evaluations={currentBoard.guesses.map((g) => evaluateGuess(currentBoard.solution, g))}
            solution={currentBoard.solution}
            showSolution={currentBoard.status === 'LOST'}
          />
        </motion.div>

        <Keyboard onKey={handleKeyPress} />
      </div>
    </div>
  );
}
