'use client';

import { useReducer, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GameMode, gameReducer, initializeGame, isWordValid } from '@wordle-duel/core';
import { MultiBoard, computeActiveLetterStates, computePerBoardLetterStates } from '../game/multi-board';
import Link from 'next/link';
import { Keyboard } from '../game/keyboard';
import { VictoryAnimation } from '../effects/victory-animation';
import { GameOverAnimation } from '../effects/game-over-animation';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult, recordSoloMatch, type XpResult } from '@/lib/stats-service';
import { XpToast } from '@/components/effects/xp-toast';
import { recordModePlayed } from '@/lib/play-limit-service';
import { generateMultiBoardSummary, generateShareText, copyShareToClipboard } from '@/lib/share-utils';
import { loadGameSession, useGameSnapshot } from '@/hooks/use-game-snapshot';
import { useActivePlayTimer } from '@/hooks/use-active-play-timer';
import { BottomNav } from '@/components/ui/bottom-nav';

interface QuordleGameProps {
  initialSeed?: string;
  isDaily?: boolean;
}

export function QuordleGame({ initialSeed, isDaily }: QuordleGameProps = {}) {
  const { profile, isProActive } = useAuth();
  const isPro = isProActive;
  // Restore any previously saved session for this mode+variant.
  const [savedSession] = useState(() => loadGameSession(GameMode.QUORDLE, !!isDaily));
  const [gameSeed, setGameSeed] = useState(() => savedSession?.seed ?? initialSeed ?? Date.now().toString());
  const [state, dispatch] = useReducer(
    gameReducer,
    gameSeed,
    (s) => savedSession?.state ?? initializeGame(s, GameMode.QUORDLE),
  );

  const [currentGuess, setCurrentGuess] = useState('');
  const [error, setError] = useState('');
  const [showVictory, setShowVictory] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);

  // Flag so effects below don't refire victory/loss animations or record
  // duplicate stats when a completed game was loaded on mount. Reset on
  // handleRestart so a fresh run can animate normally.
  const isRestoredCompleted = useRef(savedSession?.isCompleted ?? false);

  const { elapsedSeconds: elapsedTime, reset: resetTimer } = useActivePlayTimer(
    state.status === 'PLAYING',
    savedSession?.elapsedTime ?? 0,
  );

  useGameSnapshot(GameMode.QUORDLE, !!isDaily, gameSeed, state, elapsedTime);

  useEffect(() => {
    if (state.status === 'WON' && !isRestoredCompleted.current) setShowVictory(true);
    if (state.status === 'LOST' && !isRestoredCompleted.current) setShowGameOver(true);
    if (profile && !isRestoredCompleted.current && (state.status === 'WON' || state.status === 'LOST')) {
      // Use the frozen elapsedTime (timer stops when status leaves PLAYING)
      // so the recorded time exactly matches what the user sees in the
      // header, VictoryAnimation, and share text. Using a fresh Date.now()
      // subtraction would drift by up to 1000ms from the displayed value.
      const timeMs = elapsedTime * 1000;
      const guesses = state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0);
      const boardsSolved = state.boards.filter(b => b.status === 'WON').length;
      recordGameResult(profile.id, 'QUORDLE', 'solo', state.status === 'WON', guesses, timeMs, gameSeed, boardsSolved, 4).then(xp => { if (xp) setXpResult(xp); });
      const longestGuesses = state.boards.reduce<string[]>((longest, b) => b.guesses.length > longest.length ? b.guesses : longest, []);
      recordSoloMatch({
        userId: profile.id,
        gameMode: 'QUORDLE',
        won: state.status === 'WON',
        score: guesses,
        timeSeconds: elapsedTime,
        seed: gameSeed,
        solutions: state.boards.map(b => b.solution),
        guesses: longestGuesses,
        startedAtIso: new Date(Date.now() - elapsedTime * 1000).toISOString(),
      });
    }
    if (!isRestoredCompleted.current && (state.status === 'WON' || state.status === 'LOST')) {
      recordModePlayed('quordle');
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
  const totalGuesses = state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0);

  const handleShare = useCallback(async () => {
    const summary = generateMultiBoardSummary(state.boards as any, () => []);
    const boardsSolved = state.boards.filter(b => b.status === 'WON').length;
    const text = generateShareText({
      mode: 'QuadWord',
      won: state.status === 'WON',
      guesses: totalGuesses,
      maxGuesses: state.boards[0]?.maxGuesses || 9,
      timeSeconds: elapsedTime,
      boardSummary: summary,
      boardsSolved,
      totalBoards: 4,
    });
    const ok = await copyShareToClipboard(text);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }, [state, totalGuesses, elapsedTime]);

  const handleRestart = () => {
    const newSeed = Date.now().toString();
    setGameSeed(newSeed);
    dispatch({ type: 'RESET', seed: newSeed, mode: GameMode.QUORDLE });
    setCurrentGuess(''); setError(''); resetTimer(0);
    isRestoredCompleted.current = false;
  };

  return (
    <div
      className={`h-[100dvh] flex flex-col relative ${state.status !== 'PLAYING' ? 'pb-[calc(env(safe-area-inset-bottom)+64px)]' : ''}`}
      style={{ backgroundColor: '#f8f7ff' }}
    >
      <AnimatePresence>
        {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} guesses={totalGuesses} maxGuesses={state.boards[0]?.maxGuesses} timeSeconds={elapsedTime} boardsSolved={4} totalBoards={4} solutions={state.boards.map(b => b.solution)} />}
        {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={totalGuesses} maxGuesses={state.boards[0]?.maxGuesses} timeSeconds={elapsedTime} boardsSolved={completedBoards} totalBoards={4} solutions={state.boards.map(b => b.solution)} />}
      </AnimatePresence>
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      {/* Compact Header */}
      <div className="text-center py-2 px-2 shrink-0">
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400">
          QUADWORD
        </h1>
        <div className="flex justify-center gap-3 mt-1">
          <span className="text-gray-400 text-xs font-bold"><Trophy className="w-3 h-3 inline mr-1 text-amber-600" />{completedBoards}/4</span>
          <span className="text-gray-400 text-xs font-bold">{totalGuesses}/{state.boards[0]?.maxGuesses} guesses</span>
          <span className="text-gray-400 text-xs font-bold"><Clock className="w-3 h-3 inline mr-1 text-blue-400" />{formatTime(elapsedTime)}</span>
        </div>
        {error && <div className="absolute left-0 right-0 z-20 text-center" style={{ top: '90px' }}><span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-lg">{error}</span></div>}
        {state.status === 'WON' && (
          <div className="mt-1 flex flex-col items-center gap-1">
            <span className="text-green-600 text-xs font-bold">All 4 solved in {totalGuesses} guesses  ·  {formatTime(elapsedTime)}</span>
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

      {/* Boards - fills remaining space */}
      <div className="flex-1 min-h-0 px-2 pb-2">
        <MultiBoard boards={state.boards} currentGuess={currentGuess} isInvalidWord={currentGuess.length === 5 && !isWordValid(currentGuess)} />
      </div>

      {/* Keyboard — hidden when game is complete */}
      {state.status === 'PLAYING' && (
        <div className="shrink-0 pb-2 px-2 pt-1">
          <Keyboard onKey={handleKeyPress} letterStates={letterStates} boardLetterStates={boardLetterStates} />
        </div>
      )}

      {state.status !== 'PLAYING' && <BottomNav />}
    </div>
  );
}
