'use client';

import { useReducer, useState, useEffect, useMemo } from 'react';
import { GameMode, TileState, gameReducer, initializeGame, isWordValid } from '@wordle-duel/core';
import { MultiBoard } from '../game/multi-board';
import { Keyboard } from '../game/keyboard';
import { VictoryAnimation } from '../effects/victory-animation';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Zap, ShieldCheck } from 'lucide-react';

export function RescueGame() {
  const [state, dispatch] = useReducer(
    gameReducer,
    initializeGame(Date.now().toString(), GameMode.RESCUE)
  );

  const [currentGuess, setCurrentGuess] = useState('');
  const [error, setError] = useState('');
  const [showVictory, setShowVictory] = useState(false);

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
    } else if (key === 'BACK') {
      setCurrentGuess((prev) => prev.slice(0, -1));
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

  const letterStates = useMemo(() => {
    const states: Record<string, 'correct' | 'present' | 'absent'> = {};

    for (const board of state.boards) {
      // Include pre-filled guess feedback
      if (board.prefilledGuesses) {
        for (const prefill of board.prefilledGuesses) {
          for (const tile of prefill.evaluation.tiles) {
            const letter = tile.letter.toUpperCase();
            if (tile.state === TileState.CORRECT) {
              states[letter] = 'correct';
            } else if (tile.state === TileState.PRESENT && states[letter] !== 'correct') {
              states[letter] = 'present';
            } else if (tile.state === TileState.ABSENT && !states[letter]) {
              states[letter] = 'absent';
            }
          }
        }
      }

      // Include player guess feedback
      for (const guess of board.guesses) {
        // Re-use the inline evaluation approach from multi-board
        const solutionArray = board.solution.toUpperCase().split('');
        const guessArray = guess.toUpperCase().split('');
        const used = Array(5).fill(false);
        const tileStates: TileState[] = Array(5).fill(TileState.EMPTY);

        guessArray.forEach((letter, i) => {
          if (letter === solutionArray[i]) {
            tileStates[i] = TileState.CORRECT;
            used[i] = true;
          }
        });

        guessArray.forEach((letter, i) => {
          if (tileStates[i] === TileState.EMPTY) {
            const foundIndex = solutionArray.findIndex((l, idx) => l === letter && !used[idx]);
            if (foundIndex !== -1) {
              tileStates[i] = TileState.PRESENT;
              used[foundIndex] = true;
            } else {
              tileStates[i] = TileState.ABSENT;
            }
          }
        });

        guessArray.forEach((letter, i) => {
          if (tileStates[i] === TileState.CORRECT) {
            states[letter] = 'correct';
          } else if (tileStates[i] === TileState.PRESENT && states[letter] !== 'correct') {
            states[letter] = 'present';
          } else if (tileStates[i] === TileState.ABSENT && !states[letter]) {
            states[letter] = 'absent';
          }
        });
      }
    }

    return states;
  }, [state.boards]);

  const completedBoards = state.boards.filter((b) => b.status === 'WON').length;
  const guessesUsed = state.boards.reduce((max, board) => Math.max(max, board.guesses.length), 0);
  const guessesRemaining = 6 - guessesUsed;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-fuchsia-700 p-4">
      <AnimatePresence>
        {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} />}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center space-y-4"
        >
          <div className="relative inline-block">
            <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-fuchsia-400 drop-shadow-lg">
              RESCUE
            </h1>
            <ShieldCheck className="absolute -top-2 -right-8 w-8 h-8 text-fuchsia-400" />
          </div>

          <p className="text-white/60 text-sm">
            Analyze the clues and rescue all 4 puzzles
          </p>

          <div className="flex justify-center gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border-2 border-white/20">
              <div className="flex items-center gap-2 text-white">
                <Zap className="w-4 h-4 text-fuchsia-400" />
                <span className="font-bold text-sm">{completedBoards}/4 Rescued</span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border-2 border-white/20">
              <div className="flex items-center gap-2 text-white">
                <Trophy className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-sm">{guessesRemaining} Guesses Left</span>
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
              RESCUE COMPLETE! All puzzles saved in {guessesUsed} guesses!
            </motion.div>
          )}

          {state.status === 'LOST' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-red-500/20 border-2 border-red-400 text-white px-8 py-4 rounded-xl font-bold inline-block space-y-2"
            >
              <div>Mission Failed - Rescued: {completedBoards}/4</div>
              <div className="text-sm text-white/70">
                Solutions: {state.boards.map(b => b.solution).join(', ')}
              </div>
            </motion.div>
          )}
        </motion.div>

        <MultiBoard boards={state.boards} currentGuess={currentGuess} />

        <div className="max-w-2xl mx-auto">
          <Keyboard onKey={handleKeyPress} letterStates={letterStates} />
        </div>
      </div>
    </div>
  );
}
