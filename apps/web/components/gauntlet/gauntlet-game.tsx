'use client';

import { useReducer, useState, useCallback, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  gameReducer,
  initializeGame,
  GameMode,
  GameStatus,
  GAUNTLET_STAGES,
  evaluateGuess,
  isValidWord,
} from '@wordle-duel/core';
import { Board } from '@/components/game/board';
import { MultiBoard } from '@/components/game/multi-board';
import { Keyboard } from '@/components/game/keyboard';
import { VictoryAnimation } from '@/components/effects/victory-animation';
import { GauntletProgress, GauntletStageHeader } from './gauntlet-progress';
import { StageTransition } from './stage-transition';
import { GauntletResults } from './gauntlet-results';

function generateSeed(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export function GauntletGame() {
  const [seed, setSeed] = useState(generateSeed);
  const [state, dispatch] = useReducer(gameReducer, initializeGame(seed, GameMode.GAUNTLET));
  const [currentGuess, setCurrentGuess] = useState('');
  const [message, setMessage] = useState('');
  const [showTransition, setShowTransition] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [gameStartTime] = useState(Date.now());

  const gauntlet = state.gauntlet!;
  const currentStageConfig = gauntlet.stages[gauntlet.currentStage];
  const isSequential = currentStageConfig.sequential;
  const isSingleBoard = currentStageConfig.boardCount === 1;

  // Build letter states from all guesses on current boards
  const letterStates = useMemo(() => {
    const states: Record<string, 'correct' | 'present' | 'absent'> = {};

    for (const board of state.boards) {
      // Include prefilled guesses
      if (board.prefilledGuesses) {
        for (const pg of board.prefilledGuesses) {
          for (const tile of pg.evaluation.tiles) {
            const letter = tile.letter.toUpperCase();
            if (tile.state === 'CORRECT') states[letter] = 'correct';
            else if (tile.state === 'PRESENT' && states[letter] !== 'correct') states[letter] = 'present';
            else if (tile.state === 'ABSENT' && !states[letter]) states[letter] = 'absent';
          }
        }
      }

      // Player guesses
      for (const guess of board.guesses) {
        const result = evaluateGuess(board.solution, guess);
        for (const tile of result.tiles) {
          const letter = tile.letter.toUpperCase();
          if (tile.state === 'CORRECT') states[letter] = 'correct';
          else if (tile.state === 'PRESENT' && states[letter] !== 'correct') states[letter] = 'present';
          else if (tile.state === 'ABSENT' && !states[letter]) states[letter] = 'absent';
        }
      }
    }

    return states;
  }, [state.boards]);

  // Evaluations for single-board view
  const currentBoard = state.boards[state.currentBoardIndex];
  const evaluations = useMemo(() => {
    if (!currentBoard) return [];
    return currentBoard.guesses.map(g => evaluateGuess(currentBoard.solution, g));
  }, [currentBoard]);

  // Check for stage completion
  useEffect(() => {
    if (state.status !== GameStatus.PLAYING) return;

    const allBoardsDone = state.boards.every(b => b.status !== GameStatus.PLAYING);
    const allBoardsWon = state.boards.every(b => b.status === GameStatus.WON);

    if (allBoardsDone && allBoardsWon) {
      // Stage complete — show transition
      setShowTransition(true);
    }
  }, [state.boards, state.status]);

  // Check for game over
  useEffect(() => {
    if (state.status === GameStatus.WON) {
      setShowVictory(true);
    } else if (state.status === GameStatus.LOST) {
      setShowResults(true);
    }
  }, [state.status]);

  const handleKey = useCallback((key: string) => {
    if (state.status !== GameStatus.PLAYING) return;
    if (showTransition) return;

    if (key === 'ENTER') {
      if (currentGuess.length !== 5) {
        setMessage('Not enough letters');
        setTimeout(() => setMessage(''), 1500);
        return;
      }

      if (!isValidWord(currentGuess)) {
        setMessage('Not in word list');
        setTimeout(() => setMessage(''), 1500);
        return;
      }

      if (isSingleBoard || isSequential) {
        // Single board or sequential: dispatch to current board only
        dispatch({ type: 'SUBMIT_GUESS', guess: currentGuess, boardIndex: state.currentBoardIndex });
      } else {
        // Simultaneous: dispatch to all active boards
        state.boards.forEach((board, index) => {
          if (board.status === GameStatus.PLAYING) {
            dispatch({ type: 'SUBMIT_GUESS', guess: currentGuess, boardIndex: index });
          }
        });
      }

      setCurrentGuess('');
    } else if (key === 'BACK') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess(prev => prev + key);
    }
  }, [state, currentGuess, showTransition, isSingleBoard, isSequential]);

  // Keyboard event listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Enter') {
        handleKey('ENTER');
      } else if (e.key === 'Backspace') {
        handleKey('BACK');
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleKey(e.key.toUpperCase());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKey]);

  // Handle sequential board advancement within a stage
  useEffect(() => {
    if (!isSequential) return;
    if (state.status !== GameStatus.PLAYING) return;

    const board = state.boards[state.currentBoardIndex];
    if (board?.status === GameStatus.WON && state.currentBoardIndex < state.boards.length - 1) {
      const timer = setTimeout(() => {
        dispatch({ type: 'NEXT_BOARD' });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [state.boards, state.currentBoardIndex, isSequential, state.status]);

  const handleTransitionComplete = useCallback(() => {
    setShowTransition(false);
    dispatch({ type: 'NEXT_STAGE' });
    setCurrentGuess('');
  }, []);

  const handleVictoryComplete = useCallback(() => {
    setShowVictory(false);
    setShowResults(true);
  }, []);

  const handlePlayAgain = useCallback(() => {
    const newSeed = generateSeed();
    setSeed(newSeed);
    dispatch({ type: 'RESET', seed: newSeed, mode: GameMode.GAUNTLET });
    setCurrentGuess('');
    setMessage('');
    setShowTransition(false);
    setShowVictory(false);
    setShowResults(false);
  }, []);

  const handleHome = useCallback(() => {
    window.location.href = '/';
  }, []);

  // Show results screen
  if (showResults) {
    return (
      <GauntletResults
        won={state.status === GameStatus.WON}
        stages={gauntlet.stages}
        stageResults={gauntlet.stageResults}
        totalTimeMs={Date.now() - gameStartTime}
        onPlayAgain={handlePlayAgain}
        onHome={handleHome}
      />
    );
  }

  // Determine which board component to render
  const renderGameArea = () => {
    if (isSingleBoard || isSequential) {
      // Render single board (current board in sequence)
      const board = state.boards[state.currentBoardIndex];
      if (!board) return null;

      return (
        <div className="flex flex-col items-center gap-2">
          {isSequential && (
            <div className="text-white/50 text-sm font-medium">
              Board {state.currentBoardIndex + 1} of {state.boards.length}
            </div>
          )}
          <Board
            guesses={board.guesses}
            currentGuess={currentGuess}
            maxGuesses={board.maxGuesses}
            evaluations={evaluations}
            solution={board.solution}
            showSolution={board.status === GameStatus.LOST}
          />
        </div>
      );
    } else {
      // Render multi-board (quordle/octordle/rescue style)
      return (
        <MultiBoard
          boards={state.boards}
          currentGuess={currentGuess}
        />
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-orange-700 flex flex-col">
      {/* Progress Bar */}
      <GauntletProgress
        stages={gauntlet.stages}
        currentStage={gauntlet.currentStage}
        stageResults={gauntlet.stageResults}
      />

      {/* Stage Header */}
      <GauntletStageHeader stage={currentStageConfig} />

      {/* Message */}
      {message && (
        <div className="text-center">
          <span className="bg-white/20 backdrop-blur-sm text-white font-bold px-4 py-2 rounded-lg text-sm">
            {message}
          </span>
        </div>
      )}

      {/* Game Area */}
      <div className="flex-1 flex items-center justify-center px-4 py-2 overflow-auto">
        {renderGameArea()}
      </div>

      {/* Keyboard */}
      <div className="pb-4 px-2">
        <Keyboard onKey={handleKey} letterStates={letterStates} />
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {showTransition && (
          <StageTransition
            completedStage={currentStageConfig}
            nextStage={gauntlet.currentStage + 1 < gauntlet.totalStages
              ? gauntlet.stages[gauntlet.currentStage + 1]
              : null
            }
            onComplete={handleTransitionComplete}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVictory && (
          <VictoryAnimation onComplete={handleVictoryComplete} />
        )}
      </AnimatePresence>
    </div>
  );
}
