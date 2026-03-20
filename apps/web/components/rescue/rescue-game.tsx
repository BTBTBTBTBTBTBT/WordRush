'use client';

import { useReducer, useState, useEffect, useMemo, useCallback } from 'react';
import { GameMode, TileState, gameReducer, initializeGame, isWordValid } from '@wordle-duel/core';
import { MultiBoard } from '../game/multi-board';
import { Keyboard } from '../game/keyboard';
import { VictoryAnimation } from '../effects/victory-animation';
import { AnimatePresence } from 'framer-motion';
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

  const letterStates = useMemo(() => {
    const states: Record<string, 'correct' | 'present' | 'absent'> = {};
    for (const board of state.boards) {
      if (board.prefilledGuesses) {
        for (const prefill of board.prefilledGuesses) {
          for (const tile of prefill.evaluation.tiles) {
            const letter = tile.letter.toUpperCase();
            if (tile.state === TileState.CORRECT) states[letter] = 'correct';
            else if (tile.state === TileState.PRESENT && states[letter] !== 'correct') states[letter] = 'present';
            else if (tile.state === TileState.ABSENT && !states[letter]) states[letter] = 'absent';
          }
        }
      }
      for (const guess of board.guesses) {
        const solutionArray = board.solution.toUpperCase().split('');
        const guessArray = guess.toUpperCase().split('');
        const used = Array(5).fill(false);
        const tileStates: TileState[] = Array(5).fill(TileState.EMPTY);
        guessArray.forEach((letter, i) => { if (letter === solutionArray[i]) { tileStates[i] = TileState.CORRECT; used[i] = true; } });
        guessArray.forEach((letter, i) => { if (tileStates[i] === TileState.EMPTY) { const f = solutionArray.findIndex((l, idx) => l === letter && !used[idx]); if (f !== -1) { tileStates[i] = TileState.PRESENT; used[f] = true; } else { tileStates[i] = TileState.ABSENT; } } });
        guessArray.forEach((letter, i) => {
          if (tileStates[i] === TileState.CORRECT) states[letter] = 'correct';
          else if (tileStates[i] === TileState.PRESENT && states[letter] !== 'correct') states[letter] = 'present';
          else if (tileStates[i] === TileState.ABSENT && !states[letter]) states[letter] = 'absent';
        });
      }
    }
    return states;
  }, [state.boards]);

  const completedBoards = state.boards.filter(b => b.status === 'WON').length;
  const guessesUsed = state.boards.reduce((max, board) => Math.max(max, board.guesses.length), 0);

  const handleRestart = () => {
    dispatch({ type: 'RESET', seed: Date.now().toString(), mode: GameMode.RESCUE });
    setCurrentGuess(''); setError('');
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-gradient-to-br from-indigo-900 via-purple-800 to-fuchsia-700">
      <AnimatePresence>
        {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} />}
      </AnimatePresence>

      {/* Compact Header */}
      <div className="text-center py-2 px-2 shrink-0">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-fuchsia-400">
            RESCUE
          </h1>
          <ShieldCheck className="w-5 h-5 text-fuchsia-400" />
        </div>
        <div className="flex justify-center gap-3 mt-1">
          <span className="text-white/70 text-xs font-bold"><Zap className="w-3 h-3 inline mr-1 text-fuchsia-400" />{completedBoards}/4</span>
          <span className="text-white/70 text-xs font-bold"><Trophy className="w-3 h-3 inline mr-1 text-purple-400" />{6 - guessesUsed} left</span>
        </div>
        {error && <div className="text-red-300 text-xs font-bold mt-1">{error}</div>}
        {state.status === 'WON' && (
          <div className="mt-1">
            <span className="text-green-300 text-xs font-bold">Rescue complete! </span>
            <button onClick={handleRestart} className="text-yellow-400 text-xs font-bold underline">Play Again</button>
          </div>
        )}
        {state.status === 'LOST' && (
          <div className="mt-1">
            <span className="text-red-300 text-xs font-bold">Mission failed! {completedBoards}/4 </span>
            <button onClick={handleRestart} className="text-yellow-400 text-xs font-bold underline">Try Again</button>
          </div>
        )}
      </div>

      {/* Boards */}
      <div className="flex-1 min-h-0 px-2 pb-1">
        <MultiBoard boards={state.boards} currentGuess={currentGuess} />
      </div>

      {/* Keyboard */}
      <div className="shrink-0 pb-2 px-2">
        <Keyboard onKey={handleKeyPress} letterStates={letterStates} />
      </div>
    </div>
  );
}
