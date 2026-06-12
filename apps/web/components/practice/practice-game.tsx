'use client';

import { useReducer, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GameMode, GameStatus, evaluateGuess, gameReducer, createInitialState, generateMatchSeed, getDailySeedDate, isValidWord } from '@wordle-duel/core';
import { Board } from '@/components/game/board';
import { Keyboard } from '@/components/game/keyboard';
import dynamic from 'next/dynamic';
const VictoryAnimation = dynamic(() => import('@/components/effects/victory-animation').then(m => m.VictoryAnimation), { ssr: false });
const GameOverAnimation = dynamic(() => import('@/components/effects/game-over-animation').then(m => m.GameOverAnimation), { ssr: false });
import { Clock } from 'lucide-react';
import { GameHomeButton } from '@/components/game/game-home-button';
import { SoundToggle } from '@/components/game/sound-toggle';
import Link from 'next/link';
import { PostGameSummary } from '@/components/game/post-game-summary';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult, recordSoloMatch, type XpResult } from '@/lib/stats-service';
import { recordDailyResult } from '@/lib/daily-service';
import { recordModePlayed } from '@/lib/play-limit-service';
import { XpToast } from '@/components/effects/xp-toast';
import { DailyRankBadge } from '@/components/game/daily-rank-badge';
import { shareResult } from '@/lib/share-utils';
import { playInvalid } from '@/lib/sounds';
import { loadGameSession, useGameSnapshot, useServerDailyReplay } from '@/hooks/use-game-snapshot';
import { useActivePlayTimer } from '@/hooks/use-active-play-timer';
import { BottomNav } from '@/components/ui/bottom-nav';
import { useClassicHints, type PersistedClassicHintState } from '@/hooks/use-classic-hints';

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
  const [isShaking, setIsShaking] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);

  // --- Classic hints (Six/Seven only) ---
  const hasHints = mode === GameMode.DUEL_6 || mode === GameMode.DUEL_7;
  const hints = useClassicHints();
  // Include seed in key so daily hints don't carry over to the next day's puzzle
  const hintStorageKey = `wordocious-hints-${mode}-${gameSeed}`;

  // Restore hint state on mount
  useState(() => {
    if (!hasHints || typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(hintStorageKey);
      if (saved) {
        const parsed: PersistedClassicHintState = JSON.parse(saved);
        hints.restoreHints(parsed);
      }
      // Clean up old hint keys for this mode (previous seeds/days)
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`wordocious-hints-${mode}-`) && key !== hintStorageKey) {
          localStorage.removeItem(key);
        }
      }
    } catch {}
  });

  // Persist hint state on change
  useEffect(() => {
    if (!hasHints || typeof window === 'undefined') return;
    try {
      const payload: PersistedClassicHintState = {
        vowelUsed: hints.vowelUsed,
        consonantUsed: hints.consonantUsed,
        vowelRevealed: hints.vowelRevealed,
        consonantRevealed: hints.consonantRevealed,
      };
      localStorage.setItem(hintStorageKey, JSON.stringify(payload));
    } catch {}
  }, [hasHints, hintStorageKey, hints.vowelUsed, hints.consonantUsed, hints.vowelRevealed, hints.consonantRevealed]);

  // If a completed save was loaded, flag it so the victory/recording effect
  // below doesn't refire. Reset to false on RESET.
  const isRestoredCompleted = useRef(savedSession?.isCompleted ?? false);

  // Count the hint actions the player burned. Six/Seven expose two
  // hint slots (vowel + consonant); each counts independently toward
  // the score-breakdown penalty and the Pure achievement gate. Modes
  // without hints stay at 0 and the breakdown card hides the row.
  const hintsUsed = hasHints
    ? (hints.vowelUsed ? 1 : 0) + (hints.consonantUsed ? 1 : 0)
    : 0;

  // Re-record a restored daily completion that may have failed to persist
  // (e.g. if a DB constraint was missing when the game was originally played).
  // ONLY the daily_results row (best-score upsert, idempotent) — NEVER
  // recordGameResult: that pipeline increments user_stats/profile counters and
  // XP, and re-running it per browser session minted phantom wins (the
  // "46 games vs 39 in the chart" bug).
  useEffect(() => {
    if (!isRestoredCompleted.current || !profile || !isDaily) return;
    if (state.status !== GameStatus.WON && state.status !== GameStatus.LOST) return;
    const guardKey = `wordocious-rerecord-${mode}-${gameSeed}`;
    try { if (sessionStorage.getItem(guardKey)) return; } catch {}
    const guesses = currentBoard.guesses.length;
    recordDailyResult(
      profile.id, mode, 'solo',
      state.status === GameStatus.WON, guesses, savedSession?.elapsedTime ?? 0,
      state.status === GameStatus.WON ? 1 : 0, 1, hintsUsed,
      // Day derived from the daily seed so a re-record that happens after
      // local midnight still lands on the day the puzzle was issued for.
      getDailySeedDate(gameSeed) ?? undefined,
    ).catch(() => {});
    // Ensure freemium lock shows correctly for this mode
    const modePlayId = mode === GameMode.DUEL_6 ? 'six' : mode === GameMode.DUEL_7 ? 'seven' : 'practice';
    recordModePlayed(modePlayId);
    try { sessionStorage.setItem(guardKey, '1'); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const { elapsedSeconds: elapsedTime, reset: resetTimer } = useActivePlayTimer(
    state.status === GameStatus.PLAYING,
    savedSession?.elapsedTime ?? 0,
  );

  // Snapshot persistence — saves the reducer state on every change, loads
  // on mount via the lazy initializers above.
  useGameSnapshot(mode, !!isDaily, gameSeed, state, elapsedTime);

  // Cross-device fallback: a daily already played on the native app (or
  // another browser) has no local snapshot, so replay it from the server's
  // matches row. Flag restored-completed BEFORE dispatching so the
  // record-on-finish effect below sees the ref and doesn't re-record.
  useServerDailyReplay(mode, !!isDaily, gameSeed, profile?.id, !!savedSession, state, (session) => {
    isRestoredCompleted.current = true;
    dispatch({ type: 'RESTORE_STATE', state: session.state });
    resetTimer(session.elapsedTime);
  });

  const currentBoard = state.boards[state.currentBoardIndex];

  const evaluations = useMemo(() => {
    return currentBoard.guesses.map((g, i) => {
      // Use stored hint evaluation for hint rows instead of evaluateGuess
      if (currentBoard.hintEvaluations?.[i]) return currentBoard.hintEvaluations[i];
      return evaluateGuess(currentBoard.solution, g);
    });
  }, [currentBoard.guesses, currentBoard.solution, currentBoard.hintEvaluations]);

  const letterStates = useMemo(() => {
    const states: Record<string, 'correct' | 'present' | 'absent'> = {};
    for (const eval_ of evaluations) {
      for (const tile of eval_.tiles) {
        const letter = tile.letter.toUpperCase();
        if (letter < 'A' || letter > 'Z') continue; // skip blanks from hint rows
        if (tile.state === 'CORRECT') states[letter] = 'correct';
        else if (tile.state === 'PRESENT' && states[letter] !== 'correct') states[letter] = 'present';
        else if (tile.state === 'ABSENT' && !states[letter]) states[letter] = 'absent';
      }
    }
    return states;
  }, [evaluations]);

  useEffect(() => {
    if (state.status === GameStatus.WON && !isRestoredCompleted.current) setShowVictory(true);
    if (state.status === GameStatus.LOST && !isRestoredCompleted.current) setShowGameOver(true);
    if (profile && !isRestoredCompleted.current && (state.status === GameStatus.WON || state.status === GameStatus.LOST)) {
      // useActivePlayTimer freezes elapsedTime as soon as isPlaying flips
      // false, so the value here matches what the user saw in the header,
      // VictoryAnimation, and PostGameSummary at the moment of completion.
      const timeMs = elapsedTime * 1000;
      const guesses = currentBoard.guesses.length;
      recordGameResult(profile.id, mode, 'solo', state.status === GameStatus.WON, guesses, timeMs, gameSeed, state.status === GameStatus.WON ? 1 : 0, 1, hintsUsed)
        .then(xp => { if (xp) setXpResult(xp); });
      recordSoloMatch({
        userId: profile.id,
        gameMode: mode,
        won: state.status === GameStatus.WON,
        score: guesses,
        timeSeconds: elapsedTime,
        seed: gameSeed,
        solutions: [currentBoard.solution],
        guesses: currentBoard.guesses,
        startedAtIso: new Date(Date.now() - elapsedTime * 1000).toISOString(),
        hintsUsed,
      });
    }
    if (!isRestoredCompleted.current && (state.status === GameStatus.WON || state.status === GameStatus.LOST)) {
      const modePlayId = mode === GameMode.DUEL_6 ? 'six' : mode === GameMode.DUEL_7 ? 'seven' : 'practice';
      recordModePlayed(modePlayId);
    }
  }, [state.status]);

  const handleKey = useCallback((key: string) => {
    if (currentBoard.status !== GameStatus.PLAYING) return;
    if (isShaking) return;
    setMessage('');

    if (key === 'ENTER') {
      if (currentGuess.length !== currentBoard.solution.length) {
        setMessage('Not enough letters');
        playInvalid();
        setIsShaking(true);
        setTimeout(() => { setCurrentGuess(''); setIsShaking(false); }, 600);
        setTimeout(() => setMessage(''), 1500);
        return;
      }
      if (!isValidWord(currentGuess)) {
        setMessage('Not in word list');
        playInvalid();
        setIsShaking(true);
        setTimeout(() => { setCurrentGuess(''); setIsShaking(false); }, 600);
        setTimeout(() => setMessage(''), 1500);
        return;
      }
      if (currentBoard.guesses.includes(currentGuess.toUpperCase())) {
        setMessage('Already guessed');
        playInvalid();
        setIsShaking(true);
        setTimeout(() => { setCurrentGuess(''); setIsShaking(false); }, 600);
        setTimeout(() => setMessage(''), 1500);
        return;
      }
      dispatch({ type: 'SUBMIT_GUESS', guess: currentGuess });
      setCurrentGuess('');
    } else if (key === 'BACK') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < currentBoard.solution.length) {
      setCurrentGuess(prev => prev + key);
    }
  }, [currentGuess, currentBoard.status, isShaking]);

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

  const handleVowelHint = useCallback(() => {
    if (!hasHints || currentBoard.status !== GameStatus.PLAYING) return;
    const result = hints.revealVowel(currentBoard.solution, currentBoard.guesses);
    if (result) {
      dispatch({ type: 'SUBMIT_HINT', hintWord: result.hintWord, hintEvaluation: result.hintEvaluation });
    }
  }, [hasHints, currentBoard.status, currentBoard.solution, currentBoard.guesses, hints.revealVowel]);

  const handleConsonantHint = useCallback(() => {
    if (!hasHints || currentBoard.status !== GameStatus.PLAYING) return;
    const result = hints.revealConsonant(currentBoard.solution, currentBoard.guesses);
    if (result) {
      dispatch({ type: 'SUBMIT_HINT', hintWord: result.hintWord, hintEvaluation: result.hintEvaluation });
    }
  }, [hasHints, currentBoard.status, currentBoard.solution, currentBoard.guesses, hints.revealConsonant]);

  const handleReset = () => {
    const newSeed = generateMatchSeed();
    setGameSeed(newSeed);
    dispatch({ type: 'RESET', seed: newSeed, mode });
    setCurrentGuess('');
    setMessage('');
    resetTimer(0);
    isRestoredCompleted.current = false;
    if (hasHints) {
      hints.resetHints();
      try { localStorage.removeItem(hintStorageKey); } catch {}
    }
  };

  const handleShare = useCallback(async () => {
    // Rows the player actually guessed, as CORRECT/PRESENT/ABSENT states.
    // Pad to maxGuesses with EMPTY rows so the share image mirrors the
    // full played board instead of floating above empty space.
    const played = evaluations.map(e =>
      e.tiles.map(t => {
        if (t.state === 'HINT_USED') return 'ABSENT' as const;
        return t.state as 'CORRECT' | 'PRESENT' | 'ABSENT';
      }),
    );
    const grid: ('CORRECT' | 'PRESENT' | 'ABSENT' | 'EMPTY')[][] = [
      ...played,
      ...Array(Math.max(0, currentBoard.maxGuesses - played.length)).fill(
        Array(currentBoard.solution.length).fill('EMPTY' as const),
      ),
    ];
    const shareModeMap: Record<string, string> = { DUEL: 'Classic', DUEL_6: 'Six', DUEL_7: 'Seven' };
    const out = await shareResult({
      layout: 'single',
      mode: (shareModeMap[mode] || 'Classic') as 'Classic' | 'Six' | 'Seven',
      won: state.status === GameStatus.WON,
      guesses: currentBoard.guesses.length,
      maxGuesses: currentBoard.maxGuesses,
      timeSeconds: elapsedTime,
      grid,
    });
    if (out.via !== 'failed') { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }, [evaluations, state.status, currentBoard, elapsedTime]);

  const guessesUsed = currentBoard.guesses.length;
  const maxGuesses = currentBoard.maxGuesses;
  const gameComplete = state.status === GameStatus.WON || state.status === GameStatus.LOST;

  return (
    <div
      className={`h-screen-stable flex flex-col relative ${gameComplete ? 'pb-[calc(env(safe-area-inset-bottom)+64px)]' : ''}`}
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} guesses={guessesUsed} maxGuesses={maxGuesses} timeSeconds={elapsedTime} solution={currentBoard.solution} />}
      {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={guessesUsed} maxGuesses={maxGuesses} timeSeconds={elapsedTime} solution={currentBoard.solution} />}
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      {/* Header */}
      <div className="text-center py-2 px-2 shrink-0 relative">
        {(() => {
          const modeConfig: Record<string, { title: string; accent: string; gradient: string }> = {
            DUEL:   { title: 'CLASSIC',       accent: '#7c3aed', gradient: 'linear-gradient(135deg, #a78bfa, #ec4899)' },
            DUEL_6: { title: 'CLASSIC SIX',   accent: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4, #22d3ee)' },
            DUEL_7: { title: 'CLASSIC SEVEN', accent: '#84cc16', gradient: 'linear-gradient(135deg, #84cc16, #a3e635)' },
          };
          const cfg = modeConfig[mode] || modeConfig.DUEL;
          return (
            <>
              <GameHomeButton accentColor={cfg.accent} />
              <SoundToggle accentColor={cfg.accent} />
              <h1 className="text-3xl font-black" style={{ backgroundImage: cfg.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', color: 'transparent' }}>
                {cfg.title}
              </h1>
            </>
          );
        })()}
        <div className="flex justify-center gap-3 mt-1">
          <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>{guessesUsed}/{maxGuesses} guesses</span>
          <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}><Clock className="w-3 h-3 inline mr-1 text-blue-400" />{formatTime(elapsedTime)}</span>
        </div>
        {message && (
          <div className="absolute left-0 right-0 z-20 text-center" style={{ top: '90px' }}>
            <span className="text-xs font-bold px-3 py-1 rounded-lg" style={{ background: '#1a1a2e', color: '#fff' }}>{message}</span>
          </div>
        )}
        {(state.status === GameStatus.WON || state.status === GameStatus.LOST) && (
          <div className="mt-1 flex flex-col items-center gap-1">
            <span className={`text-xs font-bold ${state.status === GameStatus.WON ? 'text-green-600' : 'text-red-400'}`}>
              {state.status === GameStatus.WON ? `Solved in ${guessesUsed} guesses` : `Out of guesses`}  ·  {formatTime(elapsedTime)}
            </span>
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 text-xs font-bold underline">Home</Link>
              <button onClick={handleShare} className="text-blue-500 text-xs font-bold underline">{copied ? 'Copied!' : 'Share'}</button>
              {isDaily && <DailyRankBadge gameMode={mode} />}
              {!isDaily && isPro && (
                <button onClick={handleReset} className="text-amber-600 text-xs font-bold underline">
                  {state.status === GameStatus.WON ? 'Play Again' : 'Try Again'}
                </button>
              )}
            </div>
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
            isShaking={isShaking}
            wordLength={currentBoard.solution.length}
            isInvalidWord={currentGuess.length === currentBoard.solution.length && (!isValidWord(currentGuess) || currentBoard.guesses.includes(currentGuess.toUpperCase()))}
          />

          {gameComplete && (
            <>
              <ScoreBreakdownCard
                gameMode={mode}
                completed={state.status === GameStatus.WON}
                guessCount={guessesUsed}
                timeSeconds={elapsedTime}
                boardsSolved={state.status === GameStatus.WON ? 1 : 0}
                totalBoards={1}
                hintsUsed={hintsUsed}
              />
              <PostGameSummary solution={currentBoard.solution} />
            </>
          )}
        </div>
      </div>

      {/* Hint buttons — Six/Seven only, hidden when game is complete */}
      {hasHints && !gameComplete && (
        <div className="shrink-0 flex justify-center gap-3 px-4 pb-1">
          <button
            onClick={handleVowelHint}
            disabled={hints.vowelUsed}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black transition-all disabled:opacity-40"
            style={{
              background: hints.vowelUsed ? 'var(--color-surface-alt)' : (mode === GameMode.DUEL_6 ? '#06b6d415' : '#84cc1615'),
              border: `1.5px solid ${hints.vowelUsed ? 'var(--color-border)' : (mode === GameMode.DUEL_6 ? '#06b6d4' : '#84cc16')}`,
              color: hints.vowelUsed ? 'var(--color-text-muted)' : (mode === GameMode.DUEL_6 ? '#06b6d4' : '#84cc16'),
            }}
          >
            {hints.vowelUsed ? (hints.vowelRevealed === '—' ? 'No vowels left' : `Vowel: ${hints.vowelRevealed}`) : '💡 Vowel'}
          </button>
          <button
            onClick={handleConsonantHint}
            disabled={hints.consonantUsed}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black transition-all disabled:opacity-40"
            style={{
              background: hints.consonantUsed ? 'var(--color-surface-alt)' : (mode === GameMode.DUEL_6 ? '#06b6d415' : '#84cc1615'),
              border: `1.5px solid ${hints.consonantUsed ? 'var(--color-border)' : (mode === GameMode.DUEL_6 ? '#06b6d4' : '#84cc16')}`,
              color: hints.consonantUsed ? 'var(--color-text-muted)' : (mode === GameMode.DUEL_6 ? '#06b6d4' : '#84cc16'),
            }}
          >
            {hints.consonantUsed ? (hints.consonantRevealed === '—' ? 'No consonants left' : `Consonant: ${hints.consonantRevealed}`) : '💡 Consonant'}
          </button>
        </div>
      )}

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
