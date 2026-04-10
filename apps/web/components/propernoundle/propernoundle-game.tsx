'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Keyboard } from '@/components/game/keyboard';
import { VictoryAnimation } from '@/components/effects/victory-animation';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Lightbulb, Eye, Hash, Loader2 } from 'lucide-react';
import NoundleBoard from './noundle-board';
import { Puzzle, Guess, TileState } from './types';
import { normalizeString, evaluateGuess, checkWin } from './game-logic';
import { getDailyPuzzle, getRandomPuzzle, getDailyPuzzleNumber } from './puzzle-service';
import { useHints } from './use-hints';
import { fetchWikipediaImage } from './wikipedia';
import { recordModePlayed } from '@/lib/play-limit-service';
import { generateEmojiGrid, generateShareText, copyShareToClipboard } from '@/lib/share-utils';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult } from '@/lib/stats-service';

const MAX_GUESSES = 6;
const DAILY_STORAGE_KEY = 'spellstrike-propernoundle-daily';

const CATEGORY_LABELS: Record<string, string> = {
  music: 'Music',
  videogames: 'Video Games',
  movies: 'Movies',
  sports: 'Sports',
  history: 'History',
  science: 'Science',
  currentevents: 'Current Events',
};

const CATEGORY_COLORS: Record<string, string> = {
  music: '#ec4899',
  videogames: '#8b5cf6',
  movies: '#f59e0b',
  sports: '#10b981',
  history: '#6366f1',
  science: '#06b6d4',
  currentevents: '#ef4444',
};

type GameMode = 'daily' | 'practice';

interface DailyState {
  date: string;
  puzzleId: string;
  guesses: Guess[];
  gameStatus: 'playing' | 'won' | 'lost';
  letterStates: Record<string, TileState>;
  elapsedTime: number;
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getSavedDailyState(puzzleId: string): DailyState | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(DAILY_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    // Clear if date doesn't match OR puzzle changed
    if (parsed.date !== getTodayString() || (parsed.puzzleId && parsed.puzzleId !== puzzleId)) {
      localStorage.removeItem(DAILY_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveDailyState(state: DailyState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(state));
}

export function ProperNoundleGame() {
  const { profile } = useAuth();
  const isPro = (profile as any)?.is_pro ?? false;
  const [mode, setMode] = useState<GameMode>('daily');
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [letterStates, setLetterStates] = useState<Record<string, TileState>>({});
  const [shouldShake, setShouldShake] = useState(false);
  const [message, setMessage] = useState('');
  const [showVictory, setShowVictory] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState(Date.now());
  const [playedIds, setPlayedIds] = useState<string[]>([]);
  const [wikiImageUrl, setWikiImageUrl] = useState<string | null>(null);
  const [wikiImageLoaded, setWikiImageLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const restoredDailyRef = useRef(false);

  const hints = useHints();

  const answerLength = puzzle ? normalizeString(puzzle.answer).length : 0;

  // Load puzzle
  useEffect(() => {
    if (mode === 'daily') {
      const p = getDailyPuzzle();
      setPuzzle(p);

      // Restore saved daily state (validate puzzle ID matches today's puzzle)
      const saved = getSavedDailyState(p.id);
      if (saved && saved.gameStatus !== 'playing') {
        setGuesses(saved.guesses);
        setGameStatus(saved.gameStatus);
        setLetterStates(saved.letterStates);
        setElapsedTime(saved.elapsedTime);
        setCurrentGuess('');
        setMessage('');
        restoredDailyRef.current = true;
        return;
      } else if (saved && saved.gameStatus === 'playing') {
        setGuesses(saved.guesses);
        setLetterStates(saved.letterStates);
        setElapsedTime(saved.elapsedTime);
        setStartTime(Date.now() - saved.elapsedTime * 1000);
        setCurrentGuess('');
        setGameStatus('playing');
        setMessage('');
        restoredDailyRef.current = false;
        return;
      }
      // Fresh daily
      setGuesses([]);
      setCurrentGuess('');
      setGameStatus('playing');
      setLetterStates({});
      setMessage('');
      setElapsedTime(0);
      setStartTime(Date.now());
      restoredDailyRef.current = false;
    } else {
      const p = getRandomPuzzle(playedIds);
      setPuzzle(p);
      setGuesses([]);
      setCurrentGuess('');
      setGameStatus('playing');
      setLetterStates({});
      setMessage('');
      setElapsedTime(0);
      setStartTime(Date.now());
      restoredDailyRef.current = false;
    }
    setShowVictory(false);
    setWikiImageUrl(null);
    setWikiImageLoaded(false);
    hints.resetHints();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer
  useEffect(() => {
    if (gameStatus !== 'playing') return;
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStatus, startTime]);

  // Game over effects
  useEffect(() => {
    if (gameStatus === 'won' && !restoredDailyRef.current) {
      setShowVictory(true);
    }
    if (gameStatus === 'won' || gameStatus === 'lost') {
      recordModePlayed('propernoundle');

      // Record game stats
      if (profile) {
        const timeMs = elapsedTime * 1000;
        recordGameResult(
          profile.id,
          'PROPERNOUNDLE',
          'solo',
          gameStatus === 'won',
          guesses.length,
          timeMs,
          undefined,
          gameStatus === 'won' ? 1 : 0,
          1
        );
      }

      // Fetch Wikipedia image for result screen
      if (puzzle) {
        setWikiImageUrl(null);
        setWikiImageLoaded(false);
        fetchWikipediaImage(puzzle.display, puzzle.wikiTitle).then(url => {
          if (url) setWikiImageUrl(url);
        });
      }

      // Save daily state
      if (mode === 'daily' && puzzle) {
        saveDailyState({
          date: getTodayString(),
          puzzleId: puzzle.id,
          guesses,
          gameStatus,
          letterStates,
          elapsedTime,
        });
      }
    }
    restoredDailyRef.current = false;
  }, [gameStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Also save daily state after each guess (so in-progress games persist)
  useEffect(() => {
    if (mode === 'daily' && gameStatus === 'playing' && guesses.length > 0 && puzzle) {
      saveDailyState({
        date: getTodayString(),
        puzzleId: puzzle.id,
        guesses,
        gameStatus,
        letterStates,
        elapsedTime,
      });
    }
  }, [guesses, mode, gameStatus, letterStates, elapsedTime, puzzle]);

  const buildLetterStates = useCallback((allGuesses: Guess[]) => {
    const states: Record<string, TileState> = {};
    allGuesses.forEach(guess => {
      const letters = normalizeString(guess.word).split('');
      letters.forEach((letter, index) => {
        const key = letter.toUpperCase();
        const current = states[key];
        const next = guess.tiles[index];
        if (next === 'correct') {
          states[key] = 'correct';
        } else if (next === 'present' && current !== 'correct') {
          states[key] = 'present';
        } else if (!current) {
          states[key] = next;
        }
      });
    });
    setLetterStates(states);
  }, []);

  const handleKey = useCallback((key: string) => {
    if (gameStatus !== 'playing' || !puzzle) return;

    if (key === 'ENTER') {
      const normalizedGuess = normalizeString(currentGuess);
      if (normalizedGuess.length !== answerLength) {
        setShouldShake(true);
        setMessage(`Need ${answerLength} letters`);
        setTimeout(() => { setShouldShake(false); setMessage(''); }, 1500);
        return;
      }

      const tiles = evaluateGuess(currentGuess, puzzle.answer);
      const newGuess: Guess = { word: currentGuess, tiles };
      const newGuesses = [...guesses, newGuess];

      setGuesses(newGuesses);
      setCurrentGuess('');
      buildLetterStates(newGuesses);

      const won = checkWin(tiles);
      const lost = !won && newGuesses.length >= MAX_GUESSES;

      if (won) setGameStatus('won');
      else if (lost) setGameStatus('lost');
    } else if (key === 'BACK' || key === 'BACKSPACE') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (/^[A-Z]$/.test(key)) {
      const normalized = normalizeString(currentGuess + key);
      if (normalized.length <= answerLength) {
        setCurrentGuess(prev => prev + key);
      }
    }
  }, [gameStatus, puzzle, currentGuess, answerLength, guesses, buildLetterStates]);

  // Physical keyboard
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

  // Map our TileState to Keyboard's LetterState
  const keyboardLetterStates = useMemo(() => {
    const mapped: Record<string, 'correct' | 'present' | 'absent'> = {};
    for (const [key, val] of Object.entries(letterStates)) {
      if (val === 'correct' || val === 'present' || val === 'absent') {
        mapped[key] = val;
      }
    }
    return mapped;
  }, [letterStates]);

  const handleHintClue = useCallback(async () => {
    if (!puzzle || gameStatus !== 'playing') return;
    const hintGuess = await hints.fetchClue(puzzle, answerLength);
    if (hintGuess) {
      const newGuesses = [...guesses, hintGuess];
      setGuesses(newGuesses);
      if (newGuesses.length >= MAX_GUESSES) setGameStatus('lost');
    }
  }, [puzzle, gameStatus, guesses, answerLength, hints]);

  const handleVowelReveal = useCallback(() => {
    if (!puzzle || gameStatus !== 'playing') return;
    const hintGuess = hints.revealVowel(puzzle);
    if (hintGuess) {
      const newGuesses = [...guesses, hintGuess];
      setGuesses(newGuesses);
      if (newGuesses.length >= MAX_GUESSES) setGameStatus('lost');
    }
  }, [puzzle, gameStatus, guesses, hints]);

  const handleConsonantReveal = useCallback(() => {
    if (!puzzle || gameStatus !== 'playing') return;
    const hintGuess = hints.revealConsonant(puzzle);
    if (hintGuess) {
      const newGuesses = [...guesses, hintGuess];
      setGuesses(newGuesses);
      if (newGuesses.length >= MAX_GUESSES) setGameStatus('lost');
    }
  }, [puzzle, gameStatus, guesses, hints]);

  const handlePlayAgain = useCallback(() => {
    if (puzzle) setPlayedIds(prev => [...prev, puzzle.id]);
    const p = getRandomPuzzle(puzzle ? [...playedIds, puzzle.id] : playedIds);
    setPuzzle(p);
    setGuesses([]);
    setCurrentGuess('');
    setGameStatus('playing');
    setLetterStates({});
    setMessage('');
    setShowVictory(false);
    setElapsedTime(0);
    setStartTime(Date.now());
    setWikiImageUrl(null);
    setWikiImageLoaded(false);
    hints.resetHints();
    setMode('practice');
  }, [puzzle, playedIds, hints]);

  const handleShare = useCallback(async () => {
    if (!puzzle) return;
    const grid = guesses.map(g =>
      g.tiles.map(t => (t === 'correct' ? 'CORRECT' : t === 'present' ? 'PRESENT' : 'ABSENT') as 'CORRECT' | 'PRESENT' | 'ABSENT')
    );
    const emojiGrid = generateEmojiGrid(grid);
    const text = generateShareText({
      mode: 'ProperNoundle',
      won: gameStatus === 'won',
      guesses: guesses.length,
      maxGuesses: MAX_GUESSES,
      timeSeconds: elapsedTime,
      emojiGrid,
    });
    const ok = await copyShareToClipboard(text);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }, [puzzle, guesses, gameStatus, elapsedTime]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  if (!puzzle) return null;

  const categoryColor = puzzle.themeCategory ? CATEGORY_COLORS[puzzle.themeCategory] || '#7c3aed' : '#7c3aed';
  const categoryLabel = puzzle.themeCategory ? CATEGORY_LABELS[puzzle.themeCategory] || puzzle.themeCategory : '';

  return (
    <div className="h-[100dvh] flex flex-col relative" style={{ backgroundColor: '#f8f7ff' }}>
      <AnimatePresence>
        {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} guesses={guesses.length} maxGuesses={MAX_GUESSES} timeSeconds={elapsedTime} solution={puzzle.display} />}
      </AnimatePresence>

      {/* Header */}
      <div className="text-center py-2 px-2 shrink-0">
        <h1 className="text-2xl font-black" style={{ color: '#dc2626' }}>
          PROPERNOUNDLE
        </h1>
        <div className="flex justify-center items-center gap-2 mt-1">
          {mode === 'daily' && (
            <span className="text-gray-400 text-xs font-bold">#{getDailyPuzzleNumber()}</span>
          )}
          {categoryLabel && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: categoryColor }}
            >
              {categoryLabel}
            </span>
          )}
          <span className="text-gray-400 text-xs font-bold">
            {answerLength} letters
          </span>
          <span className="text-gray-400 text-xs font-bold">
            <Clock className="w-3 h-3 inline mr-0.5" />{formatTime(elapsedTime)}
          </span>
        </div>

        {/* Mode toggle — Practice only for Pro users */}
        <div className="flex justify-center gap-2 mt-2">
          <button
            onClick={() => setMode('daily')}
            className={`text-xs font-bold px-3 py-1 rounded-full border transition-all ${
              mode === 'daily'
                ? 'border-red-400 bg-red-50 text-red-600'
                : 'border-gray-200 text-gray-400'
            }`}
          >
            Daily
          </button>
          {isPro && (
            <button
              onClick={() => { setMode('practice'); }}
              className={`text-xs font-bold px-3 py-1 rounded-full border transition-all ${
                mode === 'practice'
                  ? 'border-red-400 bg-red-50 text-red-600'
                  : 'border-gray-200 text-gray-400'
              }`}
            >
              Practice
            </button>
          )}
        </div>

        {/* Hint display */}
        {hints.hint && (
          <div className="mt-2 mx-4 p-2 rounded-lg border border-gray-200 bg-white">
            <p className="text-xs text-gray-500 italic leading-relaxed">{hints.hint}</p>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className="mt-1">
            <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-lg">{message}</span>
          </div>
        )}

        {/* Win/Loss state */}
        {gameStatus === 'won' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 flex flex-col items-center gap-2"
          >
            {/* Wikipedia image */}
            {wikiImageUrl && (
              <div className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-green-200 shadow-md">
                <img
                  src={wikiImageUrl}
                  alt={puzzle.display}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${wikiImageLoaded ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setWikiImageLoaded(true)}
                />
                {!wikiImageLoaded && (
                  <div className="absolute inset-0 bg-gray-100 animate-pulse" />
                )}
              </div>
            )}
            <span className="text-green-600 text-xs font-bold">
              {puzzle.display} — solved in {guesses.length} {guesses.length === 1 ? 'guess' : 'guesses'}  ·  {formatTime(elapsedTime)}
            </span>
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 text-xs font-bold underline">Home</Link>
              <button onClick={handleShare} className="text-blue-500 text-xs font-bold underline">{copied ? 'Copied!' : 'Share'}</button>
              {mode !== 'daily' && isPro && <button onClick={handlePlayAgain} className="text-red-600 text-xs font-bold underline">Play Again</button>}
            </div>
          </motion.div>
        )}
        {gameStatus === 'lost' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 flex flex-col items-center gap-2"
          >
            {/* Wikipedia image */}
            {wikiImageUrl && (
              <div className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-red-200 shadow-md">
                <img
                  src={wikiImageUrl}
                  alt={puzzle.display}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${wikiImageLoaded ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setWikiImageLoaded(true)}
                />
                {!wikiImageLoaded && (
                  <div className="absolute inset-0 bg-gray-100 animate-pulse" />
                )}
              </div>
            )}
            <span className="text-red-500 text-xs font-bold">
              The answer was: {puzzle.display}
            </span>
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 text-xs font-bold underline">Home</Link>
              <button onClick={handleShare} className="text-blue-500 text-xs font-bold underline">{copied ? 'Copied!' : 'Share'}</button>
              {mode !== 'daily' && isPro && <button onClick={handlePlayAgain} className="text-red-600 text-xs font-bold underline">Play Again</button>}
            </div>
          </motion.div>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-2 pb-2">
        <NoundleBoard
          guesses={guesses}
          currentGuess={currentGuess}
          maxGuesses={MAX_GUESSES}
          answerLength={answerLength}
          answerDisplay={puzzle.display}
          shouldShake={shouldShake}
        />
      </div>

      {/* Hint Buttons */}
      {gameStatus === 'playing' && (
        <div className="shrink-0 flex justify-center gap-2 px-4 pb-2">
          <button
            onClick={handleHintClue}
            disabled={hints.hintUsed || hints.loadingHint}
            className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
              hints.hintUsed
                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                : 'border-purple-300 text-purple-600 bg-purple-50 hover:bg-purple-100'
            }`}
          >
            {hints.loadingHint ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Lightbulb className="w-3 h-3" />
            )}
            Clue
          </button>
          <button
            onClick={handleVowelReveal}
            disabled={hints.vowelUsed}
            className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
              hints.vowelUsed
                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                : 'border-blue-300 text-blue-600 bg-blue-50 hover:bg-blue-100'
            }`}
          >
            <Eye className="w-3 h-3" />
            {hints.vowelRevealed ? hints.vowelRevealed : 'Vowel'}
          </button>
          <button
            onClick={handleConsonantReveal}
            disabled={hints.consonantUsed}
            className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
              hints.consonantUsed
                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                : 'border-green-300 text-green-600 bg-green-50 hover:bg-green-100'
            }`}
          >
            <Hash className="w-3 h-3" />
            {hints.consonantRevealed ? hints.consonantRevealed : 'Consonant'}
          </button>
        </div>
      )}

      {/* Keyboard */}
      <div className="shrink-0 pb-2 px-2 pt-1">
        <Keyboard onKey={handleKey} letterStates={keyboardLetterStates} />
      </div>
    </div>
  );
}
