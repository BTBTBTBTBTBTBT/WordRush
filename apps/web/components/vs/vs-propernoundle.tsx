'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { GameMode } from '@wordle-duel/core';
import { Keyboard } from '@/components/game/keyboard';
import { OpponentHUD } from './opponent-hud';
import { Clock } from 'lucide-react';
import NoundleBoard from '@/components/propernoundle/noundle-board';
import { Guess, TileState } from '@/components/propernoundle/types';
import { normalizeString, evaluateGuess, checkWin } from '@/components/propernoundle/game-logic';
import type { VsGameComponentProps } from './vs-classic';

const MAX_GUESSES = 6;

interface VsProperNoundleProps extends VsGameComponentProps {
  puzzleMetadata?: {
    display: string;
    category: string;
    answerLength: number;
    themeCategory?: string;
  };
}

export function VsProperNoundle({
  seed,
  mode,
  onBoardSolved,
  onCompleted,
  opponentProgress,
  startTime,
  puzzleMetadata,
}: VsProperNoundleProps) {
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [message, setMessage] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [hasReported, setHasReported] = useState(false);
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [letterStates, setLetterStates] = useState<Record<string, 'correct' | 'present' | 'absent'>>({});

  const answerLength = puzzleMetadata?.answerLength || 10;
  const answerDisplay = puzzleMetadata?.display || '';

  useEffect(() => {
    if (gameStatus === 'playing') {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameStatus, startTime]);

  useEffect(() => {
    if (hasReported) return;
    if (gameStatus === 'won') {
      setHasReported(true);
      onBoardSolved(0);
      onCompleted('won', guesses.length, Date.now() - startTime);
    } else if (gameStatus === 'lost') {
      setHasReported(true);
      onCompleted('lost', guesses.length, Date.now() - startTime);
    }
  }, [gameStatus, hasReported, guesses.length, startTime, onBoardSolved, onCompleted]);

  const handleKey = useCallback((key: string) => {
    if (gameStatus !== 'playing') return;
    setMessage('');

    if (key === 'ENTER') {
      const normalized = normalizeString(currentGuess);
      if (normalized.length !== answerLength) {
        setMessage(`Must be ${answerLength} letters`);
        setTimeout(() => setMessage(''), 1500);
        return;
      }

      // Evaluate guess against the answer (using seed-derived answer)
      // In VS mode, the answer comes from the server via puzzleMetadata
      // We use the normalized answer display for evaluation
      const tiles = evaluateGuess(currentGuess, answerDisplay);
      const newGuess: Guess = { word: currentGuess, tiles };
      const newGuesses = [...guesses, newGuess];
      setGuesses(newGuesses);
      setCurrentGuess('');

      // Update letter states
      const newLetterStates = { ...letterStates };
      for (let i = 0; i < normalized.length; i++) {
        const letter = normalized[i].toUpperCase();
        const state = tiles[i];
        if (state === 'correct') newLetterStates[letter] = 'correct';
        else if (state === 'present' && newLetterStates[letter] !== 'correct') newLetterStates[letter] = 'present';
        else if (state === 'absent' && !newLetterStates[letter]) newLetterStates[letter] = 'absent';
      }
      setLetterStates(newLetterStates);

      if (checkWin(tiles)) {
        setGameStatus('won');
      } else if (newGuesses.length >= MAX_GUESSES) {
        setGameStatus('lost');
      }
    } else if (key === 'BACK') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (/^[A-Z]$/.test(key) && normalizeString(currentGuess).length < answerLength) {
      setCurrentGuess(prev => prev + key);
    }
  }, [currentGuess, gameStatus, guesses, letterStates, answerLength, answerDisplay]);

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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="text-center py-2 px-2 shrink-0">
        <div className="flex justify-center items-center gap-3 mt-1">
          {puzzleMetadata?.themeCategory && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white bg-red-500">
              {puzzleMetadata.themeCategory}
            </span>
          )}
          <span className="text-gray-400 text-xs font-bold">{answerLength} letters</span>
          <span className="text-gray-400 text-xs font-bold">{guesses.length}/{MAX_GUESSES} guesses</span>
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
      <div className="flex-1 min-h-0 flex items-center justify-center px-2 pb-2">
        <NoundleBoard
          guesses={guesses}
          currentGuess={currentGuess}
          maxGuesses={MAX_GUESSES}
          answerLength={answerLength}
          answerDisplay={answerDisplay}
          shouldShake={false}
        />
      </div>

      {/* Keyboard */}
      <div className="shrink-0 pb-2 px-2">
        <Keyboard onKey={handleKey} letterStates={letterStates} />
      </div>
    </div>
  );
}
