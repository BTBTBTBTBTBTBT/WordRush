'use client';

import { useReducer, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GameMode, GameStatus, evaluateGuess, gameReducer, createInitialState, generateMatchSeed, isValidWord } from '@wordle-duel/core';
import { Board } from '@/components/game/board';
import { Keyboard } from '@/components/game/keyboard';
import { VictoryAnimation } from '@/components/effects/victory-animation';
import { GameOverAnimation } from '@/components/effects/game-over-animation';
import { AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';
import { PostGameSummary } from '@/components/game/post-game-summary';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult, type XpResult } from '@/lib/stats-service';
import { recordModePlayed } from '@/lib/play-limit-service';
import { XpToast } from '@/components/effects/xp-toast';
import { generateEmojiGrid, generateShareText, copyShareToClipboard } from '@/lib/share-utils';
import { loadGameSession, useGameSnapshot } from '@/hooks/use-game-snapshot';
import { BottomNav } from '@/components/ui/bottom-nav';

interface PracticeGameProps {
  mode: GameMode;
  onBack: () => void;
  initialSeed?: string;
  isDaily?: boolean;
}

export function PracticeGame({ mode, onBack, initialSeed, isDaily }: PracticeGameProps) {
  ensureDictionaryInitialized();
  const { profile, isProActive } = useAuth();
  const isPro = isProActive;
  // Attempt to restore any previously saved session for this mode+variant.
  // Captured in state so the value is stable across re-renders but only
  // computed once on mount.
  const [savedSession] = useState(() => loadGameSession(mode, !!isDaily));
  const [gameSeed, setGameSeed] = useState(() => savedSession?.seed ?? initialSeed ?? generateMatchSeed());
  const [state, dispatch] = useReducer(
    gameReducer,
    gameSeed,
    (s) => savedSession?.state ?? createInitialState(s, mode),
  );
  const [currentGuess, setCurrentGuess] = useState('');
  const [message, setMessage] = useState('');
  const [showVictory, setShowVictory] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(() => savedSession?.elapsedTime ?? 0);
  const [copied, setCopied] = useState(false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);

  // If a completed save was loaded, flag it so the victory/recording effect
  // below doesn't refire. Reset to false on RESET (detected via elapsedTime
  // going back to 0 while status returns to PLAYING).
  const isRestoredCompleted = useRef(savedSession?.isCompleted ?? false);

  // Rebase running-timer anchors so restored elapsed time is preserved.
  const startTimeRef = useRef(Date.now() - (savedSession?.elapsedTime ?? 0) * 1000);

  // Snapshot persistence — saves the reducer state on every change, loads
  // on mount via the lazy initializers above.
  useGameSnapshot(mode, !!isDaily, gameSeed, state, elapsedTime);

  const currentBoard = state.boards[state.currentBoardIndex];

  const evaluations = useMemo(() => {
    return currentBoard.guesses.map(g => evaluateGuess(currentBoard.solution, g));
  }, [currentBoard.guesses, currentBoard.solution]);

  const letterStates = useMemo(() => {
    const states: Record<string, 'correct' | 'present' | 'absent'> = {};
    for (const eval_ of evaluations) {
      for (const tile of eval_.tiles) {
        const letter = tile.letter.toUpperCase();
        if (tile.state === 'CORRECT') states[letter] = 'correct';
        else if (tile.state === 'PRESENT' && states[letter] !== 'correct') states[letter] = 'present';
        else if (tile.state === 'ABSENT' && !states[letter]) states[letter] = 'absent';
      }
    }
    return states;
  }, [evaluations]);

  useEffect(() => {
    if (state.status === GameStatus.PLAYING) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.status]);

  useEffect(() => {
    if (state.status === GameStatus.WON && !isRestoredCompleted.current) setShowVictory(true);
    if (state.status === GameStatus.LOST && !isRestoredCompleted.current) setShowGameOver(true);
    if (profile && !isRestoredCompleted.current && (state.status === GameStatus.WON || state.status === GameStatus.LOST)) {
      // Use the frozen elapsedTime (the timer interval cleared when status
      // left PLAYING) so the recorded time exactly matches what the user saw
      // in the header, VictoryAnimation, and PostGameSummary. Using
      // Date.now() - startTimeRef would drift by up to 1000ms because the
      // setInterval fires once per second.
      const timeMs = elapsedTime * 1000;
      const guesses = currentBoard.guesses.length;
      recordGameResult(profile.id, 'DUEL', 'solo', state.status === GameStatus.WON, guesses, timeMs, gameSeed, state.status === GameStatus.WON ? 1 : 0, 1)
        .then(xp => { if (xp) setXpResult(xp); });
    }
    if (!isRestoredCompleted.current && (state.status === GameStatus.WON || state.status === GameStatus.LOST)) {
      recordModePlayed('practice');
    }
  }, [state.status]);

  const handleKey = useCallback((key: string) => {
    if (currentBoard.status !== GameStatus.PLAYING) return;
    setMessage('');

    if (key === 'ENTER') {
      if (currentGuess.length !== 5) {
        setMessage('Not enough letters');
        setCurrentGuess('');
        setTimeout(() => setMessage(''), 1500);
        return;
      }
      if (!isValidWord(currentGuess)) {
        setMessage('Not in word list');
        setCurrentGuess('');
        setTimeout(() => setMessage(''), 1500);
        return;
      }
      dispatch({ type: 'SUBMIT_GUESS', guess: currentGuess });
      setCurrentGuess('');
    } else if (key === 'BACK') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess(prev => prev + key);
    }
  }, [currentGuess, currentBoard.status]);

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

  const handleReset = () => {
    const newSeed = generateMatchSeed();
    setGameSeed(newSeed);
    dispatch({ type: 'RESET', seed: newSeed, mode });
    setCurrentGuess('');
    setMessage('');
    setElapsedTime(0);
    startTimeRef.current = Date.now();
    isRestoredCompleted.current = false;
  };

  const handleShare = useCallback(async () => {
    const grid = generateEmojiGrid(
      evaluations.map(e => e.tiles.map(t => t.state as 'CORRECT' | 'PRESENT' | 'ABSENT'))
    );
    const text = generateShareText({
      mode: 'Classic',
      won: state.status === GameStatus.WON,
      guesses: currentBoard.guesses.length,
      maxGuesses: currentBoard.maxGuesses,
      timeSeconds: elapsedTime,
      emojiGrid: grid,
    });
    const ok = await copyShareToClipboard(text);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }, [evaluations, state.status, currentBoard, elapsedTime]);

  const guessesUsed = currentBoard.guesses.length;
  const maxGuesses = currentBoard.maxGuesses;
  const gameComplete = state.status === GameStatus.WON || state.status === GameStatus.LOST;

  return (
    <div
      className={`h-[100dvh] flex flex-col relative ${gameComplete ? 'pb-[calc(env(safe-area-inset-bottom)+64px)]' : ''}`}
      style={{ backgroundColor: '#f8f7ff' }}
    >
      <AnimatePresence>
        {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} guesses={guessesUsed} maxGuesses={maxGuesses} timeSeconds={elapsedTime} solution={currentBoard.solution} />}
        {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={guessesUsed} maxGuesses={maxGuesses} timeSeconds={elapsedTime} solution={currentBoard.solution} />}
      </AnimatePresence>
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      {/* Header */}
      <div className="text-center py-2 px-2 shrink-0">
        <h1 className="text-3xl font-black text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}>
          CLASSIC
        </h1>
        <div className="flex justify-center gap-3 mt-1">
          <span className="text-xs font-bold" style={{ color: '#9ca3af' }}>{guessesUsed}/{maxGuesses} guesses</span>
          <span className="text-xs font-bold" style={{ color: '#9ca3af' }}><Clock className="w-3 h-3 inline mr-1 text-blue-400" />{formatTime(elapsedTime)}</span>
        </div>
        {message && (
          <div className="absolute left-0 right-0 z-20 text-center" style={{ top: '90px' }}>
            <span className="text-xs font-bold px-3 py-1 rounded-lg" style={{ background: '#1a1a2e', color: '#fff' }}>{message}</span>
          </div>
        )}
        {(state.status === GameStatus.WON || state.status === GameStatus.LOST) && (
          <div className="mt-1 text-center">
            <span className={`text-xs font-bold ${state.status === GameStatus.WON ? 'text-green-600' : 'text-red-400'}`}>
              {state.status === GameStatus.WON ? `Solved in ${guessesUsed} guesses` : ''} · {formatTime(elapsedTime)}
            </span>
          </div>
        )}
      </div>

      {/* Board + Post-game summary */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4">
        <div className={`flex flex-col items-center ${gameComplete ? 'justify-start pt-2' : 'justify-center h-full'}`}>
          <Board
            guesses={currentBoard.guesses}
            currentGuess={currentGuess}
            maxGuesses={currentBoard.maxGuesses}
            evaluations={evaluations}
            showSolution={false}
            solution={currentBoard.solution}
            darkMode
            isInvalidWord={currentGuess.length === 5 && !isValidWord(currentGuess)}
          />

          {gameComplete && (
            <PostGameSummary
              solution={currentBoard.solution}
              won={state.status === GameStatus.WON}
              guessCount={guessesUsed}
              maxGuesses={maxGuesses}
              timeSeconds={elapsedTime}
              isDaily={isDaily}
              isPro={isPro}
              onShare={handleShare}
              onReset={handleReset}
              copied={copied}
            />
          )}
        </div>
      </div>

      {/* Keyboard — hidden when game is complete */}
      {!gameComplete && (
        <div className="shrink-0 pb-2 px-2">
          <Keyboard onKey={handleKey} letterStates={letterStates} />
        </div>
      )}

      {gameComplete && <BottomNav />}
    </div>
  );
}
