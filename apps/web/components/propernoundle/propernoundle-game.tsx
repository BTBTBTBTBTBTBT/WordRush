'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Keyboard } from '@/components/game/keyboard';
import { VictoryAnimation } from '@/components/effects/victory-animation';
import { GameOverAnimation } from '@/components/effects/game-over-animation';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Lightbulb, Eye, Hash, Loader2 } from 'lucide-react';
import { GameHomeButton } from '@/components/game/game-home-button';
import NoundleBoard from './noundle-board';
import { Puzzle, Guess, TileState } from './types';
import { normalizeString, evaluateGuess, checkWin } from './game-logic';
import { getDailyPuzzle, getRandomPuzzle, getDailyPuzzleNumber, getPuzzleById } from './puzzle-service';
import { useHints, type PersistedHintState } from './use-hints';
import { fetchWikipediaImage } from './wikipedia';
import { recordModePlayed } from '@/lib/play-limit-service';
import { shareResult } from '@/lib/share-utils';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult, recordSoloMatch, type XpResult } from '@/lib/stats-service';
import { XpToast } from '@/components/effects/xp-toast';
import { generateDailySeed } from '@wordle-duel/core';
import { getTodayLocal } from '@/lib/daily-service';
import { useActivePlayTimer } from '@/hooks/use-active-play-timer';
import { BottomNav } from '@/components/ui/bottom-nav';

const MAX_GUESSES = 6;
const DAILY_STORAGE_KEY = 'wordocious-propernoundle-daily';
const PRACTICE_STORAGE_KEY = 'wordocious-propernoundle-practice';
const PRACTICE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

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
  // Optional for backwards compat with saves from before hint persistence
  // was added — older entries hydrate with the default empty hint state.
  hintState?: PersistedHintState;
}

interface PracticeState {
  puzzleId: string;
  guesses: Guess[];
  gameStatus: 'playing' | 'won' | 'lost';
  letterStates: Record<string, TileState>;
  elapsedTime: number;
  savedAt: number;
  // Optional for backwards compat — see DailyState.
  hintState?: PersistedHintState;
}

function getSavedDailyState(puzzleId: string): DailyState | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(DAILY_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    // Fail-closed guard: clear the save unless BOTH the date and the
    // puzzleId match today's daily. The previous version short-circuited
    // the puzzleId check when `parsed.puzzleId` was falsy — which made
    // legacy saves written before puzzleId was persisted (or any save
    // missing the field) bypass the puzzle check entirely and restore a
    // stale completed board under the wrong puzzle. See: user stuck on
    // "Denver" completed screen after the daily had already rolled over.
    if (parsed.date !== getTodayLocal() || parsed.puzzleId !== puzzleId) {
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

function getSavedPracticeState(): PracticeState | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(PRACTICE_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    // Expire practice saves after 24h so stale sessions don't linger.
    if (!parsed.savedAt || Date.now() - parsed.savedAt > PRACTICE_TTL_MS) {
      localStorage.removeItem(PRACTICE_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function savePracticeState(state: Omit<PracticeState, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch {}
}

interface ProperNoundleGameProps {
  /**
   * True when launched from the Daily CTA (/propernoundle?daily=true). The
   * game pins to today's deterministic daily puzzle, gates the play-again
   * button, and records a daily_result row on completion. When false
   * (/propernoundle), the game runs in unlimited/practice mode — each
   * completion offers a fresh random puzzle. Pro-gating for unlimited
   * access is enforced by the home-screen cards, not this component.
   */
  isDaily?: boolean;
}

export function ProperNoundleGame({ isDaily = false }: ProperNoundleGameProps = {}) {
  const { profile, isProActive } = useAuth();
  const isPro = isProActive;
  // URL-driven, no persistence — the Daily/Practice switcher is gone, so
  // `mode` is fully derived from the route. This keeps behaviour in sync
  // with every other mode (quordle, octordle, sequence, rescue, gauntlet)
  // which all route daily via ?daily=true and unlimited via the bare path.
  const mode: GameMode = isDaily ? 'daily' : 'practice';
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [letterStates, setLetterStates] = useState<Record<string, TileState>>({});
  const [shouldShake, setShouldShake] = useState(false);
  const [message, setMessage] = useState('');
  const [showVictory, setShowVictory] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const {
    elapsedSeconds: elapsedTime,
    reset: resetTimer,
  } = useActivePlayTimer(gameStatus === 'playing', 0);
  const [playedIds, setPlayedIds] = useState<string[]>([]);
  const [wikiImageUrl, setWikiImageUrl] = useState<string | null>(null);
  const [wikiImageLoaded, setWikiImageLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const restoredDailyRef = useRef(false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);

  const hints = useHints();

  const answerLength = puzzle ? normalizeString(puzzle.answer).length : 0;

  // Empty hint-state fallback used when restoring from a save that predates
  // hint persistence — ensures older entries still hydrate cleanly.
  const emptyHintState: PersistedHintState = {
    hint: null,
    hintUsed: false,
    vowelRevealed: null,
    vowelUsed: false,
    consonantRevealed: null,
    consonantUsed: false,
  };

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
        resetTimer(saved.elapsedTime);
        setCurrentGuess('');
        setMessage('');
        // Restore the clue text, revealed letters, and used flags so a
        // completed-save looks exactly like it did when the game ended.
        hints.restoreHints(saved.hintState ?? emptyHintState);
        restoredDailyRef.current = true;
        // Completed restore → recording already happened on the
        // original play session. Mark so the game-over effects below
        // don't re-fire recordResult on every re-mount (which was
        // silently re-adding XP every time the player revisited the
        // finished puzzle).
        hasRecordedRef.current = true;
        return;
      } else if (saved && saved.gameStatus === 'playing') {
        setGuesses(saved.guesses);
        setLetterStates(saved.letterStates);
        resetTimer(saved.elapsedTime);
        setCurrentGuess('');
        setGameStatus('playing');
        setMessage('');
        // Restore hints so returning mid-game keeps the clue visible and
        // doesn't let the player re-use an already-spent hint slot.
        hints.restoreHints(saved.hintState ?? emptyHintState);
        restoredDailyRef.current = false;
        return;
      }
      // Fresh daily
      setGuesses([]);
      setCurrentGuess('');
      setGameStatus('playing');
      setLetterStates({});
      setMessage('');
      resetTimer(0);
      restoredDailyRef.current = false;
    } else {
      // Practice: first check for a saved in-progress or completed practice
      // session so navigating away and back resumes on the same puzzle.
      const savedPractice = getSavedPracticeState();
      const savedPuzzle = savedPractice ? getPuzzleById(savedPractice.puzzleId) : null;
      if (savedPractice && savedPuzzle) {
        setPuzzle(savedPuzzle);
        setGuesses(savedPractice.guesses);
        setLetterStates(savedPractice.letterStates);
        resetTimer(savedPractice.elapsedTime);
        setCurrentGuess('');
        setMessage('');
        if (savedPractice.gameStatus !== 'playing') {
          setGameStatus(savedPractice.gameStatus);
          // Completed save: don't re-run victory animation or re-record stats.
          restoredDailyRef.current = true;
          hasRecordedRef.current = true; // prevent duplicate XP on re-mount
        } else {
          setGameStatus('playing');
          restoredDailyRef.current = false;
        }
        // Restore hints and return early so the fresh-game reset block
        // below doesn't wipe what we just loaded. (Previously this branch
        // fell through to hints.resetHints(), which is why the clue
        // disappeared on navigation-back and the player could re-burn
        // another guess slot re-fetching it.)
        hints.restoreHints(savedPractice.hintState ?? emptyHintState);
        setShowVictory(false);
        setWikiImageUrl(null);
        setWikiImageLoaded(false);
        return;
      } else {
        const p = getRandomPuzzle(playedIds);
        setPuzzle(p);
        setGuesses([]);
        setCurrentGuess('');
        setGameStatus('playing');
        setLetterStates({});
        setMessage('');
        resetTimer(0);
        restoredDailyRef.current = false;
      }
    }
    setShowVictory(false);
    setWikiImageUrl(null);
    setWikiImageLoaded(false);
    hints.resetHints();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track whether we've recorded this game to avoid duplicate recordings
  const hasRecordedRef = useRef(false);

  // Record game result helper
  const recordResult = useCallback(() => {
    if (!profile || hasRecordedRef.current) return;
    if (gameStatus !== 'won' && gameStatus !== 'lost') return;
    hasRecordedRef.current = true;
    const timeMs = elapsedTime * 1000;
    const seed = mode === 'daily' ? generateDailySeed(getTodayLocal(), 'PROPERNOUNDLE') : undefined;
    recordGameResult(
      profile.id,
      'PROPERNOUNDLE',
      'solo',
      gameStatus === 'won',
      guesses.length,
      timeMs,
      seed,
      gameStatus === 'won' ? 1 : 0,
      1
    ).then(xp => { if (xp) setXpResult(xp); });
    if (puzzle) {
      recordSoloMatch({
        userId: profile.id,
        gameMode: 'PROPERNOUNDLE',
        won: gameStatus === 'won',
        score: guesses.length,
        timeSeconds: elapsedTime,
        seed: seed ?? puzzle.id,
        solutions: [puzzle.answer],
        guesses: guesses.map(g => g.word),
        startedAtIso: new Date(Date.now() - elapsedTime * 1000).toISOString(),
      });
    }
  }, [profile, gameStatus, elapsedTime, mode, guesses, puzzle]);

  // Game over effects
  useEffect(() => {
    if (gameStatus === 'won' && !restoredDailyRef.current) {
      setShowVictory(true);
    }
    if (gameStatus === 'lost' && !restoredDailyRef.current) {
      setShowGameOver(true);
    }
    if (gameStatus === 'won' || gameStatus === 'lost') {
      recordModePlayed('propernoundle');
      recordResult();

      // Fetch Wikipedia image for result screen
      if (puzzle) {
        setWikiImageUrl(null);
        setWikiImageLoaded(false);
        fetchWikipediaImage(puzzle.display, puzzle.wikiTitle).then(url => {
          if (url) setWikiImageUrl(url);
        });
      }

      // Save terminal state so returning shows the completed board —
      // include hint state so any clue/vowel/consonant used during play
      // is still visible when the user returns to the finished puzzle.
      if (puzzle) {
        const persistedHints: PersistedHintState = {
          hint: hints.hint,
          hintUsed: hints.hintUsed,
          vowelRevealed: hints.vowelRevealed,
          vowelUsed: hints.vowelUsed,
          consonantRevealed: hints.consonantRevealed,
          consonantUsed: hints.consonantUsed,
        };
        if (mode === 'daily') {
          saveDailyState({
            date: getTodayLocal(),
            puzzleId: puzzle.id,
            guesses,
            gameStatus,
            letterStates,
            elapsedTime,
            hintState: persistedHints,
          });
        } else {
          savePracticeState({
            puzzleId: puzzle.id,
            guesses,
            gameStatus,
            letterStates,
            elapsedTime,
            hintState: persistedHints,
          });
        }
      }
    }
    restoredDailyRef.current = false;
  }, [gameStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-attempt recording when profile loads (handles restored daily games
  // where profile wasn't available when gameStatus first changed)
  useEffect(() => {
    if (profile && (gameStatus === 'won' || gameStatus === 'lost')) {
      recordResult();
    }
  }, [profile, recordResult, gameStatus]);

  // Save in-progress state after each guess so games persist across
  // navigate-away / navigate-back cycles in both daily and practice.
  // hintState is persisted too so that a clue fetched mid-game survives
  // navigation and doesn't cost a second hint slot on return. The hint
  // fields are in the dep array so the save also fires when the player
  // uses a hint without (yet) entering a new guess.
  useEffect(() => {
    if (gameStatus !== 'playing' || !puzzle) return;
    // Don't persist an empty board with no hints — there's nothing to restore
    // and it would stamp a stale save over an otherwise-absent entry.
    if (guesses.length === 0 && !hints.hint && !hints.vowelUsed && !hints.consonantUsed) return;
    const persistedHints: PersistedHintState = {
      hint: hints.hint,
      hintUsed: hints.hintUsed,
      vowelRevealed: hints.vowelRevealed,
      vowelUsed: hints.vowelUsed,
      consonantRevealed: hints.consonantRevealed,
      consonantUsed: hints.consonantUsed,
    };
    if (mode === 'daily') {
      saveDailyState({
        date: getTodayLocal(),
        puzzleId: puzzle.id,
        guesses,
        gameStatus,
        letterStates,
        elapsedTime,
        hintState: persistedHints,
      });
    } else {
      savePracticeState({
        puzzleId: puzzle.id,
        guesses,
        gameStatus,
        letterStates,
        elapsedTime,
        hintState: persistedHints,
      });
    }
  }, [
    guesses,
    mode,
    gameStatus,
    letterStates,
    elapsedTime,
    puzzle,
    hints.hint,
    hints.hintUsed,
    hints.vowelRevealed,
    hints.vowelUsed,
    hints.consonantRevealed,
    hints.consonantUsed,
  ]);

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

      if (guesses.some((g) => normalizeString(g.word) === normalizedGuess)) {
        setShouldShake(true);
        setMessage('Already guessed');
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
    resetTimer(0);
    hasRecordedRef.current = false;
    setWikiImageUrl(null);
    setWikiImageLoaded(false);
    hints.resetHints();
  }, [puzzle, playedIds, hints]);

  const handleShare = useCallback(async () => {
    if (!puzzle) return;
    // ProperNoundle tile states are lowercase internally; normalize to the
    // uppercase form the share image expects. Pad to MAX_GUESSES with
    // empty rows sized to the puzzle's normalized answer length.
    const answerLen = normalizeString(puzzle.answer).length;
    const played = guesses.map(g =>
      g.tiles.map(t => (t === 'correct' ? 'CORRECT' : t === 'present' ? 'PRESENT' : 'ABSENT') as 'CORRECT' | 'PRESENT' | 'ABSENT')
    );
    const grid: ('CORRECT' | 'PRESENT' | 'ABSENT' | 'EMPTY')[][] = [
      ...played,
      ...Array(Math.max(0, MAX_GUESSES - played.length)).fill(
        Array(answerLen).fill('EMPTY' as const),
      ),
    ];
    // Letters-per-word, matching the in-game NoundleBoard word-group
    // rendering. For "Kylian Mbappe" → [6, 6], which the share image
    // uses to insert a larger gap between the first and last name so
    // the tiles read as two words instead of one 12-letter smush.
    const wordGroups = puzzle.answer
      .split(/\s+/)
      .map(w => normalizeString(w).length)
      .filter(n => n > 0);
    const categoryLabel = puzzle.themeCategory
      ? CATEGORY_LABELS[puzzle.themeCategory] || puzzle.themeCategory
      : undefined;
    const out = await shareResult({
      layout: 'single',
      mode: 'ProperNoundle',
      won: gameStatus === 'won',
      guesses: guesses.length,
      maxGuesses: MAX_GUESSES,
      timeSeconds: elapsedTime,
      grid,
      category: categoryLabel,
      wordGroups: wordGroups.length > 1 ? wordGroups : undefined,
    });
    if (out.via !== 'failed') { setCopied(true); setTimeout(() => setCopied(false), 2000); }
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
    <div
      className={`h-[100dvh] flex flex-col relative ${gameStatus !== 'playing' ? 'pb-[calc(env(safe-area-inset-bottom)+64px)]' : ''}`}
      style={{ backgroundColor: '#f8f7ff' }}
    >
      <AnimatePresence>
        {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} guesses={guesses.length} maxGuesses={MAX_GUESSES} timeSeconds={elapsedTime} solution={puzzle.display} />}
        {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={guesses.length} maxGuesses={MAX_GUESSES} timeSeconds={elapsedTime} solution={puzzle.display} />}
      </AnimatePresence>
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      {/* Header */}
      <div className="text-center py-2 px-2 shrink-0 relative">
        <GameHomeButton accentColor="#dc2626" />
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

      {/* Keyboard — hidden when game is complete */}
      {gameStatus === 'playing' && (
        <div className="shrink-0 pb-2 px-2 pt-1">
          <Keyboard onKey={handleKey} letterStates={keyboardLetterStates} />
        </div>
      )}

      {gameStatus !== 'playing' && <BottomNav />}
    </div>
  );
}
