'use client';
import { computeScoreBreakdown } from '@/lib/composite-scoring';

import { useReducer, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GameMode, gameReducer, getDailySeedDate, initializeGame, isWordValid } from '@wordle-duel/core';
import { MultiBoard, computeActiveLetterStates, computePerBoardLetterStates } from '../game/multi-board';
import { toRecapBoards } from '../game/completed-mini-board';
import { Keyboard } from '../game/keyboard';
import dynamic from 'next/dynamic';
const VictoryAnimation = dynamic(() => import('../effects/victory-animation').then(m => m.VictoryAnimation), { ssr: false });
const GameOverAnimation = dynamic(() => import('../effects/game-over-animation').then(m => m.GameOverAnimation), { ssr: false });
import { Clock } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import { GameHomeButton } from '@/components/game/game-home-button';
import { GameGuideButton } from '@/components/game/game-guide-button';
import { GameHostTitle } from '@/components/ui/mascot';
import { SoundToggle } from '@/components/game/sound-toggle';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult, recordSoloMatch, type XpResult } from '@/lib/stats-service';
import { XpToast } from '@/components/effects/xp-toast';
import { recordModePlayed } from '@/lib/play-limit-service';
import { shareResult } from '@/lib/share-utils';
import { chooseShareVariant } from '@/components/share/share-variant-modal';
import { boardToGrid, boardToLetters } from '@/lib/share-grid';
import { loadGameSession, useGameSnapshot, useServerDailyReplay } from '@/hooks/use-game-snapshot';
import { useActivePlayTimer } from '@/hooks/use-active-play-timer';
import { hasDuplicateGuess } from '@/lib/game-utils';
import { playInvalid } from '@/lib/sounds';
import { isTypingTarget } from '@/lib/keyboard';
import { BottomNav } from '@/components/ui/bottom-nav';
import { keyDuringReject } from '@/lib/tile-motion';
import { useRejectRow } from '@/hooks/use-reject-row';
import { latestGuess } from '@/lib/key-reveal';
import { DailyRankBadge } from '@/components/game/daily-rank-badge';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { FinishedDock, ResultStrip } from '@/components/game/finished-kit';
import { FinishedScreen, FINISHED_NAV_CLEAR } from '@/components/game/finished-screen';
import { FittedBoardsRecap } from '@/components/game/fitted-recap';
import { GameBackground } from '@/components/ui/page-background';
import { modeTrayAccent } from '@/lib/tray-fit';
import { gameHeaderStyle, gameToastTop } from '@/lib/art';

interface OctordleGameProps {
  initialSeed?: string;
  isDaily?: boolean;
}

export function OctordleGame({ initialSeed, isDaily }: OctordleGameProps = {}) {
  const { profile, isProActive } = useAuth();
  const isPro = isProActive;
  // Restore any previously saved session for this mode+variant.
  const [savedSession] = useState(() => loadGameSession(GameMode.OCTORDLE, !!isDaily));
  const [gameSeed, setGameSeed] = useState(() => savedSession?.seed ?? initialSeed ?? Date.now().toString());
  const [state, dispatch] = useReducer(
    gameReducer,
    gameSeed,
    (s) => savedSession?.state ?? initializeGame(s, GameMode.OCTORDLE),
  );

  const [currentGuess, setCurrentGuess] = useState('');
  const [error, setError] = useState('');
  const { isShaking, reject: rejectRow, cutShort: cutReject } = useRejectRow(() => setCurrentGuess(''));
  const [showVictory, setShowVictory] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);

  // Flag so the effect below doesn't refire victory/loss on mount when a
  // completed save is loaded. Reset in handleRestart.
  const isRestoredCompleted = useRef(savedSession?.isCompleted ?? false);

  const { elapsedSeconds: elapsedTime, reset: resetTimer } = useActivePlayTimer(
    state.status === 'PLAYING',
    savedSession?.elapsedTime ?? 0,
  );

  useGameSnapshot(GameMode.OCTORDLE, !!isDaily, gameSeed, state, elapsedTime);

  // Cross-device fallback: a daily already played on the native app (or
  // another browser) has no local snapshot, so replay it from the server's
  // matches row. Flag restored-completed BEFORE dispatching so the
  // record-on-finish effect below sees the ref and doesn't re-record.
  useServerDailyReplay(GameMode.OCTORDLE, !!isDaily, gameSeed, profile?.id, !!savedSession, state, (session) => {
    isRestoredCompleted.current = true;
    dispatch({ type: 'RESTORE_STATE', state: session.state });
    resetTimer(session.elapsedTime);
  });

  useEffect(() => {
    if (state.status === 'WON' && !isRestoredCompleted.current) setShowVictory(true);
    if (state.status === 'LOST' && !isRestoredCompleted.current) setShowGameOver(true);
    if (profile && !isRestoredCompleted.current && (state.status === 'WON' || state.status === 'LOST')) {
      const timeMs = elapsedTime * 1000;
      const guesses = state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0);
      const boardsSolved = state.boards.filter(b => b.status === 'WON').length;
      recordGameResult(profile.id, 'OCTORDLE', 'solo', state.status === 'WON', guesses, timeMs, gameSeed, boardsSolved, 8).then(xp => { if (xp) setXpResult(xp); });
      const longestGuesses = state.boards.reduce<string[]>((longest, b) => b.guesses.length > longest.length ? b.guesses : longest, []);
      recordSoloMatch({
        userId: profile.id,
        gameMode: 'OCTORDLE',
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
      recordModePlayed('octordle');
    }
  }, [state.status]);

  const handleKeyPress = useCallback((key: string) => {
    if (state.status !== 'PLAYING') return;
    // AQ1: a key during a not-a-word reject cuts it short; it's never dropped.
    let guess = currentGuess;
    if (isShaking) { cutReject(); guess = ''; if (keyDuringReject(key) === 'swallow') return; }
    setError('');

    if (key === 'ENTER') {
      if (currentGuess.length !== 5) { setError('Word must be 5 letters'); playInvalid(); rejectRow(currentGuess.length); setTimeout(() => setError(''), 1500); return; }
      if (!isWordValid(currentGuess)) { setError('Not in word list'); playInvalid(); rejectRow(currentGuess.length); setTimeout(() => setError(''), 1500); return; }
      if (hasDuplicateGuess(state.boards, currentGuess)) { setError('Already guessed'); playInvalid(); rejectRow(currentGuess.length); setTimeout(() => setError(''), 1500); return; }

      dispatch({ type: 'SUBMIT_GUESS', guess: currentGuess, applyToAll: true });
      setCurrentGuess('');
    } else if (key === 'BACK' || key === 'BACKSPACE') {
      setCurrentGuess((prev) => prev.slice(0, -1));
    } else if (guess.length < 5 && /^[A-Z]$/.test(key)) {
      setCurrentGuess((prev) => prev + key);
    }
  }, [state, currentGuess, isShaking]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;   // don't steal keys from a focused input/modal
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
  // R2: the strip's points — the same total the score card shows.
  const finishedPoints = state.status === 'PLAYING' ? null
    : computeScoreBreakdown('OCTORDLE', state.status === 'WON', totalGuesses, elapsedTime, state.boards.filter(b => b.status === 'WON').length, 8, 0, undefined, undefined, isDaily ? getDailySeedDate(gameSeed) ?? undefined : undefined).total;

  const handleShare = useCallback(async () => {
    const variant = await chooseShareVariant();
    if (!variant) return;
    const boards = state.boards.map(b => ({ grid: boardToGrid(b), letters: boardToLetters(b), won: b.status === 'WON', solution: b.solution }));
    const boardsSolved = boards.filter(b => b.won).length;
    const out = await shareResult({
      layout: 'multi',
      mode: 'OctoWord',
      won: state.status === 'WON',
      guesses: totalGuesses,
      maxGuesses: state.boards[0]?.maxGuesses || 13,
      timeSeconds: elapsedTime,
      boards,
      boardsSolved,
      totalBoards: 8,
      reveal: variant === 'full',
    });
    if (out.via !== 'failed') { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }, [state, totalGuesses, elapsedTime]);

  const handleRestart = () => {
    const newSeed = Date.now().toString();
    setGameSeed(newSeed);
    dispatch({ type: 'RESET', seed: newSeed, mode: GameMode.OCTORDLE });
    // §255: dismiss the celebration overlays. §242 wired "Play again" on the
    // victory card to this handler, which reset the board but left the card
    // mounted — so it kept showing, now with the NEW word and 0/6 guesses,
    // an "auto victory" (founder report). Nothing was ever recorded (the
    // recording effect only fires on WON/LOST), but it looked exactly like it.
    setShowVictory(false);
    setShowGameOver(false);
    setCurrentGuess(''); setError(''); resetTimer(0);
    isRestoredCompleted.current = false;
  };

  return (
    <GameBackground
      mode="OCTORDLE"
      className={`h-screen-stable flex flex-col relative ${state.status !== 'PLAYING' ? FINISHED_NAV_CLEAR : ''}`}
    >
      {showVictory && <VictoryAnimation mode="OCTORDLE" onComplete={() => setShowVictory(false)} guesses={totalGuesses} maxGuesses={state.boards[0]?.maxGuesses} timeSeconds={elapsedTime} boardsSolved={8} totalBoards={8} solutions={state.boards.map(b => b.solution)} points={computeScoreBreakdown('OCTORDLE', true, totalGuesses, elapsedTime, 8, 8).total} onPlayAgain={!isDaily && isPro ? handleRestart : undefined} />}
      {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={totalGuesses} maxGuesses={state.boards[0]?.maxGuesses} timeSeconds={elapsedTime} boardsSolved={completedBoards} totalBoards={8} solutions={state.boards.map(b => b.solution)} points={computeScoreBreakdown('OCTORDLE', false, totalGuesses, elapsedTime, state.boards.filter(b => b.status === 'WON').length, 8).total} onPlayAgain={!isDaily && isPro ? handleRestart : undefined} />}
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} flawlessStreak={xpResult.flawlessStreak} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      {/* Compact Header */}
      <div className="game-art-header text-center px-2 shrink-0 relative" style={gameHeaderStyle('OCTORDLE')}>
        <GameHomeButton accentColor="#7e22ce" />
        <GameGuideButton slug="octoword" accentColor="#7e22ce" />
        <SoundToggle accentColor="#7e22ce" />
        <GameHostTitle mode="OCTORDLE" label="OctoWord">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">
            OCTOWORD
          </h1>
        </GameHostTitle>
        {state.status === 'PLAYING' && <div className="flex justify-center gap-3 mt-1">
          <span className="text-gray-400 text-xs font-bold"><Icon3D name="trophy" size={14} inline className="mr-1" />{completedBoards}/8</span>
          <span className="text-gray-400 text-xs font-bold">{totalGuesses}/{state.boards[0]?.maxGuesses} guesses</span>
          <span className="text-gray-400 text-xs font-bold"><Clock className="w-3 h-3 inline mr-1 text-blue-400" />{formatTime(elapsedTime)}</span>
        </div>}
        {error && <div className="absolute left-0 right-0 z-20 text-center" style={{ top: gameToastTop(90) }}><span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-lg">{error}</span></div>}
      </div>

      {state.status === 'PLAYING' ? (
        <div className="flex-1 min-h-0 px-1 pt-2 pb-1 overflow-hidden">
          <MultiBoard accent={modeTrayAccent('OCTORDLE')} boards={state.boards} currentGuess={currentGuess} isShaking={isShaking} isInvalidWord={currentGuess.length === 5 && (!isWordValid(currentGuess) || hasDuplicateGuess(state.boards, currentGuess))} />
        </div>
      ) : (
        // FINISH_SPEC R2: one screen — the result strip, the 8 boards in the
        // mini grid with the biggest tiles that fit (2 × 2 vs 1 × 4 / 4 × 2 vs 2 × 4), the dock (share · Next daily /
        // Leaderboard · the Unlimited card); the score breakdown under "More".
        <FinishedScreen
          fit="self"
          strip={
            <ResultStrip
              won={state.status === 'WON'}
              guesses={totalGuesses}
              time={formatTime(elapsedTime)}
              points={finishedPoints}
              srText={state.status === 'WON' ? `All 8 solved in ${totalGuesses} guesses · ${formatTime(elapsedTime)}` : `Boards Completed ${completedBoards}/8`}
            />
          }
          sub={isDaily ? <DailyRankBadge gameMode="OCTORDLE" /> : undefined}
          board={<FittedBoardsRecap boards={toRecapBoards(state.boards)} />}
          dock={
            <FinishedDock
              currentMode="OCTORDLE"
              isDaily={!!isDaily}
              onShare={handleShare}
              copied={copied}
              onNewPuzzle={!isDaily && isPro ? handleRestart : undefined}
            />
          }
          moreLabel="Score breakdown"
          more={
            <ScoreBreakdownCard
              gameMode="OCTORDLE"
              completed={state.status === 'WON'}
              guessCount={totalGuesses}
              timeSeconds={elapsedTime}
              boardsSolved={state.boards.filter(b => b.status === 'WON').length}
              totalBoards={8}
              day={isDaily ? getDailySeedDate(gameSeed) ?? undefined : undefined}
            />
          }
        />
      )}

      {/* Keyboard — hidden when game is complete */}
      {state.status === 'PLAYING' && (
        <div className="shrink-0 pb-2 px-2">
          <Keyboard onKey={handleKeyPress} letterStates={letterStates} boardLetterStates={boardLetterStates} revealWord={latestGuess(state.boards)} />
        </div>
      )}

      {state.status !== 'PLAYING' && <BottomNav />}
    </GameBackground>
  );
}
