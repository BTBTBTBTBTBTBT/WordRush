'use client';

import { useReducer, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GameMode, gameReducer, initializeGame, isWordValid } from '@wordle-duel/core';
import { MultiBoard, computeActiveLetterStates, computePerBoardLetterStates } from '../game/multi-board';
import Link from 'next/link';
import { Keyboard } from '../game/keyboard';
import { VictoryAnimation } from '../effects/victory-animation';
import { GameOverAnimation } from '../effects/game-over-animation';
import { AnimatePresence } from 'framer-motion';
import { Trophy, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult, type XpResult } from '@/lib/stats-service';
import { XpToast } from '@/components/effects/xp-toast';
import { recordModePlayed } from '@/lib/play-limit-service';
import { generateMultiBoardSummary, generateShareText, copyShareToClipboard } from '@/lib/share-utils';
import { loadGameSession, useGameSnapshot } from '@/hooks/use-game-snapshot';

interface RescueGameProps {
  initialSeed?: string;
  isDaily?: boolean;
}

export function RescueGame({ initialSeed, isDaily }: RescueGameProps = {}) {
  const { profile } = useAuth();
  const isPro = (profile as any)?.is_pro ?? false;
  // Restore any previously saved session for this mode+variant. Rescue's
  // prefilled boards are captured in the snapshot so restoration preserves
  // them exactly without re-generating from the seed.
  const [savedSession] = useState(() => loadGameSession(GameMode.RESCUE, !!isDaily));
  const [gameSeed, setGameSeed] = useState(() => savedSession?.seed ?? initialSeed ?? Date.now().toString());
  const [state, dispatch] = useReducer(
    gameReducer,
    gameSeed,
    (s) => savedSession?.state ?? initializeGame(s, GameMode.RESCUE),
  );

  const [currentGuess, setCurrentGuess] = useState('');
  const [error, setError] = useState('');
  const [showVictory, setShowVictory] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(() => savedSession?.elapsedTime ?? 0);
  const [copied, setCopied] = useState(false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);

  // Flag so the effect below doesn't refire victory/loss on mount when a
  // completed save is loaded. Reset in handleRestart.
  const isRestoredCompleted = useRef(savedSession?.isCompleted ?? false);
  const startTimeRef = useRef(Date.now() - (savedSession?.elapsedTime ?? 0) * 1000);

  useGameSnapshot(GameMode.RESCUE, !!isDaily, gameSeed, state, elapsedTime);

  useEffect(() => {
    if (state.status === 'PLAYING') {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.status]);

  useEffect(() => {
    if (state.status === 'WON' && !isRestoredCompleted.current) setShowVictory(true);
    if (state.status === 'LOST' && !isRestoredCompleted.current) setShowGameOver(true);
    if (profile && !isRestoredCompleted.current && (state.status === 'WON' || state.status === 'LOST')) {
      const timeMs = Date.now() - startTimeRef.current;
      const guesses = state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0);
      const boardsSolved = state.boards.filter(b => b.status === 'WON').length;
      recordGameResult(profile.id, 'RESCUE', 'solo', state.status === 'WON', guesses, timeMs, gameSeed, boardsSolved, 4).then(xp => { if (xp) setXpResult(xp); });
    }
    if (!isRestoredCompleted.current && (state.status === 'WON' || state.status === 'LOST')) {
      recordModePlayed('rescue');
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

  const completedBoards = state.boards.filter(b => b.status === 'WON').length;
  const guessesUsed = state.boards.reduce((max, board) => Math.max(max, board.guesses.length), 0);
  const maxGuesses = state.boards[0]?.maxGuesses || 6;
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleShare = useCallback(async () => {
    const summary = generateMultiBoardSummary(state.boards as any, () => []);
    const text = generateShareText({
      mode: 'Deliverance',
      won: state.status === 'WON',
      guesses: guessesUsed,
      maxGuesses: maxGuesses,
      timeSeconds: elapsedTime,
      boardSummary: summary,
      boardsSolved: completedBoards,
      totalBoards: 4,
    });
    const ok = await copyShareToClipboard(text);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }, [state, guessesUsed, maxGuesses, elapsedTime, completedBoards]);

  const handleRestart = () => {
    const newSeed = Date.now().toString();
    setGameSeed(newSeed);
    dispatch({ type: 'RESET', seed: newSeed, mode: GameMode.RESCUE });
    setCurrentGuess(''); setError(''); setElapsedTime(0);
    startTimeRef.current = Date.now();
    isRestoredCompleted.current = false;
  };

  return (
    <div className="h-[100dvh] flex flex-col relative" style={{ backgroundColor: '#f8f7ff' }}>
      <AnimatePresence>
        {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} guesses={guessesUsed} maxGuesses={maxGuesses} timeSeconds={elapsedTime} boardsSolved={4} totalBoards={4} solutions={state.boards.map(b => b.solution)} />}
        {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={guessesUsed} maxGuesses={maxGuesses} timeSeconds={elapsedTime} boardsSolved={completedBoards} totalBoards={4} solutions={state.boards.map(b => b.solution)} />}
      </AnimatePresence>
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      {/* Compact Header */}
      <div className="text-center py-2 px-2 shrink-0">
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-fuchsia-400">
          DELIVERANCE
        </h1>
        <div className="flex justify-center gap-3 mt-1">
          <span className="text-gray-400 text-xs font-bold"><Trophy className="w-3 h-3 inline mr-1 text-amber-600" />{completedBoards}/4</span>
          <span className="text-gray-400 text-xs font-bold">{guessesUsed}/{maxGuesses} guesses</span>
          <span className="text-gray-400 text-xs font-bold"><Clock className="w-3 h-3 inline mr-1 text-blue-400" />{formatTime(elapsedTime)}</span>
        </div>
        {error && <div className="absolute left-0 right-0 z-20 text-center" style={{ top: '90px' }}><span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-lg">{error}</span></div>}
        {state.status === 'WON' && (
          <div className="mt-1 flex flex-col items-center gap-1">
            <span className="text-green-600 text-xs font-bold">Deliverance complete in {guessesUsed} guesses  ·  {formatTime(elapsedTime)}</span>
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 text-xs font-bold underline">Home</Link>
              <button onClick={handleShare} className="text-blue-500 text-xs font-bold underline">{copied ? 'Copied!' : 'Share'}</button>
              {!isDaily && isPro && <button onClick={handleRestart} className="text-amber-600 text-xs font-bold underline">Play Again</button>}
            </div>
          </div>
        )}
        {state.status === 'LOST' && (
          <div className="mt-1 flex flex-col items-center gap-1">
            <span className="text-red-300 text-xs font-bold">Boards Completed {completedBoards}/4</span>
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 text-xs font-bold underline">Home</Link>
              <button onClick={handleShare} className="text-blue-500 text-xs font-bold underline">{copied ? 'Copied!' : 'Share'}</button>
              {!isDaily && isPro && <button onClick={handleRestart} className="text-amber-600 text-xs font-bold underline">Try Again</button>}
            </div>
          </div>
        )}
      </div>

      {/* Boards */}
      <div className="flex-1 min-h-0 px-2 pb-1">
        <MultiBoard boards={state.boards} currentGuess={currentGuess} isInvalidWord={currentGuess.length === 5 && !isWordValid(currentGuess)} />
      </div>

      {/* Keyboard — hidden when game is complete */}
      {state.status === 'PLAYING' && (
        <div className="shrink-0 pb-2 px-2">
          <Keyboard onKey={handleKeyPress} letterStates={letterStates} boardLetterStates={boardLetterStates} />
        </div>
      )}
    </div>
  );
}
