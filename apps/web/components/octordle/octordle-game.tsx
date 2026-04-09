'use client';

import { useReducer, useState, useEffect, useCallback, useMemo } from 'react';
import { GameMode, gameReducer, initializeGame, isWordValid } from '@wordle-duel/core';
import { MultiBoard, computeActiveLetterStates, computePerBoardLetterStates } from '../game/multi-board';
import Link from 'next/link';
import { Keyboard } from '../game/keyboard';
import { VictoryAnimation } from '../effects/victory-animation';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult } from '@/lib/stats-service';
import { recordModePlayed } from '@/lib/play-limit-service';
import { generateMultiBoardSummary, generateShareText, copyShareToClipboard } from '@/lib/share-utils';

interface OctordleGameProps {
  initialSeed?: string;
  isDaily?: boolean;
}

export function OctordleGame({ initialSeed, isDaily }: OctordleGameProps = {}) {
  const { profile } = useAuth();
  const isPro = (profile as any)?.is_pro ?? false;
  const [gameSeed] = useState(() => initialSeed || Date.now().toString());
  const [state, dispatch] = useReducer(
    gameReducer,
    initializeGame(gameSeed, GameMode.OCTORDLE)
  );

  const [currentGuess, setCurrentGuess] = useState('');
  const [error, setError] = useState('');
  const [showVictory, setShowVictory] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [copied, setCopied] = useState(false);

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
    if (profile && (state.status === 'WON' || state.status === 'LOST')) {
      const timeMs = Date.now() - state.startTime;
      const guesses = state.boards[0]?.guesses.length || 0;
      const boardsSolved = state.boards.filter(b => b.status === 'WON').length;
      recordGameResult(profile.id, 'OCTORDLE', 'solo', state.status === 'WON', guesses, timeMs, gameSeed, boardsSolved, 8);
    }
    if (state.status === 'WON' || state.status === 'LOST') {
      recordModePlayed('octordle');
    }
  }, [state.status]);

  const handleKeyPress = useCallback((key: string) => {
    if (state.status !== 'PLAYING') return;
    setError('');

    if (key === 'ENTER') {
      if (currentGuess.length !== 5) { setError('Word must be 5 letters'); setCurrentGuess(''); setTimeout(() => setError(''), 1500); return; }
      if (!isWordValid(currentGuess)) { setError('Not in word list'); setCurrentGuess(''); setTimeout(() => setError(''), 1500); return; }

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
  const boardLetterStates = useMemo(() => computePerBoardLetterStates(state.boards), [state.boards]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const completedBoards = state.boards.filter(b => b.status !== 'PLAYING').length;
  const totalGuesses = state.boards[0]?.guesses.length || 0;

  const handleShare = useCallback(async () => {
    const summary = generateMultiBoardSummary(state.boards as any, () => []);
    const boardsSolved = state.boards.filter(b => b.status === 'WON').length;
    const text = generateShareText({
      mode: 'OctoWord',
      won: state.status === 'WON',
      guesses: totalGuesses,
      maxGuesses: state.boards[0]?.maxGuesses || 13,
      timeSeconds: elapsedTime,
      boardSummary: summary,
      boardsSolved,
      totalBoards: 8,
    });
    const ok = await copyShareToClipboard(text);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }, [state, totalGuesses, elapsedTime]);

  const handleRestart = () => {
    dispatch({ type: 'RESET', seed: Date.now().toString(), mode: GameMode.OCTORDLE });
    setCurrentGuess(''); setError(''); setElapsedTime(0);
  };

  return (
    <div className="h-[100dvh] flex flex-col relative" style={{ backgroundColor: '#f8f7ff' }}>
      <AnimatePresence>
        {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} guesses={totalGuesses} maxGuesses={state.boards[0]?.maxGuesses} timeSeconds={elapsedTime} boardsSolved={8} totalBoards={8} />}
      </AnimatePresence>

      {/* Compact Header */}
      <div className="text-center py-2 px-2 shrink-0">
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">
          OCTOWORD
        </h1>
        <div className="flex justify-center gap-3 mt-1">
          <span className="text-gray-400 text-xs font-bold"><Trophy className="w-3 h-3 inline mr-1 text-amber-600" />{completedBoards}/8</span>
          <span className="text-gray-400 text-xs font-bold">{totalGuesses}/{state.boards[0]?.maxGuesses} guesses</span>
          <span className="text-gray-400 text-xs font-bold"><Clock className="w-3 h-3 inline mr-1 text-blue-400" />{formatTime(elapsedTime)}</span>
        </div>
        {error && <div className="absolute left-0 right-0 z-20 text-center" style={{ top: '90px' }}><span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-lg">{error}</span></div>}
        {state.status === 'WON' && (
          <div className="mt-1 flex flex-col items-center gap-1">
            <span className="text-green-600 text-xs font-bold">All 8 solved in {totalGuesses} guesses  ·  {formatTime(elapsedTime)}</span>
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 text-xs font-bold underline">Home</Link>
              <button onClick={handleShare} className="text-blue-500 text-xs font-bold underline">{copied ? 'Copied!' : 'Share'}</button>
              {!isDaily && isPro && <button onClick={handleRestart} className="text-amber-600 text-xs font-bold underline">Play Again</button>}
            </div>
          </div>
        )}
        {state.status === 'LOST' && (
          <div className="mt-1 flex flex-col items-center gap-1">
            <span className="text-red-300 text-xs font-bold">Game Over! {completedBoards}/8</span>
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 text-xs font-bold underline">Home</Link>
              <button onClick={handleShare} className="text-blue-500 text-xs font-bold underline">{copied ? 'Copied!' : 'Share'}</button>
              {!isDaily && isPro && <button onClick={handleRestart} className="text-amber-600 text-xs font-bold underline">Try Again</button>}
            </div>
          </div>
        )}
      </div>

      {/* Boards */}
      <div className="flex-1 min-h-0 px-1 pb-1">
        <MultiBoard boards={state.boards} currentGuess={currentGuess} isInvalidWord={currentGuess.length === 5 && !isWordValid(currentGuess)} />
      </div>

      {/* Keyboard */}
      <div className="shrink-0 pb-2 px-2">
        <Keyboard onKey={handleKeyPress} letterStates={letterStates} boardLetterStates={boardLetterStates} />
      </div>
    </div>
  );
}
