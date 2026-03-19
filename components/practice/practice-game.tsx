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
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack}>Back</Button>
          <h1 className="text-2xl font-bold">Practice Mode</h1>
          <Button variant="outline" onClick={handleReset}>New Game</Button>
        </div>

        <Card className="p-6">
          <div className="flex justify-between text-sm mb-4">
            <div>Win Rate: {stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0}%</div>
            <div>Streak: {stats.currentStreak}</div>
            <div>Best: {stats.personalBest || '-'}</div>
          </div>
        </Card>

        <div className="flex justify-center">
          <Board
            guesses={currentBoard.guesses}
            currentGuess={currentGuess}
            maxGuesses={currentBoard.maxGuesses}
            evaluations={evaluations}
            showSolution={currentBoard.status === GameStatus.LOST}
            solution={currentBoard.solution}
          />
        </div>

        {message && (
          <div className="text-center text-red-500 font-medium">{message}</div>
        )}

        {currentBoard.status === GameStatus.WON && mode === GameMode.GAUNTLET && state.currentBoardIndex < 2 && (
          <div className="text-center">
            <Button onClick={handleNextBoard} size="lg">Next Round</Button>
          </div>
        )}

        {currentBoard.status === GameStatus.WON && (
          <div className="text-center text-green-600 font-bold text-xl">
            {mode === GameMode.GAUNTLET && state.currentBoardIndex === 2 ? 'Gauntlet Complete!' : 'You Won!'}
          </div>
        )}

        {currentBoard.status === GameStatus.LOST && (
          <div className="text-center text-red-600 font-bold text-xl">Game Over</div>
        )}

        <Keyboard onKey={handleKey} letterStates={letterStates} />
      </div>
    </div>
  );
}
