'use client';

import { useReducer, useState, useEffect } from 'react';
import { GameMode, GameStatus, GuessResult, evaluateGuess, gameReducer, createInitialState, generateMatchSeed } from '@wordle-duel/core';
import { Board } from '@/components/game/board';
import { Keyboard } from '@/components/game/keyboard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LocalStorageAdapter } from '@/lib/adapters/storage';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';

const storage = new LocalStorageAdapter();

interface PracticeGameProps {
  mode: GameMode;
  onBack: () => void;
}

export function PracticeGame({ mode, onBack }: PracticeGameProps) {
  ensureDictionaryInitialized();
  const [state, dispatch] = useReducer(gameReducer, createInitialState(generateMatchSeed(), mode));
  const [currentGuess, setCurrentGuess] = useState('');
  const [evaluations, setEvaluations] = useState<GuessResult[]>([]);
  const [letterStates, setLetterStates] = useState<Record<string, 'correct' | 'present' | 'absent'>>({});
  const [message, setMessage] = useState('');

  const currentBoard = state.boards[state.currentBoardIndex];

  useEffect(() => {
    if (state.status === GameStatus.WON || state.status === GameStatus.LOST) {
      const won = state.status === GameStatus.WON;
      storage.addGame(mode, won, currentBoard.guesses.length);
    }
  }, [state.status, mode, currentBoard.guesses.length]);

  const handleKey = (key: string) => {
    if (currentBoard.status !== GameStatus.PLAYING) return;

    setMessage('');

    if (key === 'ENTER') {
      if (currentGuess.length !== 5) {
        setMessage('Word must be 5 letters');
        return;
      }

      const result = dispatch({ type: 'SUBMIT_GUESS', guess: currentGuess });

      try {
        const evaluation = evaluateGuess(currentBoard.solution, currentGuess);
        setEvaluations([...evaluations, evaluation]);

        const newLetterStates = { ...letterStates };
        evaluation.tiles.forEach((tile) => {
          const letter = tile.letter;
          const currentState = newLetterStates[letter];

          if (tile.state === 'CORRECT') {
            newLetterStates[letter] = 'correct';
          } else if (tile.state === 'PRESENT' && currentState !== 'correct') {
            newLetterStates[letter] = 'present';
          } else if (tile.state === 'ABSENT' && !currentState) {
            newLetterStates[letter] = 'absent';
          }
        });
        setLetterStates(newLetterStates);

        setCurrentGuess('');
      } catch (error) {
        setMessage('Not in word list');
      }
    } else if (key === 'BACK') {
      setCurrentGuess(currentGuess.slice(0, -1));
    } else if (currentGuess.length < 5) {
      setCurrentGuess(currentGuess + key);
    }
  };

  const handleReset = () => {
    const newSeed = generateMatchSeed();
    dispatch({ type: 'RESET', seed: newSeed, mode });
    setCurrentGuess('');
    setEvaluations([]);
    setLetterStates({});
    setMessage('');
  };

  const handleNextBoard = () => {
    dispatch({ type: 'NEXT_BOARD' });
    setCurrentGuess('');
    setEvaluations([]);
    setLetterStates({});
    setMessage('');
  };

  const stats = storage.getStats(mode);

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 px-4 py-2">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <Button variant="outline" size="sm" onClick={onBack}>Back</Button>
          <div className="text-center">
            <h1 className="text-lg font-bold">Classic</h1>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>Win: {stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0}%</span>
              <span>Streak: {stats.currentStreak}</span>
              <span>Best: {stats.personalBest || '-'}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>New</Button>
        </div>
        {message && <div className="text-center text-red-500 text-sm font-medium mt-1">{message}</div>}
        {currentBoard.status === GameStatus.WON && (
          <div className="text-center text-green-600 font-bold mt-1">You Won!</div>
        )}
        {currentBoard.status === GameStatus.LOST && (
          <div className="text-center text-red-600 font-bold mt-1">Game Over</div>
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
        />
      </div>

      {/* Keyboard */}
      <div className="shrink-0 pb-2 px-2">
        <Keyboard onKey={handleKey} letterStates={letterStates} />
      </div>
    </div>
  );
}
