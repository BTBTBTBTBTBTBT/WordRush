'use client';
import { computeScoreBreakdown } from '@/lib/composite-scoring';

import { useReducer, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSquareBoardFit } from '@/hooks/use-square-board-fit';
import { gameReducer, initializeGame, GameMode, GameStatus, isValidWord, evaluateGuess, getDailySeedDate } from '@wordle-duel/core';
import { Board } from '@/components/game/board';
import { useBoardFit } from '@/hooks/use-board-fit';
import { keyDuringReject } from '@/lib/tile-motion';
import { useRejectRow } from '@/hooks/use-reject-row';
import { latestGuess } from '@/lib/key-reveal';
import { MultiBoard, computeActiveLetterStates, computePerBoardLetterStates } from '@/components/game/multi-board';
import Link from 'next/link';
import { GameHomeButton } from '@/components/game/game-home-button';
import { GameGuideButton } from '@/components/game/game-guide-button';
import { SoundToggle } from '@/components/game/sound-toggle';
import { Keyboard } from '@/components/game/keyboard';
import dynamic from 'next/dynamic';
const VictoryAnimation = dynamic(() => import('@/components/effects/victory-animation').then(m => m.VictoryAnimation), { ssr: false });
import { GauntletProgress, GauntletStageHeader } from './gauntlet-progress';
import { StageTransition } from './stage-transition';
import { stagePose } from '@/lib/gauntlet-look';
import { artSrc } from '@/lib/art';
import { GauntletSequenceMiniBoard } from './gauntlet-sequence-mini-board';
import { GauntletResults } from './gauntlet-results';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult, recordSoloMatch, recordGauntletStages, fetchGauntletStages, type GauntletStagesResult, type XpResult } from '@/lib/stats-service';
import { XpToast } from '@/components/effects/xp-toast';
import { recordModePlayed } from '@/lib/play-limit-service';
import { loadGameSession, useGameSnapshot } from '@/hooks/use-game-snapshot';
import { useActivePlayTimer } from '@/hooks/use-active-play-timer';
import { hasDuplicateGuess } from '@/lib/game-utils';
import { playInvalid } from '@/lib/sounds';
import { isTypingTarget } from '@/lib/keyboard';
import { BottomNav } from '@/components/ui/bottom-nav';
import { GameBackground } from '@/components/ui/page-background';
import { modeTrayAccent } from '@/lib/tray-fit';

function generateSeed(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

interface GauntletGameProps {
  initialSeed?: string;
  isDaily?: boolean;
}

export function GauntletGame({ initialSeed, isDaily }: GauntletGameProps = {}) {
  const { profile, isProActive } = useAuth();
  const isPro = isProActive;
  // Attempt to restore any previously saved mid-game session. Captured in
  // state so the value is stable across re-renders but only computed once on
  // mount — subsequent gets don't hit localStorage.
  const [savedSession] = useState(() => loadGameSession(GameMode.GAUNTLET, !!isDaily));
  const [seed, setSeed] = useState(() => savedSession?.seed ?? initialSeed ?? generateSeed());
  const [state, dispatch] = useReducer(
    gameReducer,
    seed,
    (s) => savedSession?.state ?? initializeGame(s, GameMode.GAUNTLET)
  );
  const [currentGuess, setCurrentGuess] = useState('');
  const [message, setMessage] = useState('');
  const { isShaking, reject: rejectRow, cutShort: cutReject } = useRejectRow(() => setCurrentGuess(''));
  const [showTransition, setShowTransition] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  // When a completed session is restored, skip straight to GauntletResults —
  // we don't want to replay the intermediate VictoryAnimation modal, and we
  // definitely don't want to re-record the game stats.
  const [showResults, setShowResults] = useState(() => savedSession?.isCompleted ?? false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);
  // Cross-device: a daily Gauntlet completed on another device has no local
  // session. We fetch the server-persisted stage breakdown so revisiting here
  // shows the full results screen instead of a fresh game.
  const [serverResults, setServerResults] = useState<GauntletStagesResult | null>(null);
  // Flag so the game-over effect below doesn't refire victory/loss animations
  // or double-record stats when a completed save is loaded on mount. Reset in
  // handlePlayAgain so a fresh run behaves normally.
  const isRestoredCompletedRef = useRef(savedSession?.isCompleted ?? false);

  const { elapsedSeconds: elapsedTime, reset: resetTimer } = useActivePlayTimer(
    state.status === GameStatus.PLAYING && !showTransition,
    savedSession?.elapsedTime ?? 0,
  );

  // No local session for today's daily → try the server's per-stage breakdown
  // so a cross-device revisit shows the results screen (see serverResults render).
  useEffect(() => {
    if (!isDaily || savedSession || !profile) return;
    let cancelled = false;
    fetchGauntletStages(profile.id, seed).then(r => { if (!cancelled && r) setServerResults(r); });
    return () => { cancelled = true; };
  }, [isDaily, savedSession, profile, seed]);

  // Backfill: when showing results from a LOCAL session (incl. a restored
  // completed save), push the stage breakdown to the server (idempotent
  // best-effort). Covers runs finished before the gauntlet_stages column
  // existed so they become viewable cross-device without replaying.
  useEffect(() => {
    if (!showResults || !isDaily || !profile) return;
    const g = state.gauntlet;
    if (!g?.stageResults?.length) return;
    recordGauntletStages(profile.id, seed, { stages: g.stages, stageResults: g.stageResults });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResults]);

  // Persistence hook — snapshots the full reducer state to localStorage on
  // every change, and clears on game-end. This lets the user navigate away
  // and return mid-stage without losing progress.
  useGameSnapshot(GameMode.GAUNTLET, !!isDaily, seed, state, elapsedTime);

  // Stolen Guess visual feedback
  const [showStolenGuess, setShowStolenGuess] = useState(false);

  const gauntlet = state.gauntlet!;
  const currentStageConfig = gauntlet.stages[gauntlet.currentStage];
  const isSequential = currentStageConfig.sequential;
  const isSingleBoard = currentStageConfig.boardCount === 1;
  // §255 (founder: "succession was not adjusted in gauntlet"): the Succession
  // STAGE inside Gauntlet renders its own mini board through a stretched 2x2
  // grid — the same flat-tile defect Succession proper just lost. Same shared
  // fit: measure the stage area, one square tile, best arrangement, centered.
  // boardCount is 0 when the stage isn't sequential so the effect re-runs (and
  // re-attaches to the ref) the moment a Succession stage begins.
  const seqAreaRef = useRef<HTMLDivElement>(null);
  const seqFit = useSquareBoardFit(seqAreaRef, isSequential ? state.boards.length : 0, state.boards[0]?.maxGuesses ?? 10, 18);

  // §255: the single-board (Classic) stage was the last Gauntlet stage still
  // sizing its Board by width alone — `max-h-full` on an aspect-ratio box,
  // which iOS Safari ignores inside a flex chain, so on a short phone the
  // bottom rows slid under the keyboard. Same cure the standalone daily game
  // and VS Classic use: measure the area between the stage header and the
  // keyboard and hand the Board exact pixels that fit BOTH dimensions.
  // Deps include isSingleBoard so the observer re-attaches when a Classic
  // stage begins (the ref's div only exists during one).
  // FINISH_SPEC B5: single-board stages size through the shared rule (hooks/use-board-fit.ts).
  const classicAreaRef = useRef<HTMLDivElement>(null);
  const classicBoard = isSingleBoard ? state.boards[state.currentBoardIndex] : undefined;
  const classicCols = classicBoard?.solution.length ?? 5;
  const classicRows = classicBoard?.maxGuesses ?? 6;
  const classicFit = useBoardFit(classicAreaRef, { cols: classicCols, rows: classicRows, vPad: 8 }, `${isSingleBoard}:${gauntlet.currentStage}`);
  const classicSize = classicFit ? { w: classicFit.w, h: classicFit.h } : null;

  // For sequence stages, track the active board (first unsolved in order)
  const sequenceActiveBoardIndex = useMemo(() => {
    if (!isSequential) return -1;
    for (let i = 0; i < state.boards.length; i++) {
      if (state.boards[i]?.status === GameStatus.PLAYING) return i;
    }
    return -1;
  }, [isSequential, state.boards]);

  // Build letter states only from boards still in play
  const letterStates = useMemo(() => {
    if (isSequential && sequenceActiveBoardIndex >= 0) {
      // For sequence: show hints ONLY from the active board's perspective
      // All previous guesses are evaluated against the ACTIVE board's solution
      const states: Record<string, 'correct' | 'present' | 'absent'> = {};
      const activeBoard = state.boards[sequenceActiveBoardIndex];
      if (activeBoard) {
        for (const guess of activeBoard.guesses) {
          const result = evaluateGuess(activeBoard.solution, guess);
          for (const tile of result.tiles) {
            const letter = tile.letter.toUpperCase();
            if (tile.state === 'CORRECT') states[letter] = 'correct';
            else if (tile.state === 'PRESENT' && states[letter] !== 'correct') states[letter] = 'present';
            else if (tile.state === 'ABSENT' && !states[letter]) states[letter] = 'absent';
          }
        }
      }
      return states;
    }
    return computeActiveLetterStates(state.boards);
  }, [state.boards, isSequential, sequenceActiveBoardIndex]);

  // Per-board letter states for quadrant keyboard (multi-board, non-sequential stages)
  const boardLetterStates = useMemo(() => {
    if (isSingleBoard || isSequential) return undefined;
    return computePerBoardLetterStates(state.boards);
  }, [state.boards, isSingleBoard, isSequential]);

  // Evaluations for single-board view
  const currentBoard = state.boards[state.currentBoardIndex];
  const evaluations = useMemo(() => {
    if (!currentBoard) return [];
    return currentBoard.guesses.map(g => evaluateGuess(currentBoard.solution, g));
  }, [currentBoard]);

  // Check for stage completion. Stage failure (any board LOST) is handled
  // by the reducer, which flips state.status to LOST — the game-over
  // effect below picks that up and shows GauntletResults. The previous
  // implementation kept a Letter Blackout second-chance mechanic here;
  // that was a VS-style catch-up and didn't belong in solo play.
  useEffect(() => {
    if (state.status !== GameStatus.PLAYING) return;

    const allBoardsWon = state.boards.every(b => b.status === GameStatus.WON);

    if (allBoardsWon) {
      setShowTransition(true);
    }
  }, [state.boards, state.status]);

  // Check for game over. Suppressed when the session was restored as already
  // completed — we don't want to replay animations or re-record a win the user
  // already has in their stats.
  useEffect(() => {
    if (isRestoredCompletedRef.current) return;
    if (state.status === GameStatus.WON) {
      setShowVictory(true);
    } else if (state.status === GameStatus.LOST) {
      setShowResults(true);
    }
    if (profile && (state.status === GameStatus.WON || state.status === GameStatus.LOST)) {
      // Use the frozen elapsedTime (timer stops ticking when the stage ends)
      // so this exactly matches the VictoryAnimation and GauntletResults
      // numbers the player sees.
      const timeMs = elapsedTime * 1000;
      // Sum across completed stages. On WON the final NEXT_STAGE has already
      // pushed the last stage into stageResults, so state.boards would be a
      // double-count. On LOST the current stage isn't yet in stageResults, so
      // add its max-across-boards count.
      const completedStageGuesses = state.gauntlet?.stageResults.reduce((sum, r) => sum + r.guesses, 0) ?? 0;
      const currentStageGuesses = state.status === GameStatus.LOST
        ? state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0)
        : 0;
      const totalGuesses = completedStageGuesses + currentStageGuesses;
      // Cross-stage boards-solved tally. Every cleared stage in
      // stageResults contributes its full boardCount; the failed stage
      // (if any) contributes its partial WON count from the snapshot.
      // The previous version only counted the current stage's WON
      // boards, which crushed completionBonus on the leaderboard —
      // e.g. a fully-won Gauntlet was logging 8/21 instead of 21/21
      // because state.boards still pointed at the final OctoWord stage.
      const stageCfgs = state.gauntlet?.stages ?? [];
      const cumulativeBoardsSolved = (state.gauntlet?.stageResults ?? []).reduce((sum, r) => {
        const stage = stageCfgs[r.stageIndex];
        if (!stage) return sum;
        if (r.status === GameStatus.WON) return sum + stage.boardCount;
        const snapshot = r.boardsSnapshot ?? [];
        return sum + snapshot.filter(b => b.status === GameStatus.WON).length;
      }, 0);
      const cumulativeTotalBoards = stageCfgs.reduce((sum, s) => sum + s.boardCount, 0) || 21;
      // Fully-cleared stage count drives the loss stage-depth ladder.
      const stagesCompleted = (state.gauntlet?.stageResults ?? []).filter(r => r.status === GameStatus.WON).length;
      recordGameResult(profile.id, 'GAUNTLET', 'solo', state.status === GameStatus.WON, totalGuesses, timeMs, seed, cumulativeBoardsSolved, cumulativeTotalBoards, 0, stagesCompleted).then(xp => { if (xp) setXpResult(xp); });
      recordSoloMatch({
        userId: profile.id,
        gameMode: 'GAUNTLET',
        won: state.status === GameStatus.WON,
        score: totalGuesses,
        timeSeconds: elapsedTime,
        seed,
        solutions: state.gauntlet?.allSolutions ?? state.boards.map(b => b.solution),
        guesses: state.boards.flatMap(b => b.guesses),
        startedAtIso: new Date(Date.now() - elapsedTime * 1000).toISOString(),
      });
      // Persist the per-stage breakdown so the results screen renders the same
      // on any device (best-effort update after the insert lands).
      if (state.gauntlet) {
        recordGauntletStages(profile.id, seed, {
          stages: state.gauntlet.stages,
          stageResults: state.gauntlet.stageResults,
        });
      }
    }
    if (state.status === GameStatus.WON || state.status === GameStatus.LOST) {
      recordModePlayed('gauntlet');
    }
  }, [state.status]);

  const handleKey = useCallback((key: string) => {
    if (state.status !== GameStatus.PLAYING) return;
    if (showTransition) return;
    // AQ1: a key during a not-a-word reject cuts it short; it's never dropped.
    let guess = currentGuess;
    if (isShaking) { cutReject(); guess = ''; if (keyDuringReject(key) === 'swallow') return; }

    if (key === 'ENTER') {
      if (currentGuess.length !== 5) {
        setMessage('Not enough letters');
        playInvalid();
        rejectRow(currentGuess.length);
        setTimeout(() => setMessage(''), 1500);
        return;
      }

      if (!isValidWord(currentGuess)) {
        setMessage('Not in word list');
        playInvalid();
        rejectRow(currentGuess.length);
        setTimeout(() => setMessage(''), 1500);
        return;
      }

      if (hasDuplicateGuess(state.boards, currentGuess)) {
        setMessage('Already guessed');
        playInvalid();
        rejectRow(currentGuess.length);
        setTimeout(() => setMessage(''), 1500);
        return;
      }

      if (isSingleBoard) {
        dispatch({ type: 'SUBMIT_GUESS', guess: currentGuess, boardIndex: state.currentBoardIndex });
      } else {
        dispatch({ type: 'SUBMIT_GUESS', guess: currentGuess, applyToAll: true });
      }

      setCurrentGuess('');
    } else if (key === 'BACK') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (/^[A-Z]$/.test(key) && guess.length < 5) {
      setCurrentGuess(prev => prev + key);
    }
  }, [state, currentGuess, showTransition, isSingleBoard]);

  // Keyboard event listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;   // don't steal keys from a focused input/modal
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

  // AZ: decode the next stage card's pose while this stage is played, so the
  // card's spring-in never waits on an image.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const img = new Image();
    img.decoding = 'async';
    img.src = artSrc(stagePose(Math.min(gauntlet.totalStages, gauntlet.currentStage + 1) + 1));
    img.decode?.().catch(() => {});
  }, [gauntlet.currentStage, gauntlet.totalStages]);

  // AU3: the next stage starts under the stage card as it leaves; the card unmounts after.
  const handleTransitionAdvance = useCallback(() => {
    // Pass the active-play elapsed so the reducer's stage-time math
    // doesn't count any tab-hidden minutes against this stage.
    dispatch({ type: 'NEXT_STAGE', elapsedMs: elapsedTime * 1000 });
    setCurrentGuess('');
  }, [elapsedTime]);
  const handleTransitionDone = useCallback(() => setShowTransition(false), []);

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
    resetTimer(0);
    // Re-enable the game-over effect for this fresh run. The ref was set on
    // mount if the session was already completed; clearing it here lets
    // VictoryAnimation / stat-recording fire normally when the new run ends.
    isRestoredCompletedRef.current = false;
  }, []);

  const handleHome = useCallback(() => {
    window.location.href = '/';
  }, []);

  // Public method for multiplayer: opponent completed a stage ahead
  // (Will be wired up when multiplayer gauntlet is implemented)
  const handleStolenGuess = useCallback(() => {
    dispatch({ type: 'STEAL_GUESS' });
    setShowStolenGuess(true);
    setMessage('STOLEN GUESS! Opponent cleared a stage first!');
    setTimeout(() => {
      setShowStolenGuess(false);
      setMessage('');
    }, 3000);
  }, []);

  // The XpToast is lifted out of the main-view JSX into a fragment that
  // wraps BOTH the results screen and the playing view so it survives the
  // showResults transition. Previously it lived inside the playing-view
  // return and the `if (showResults)` early-return unmounted the main tree
  // before the toast could render — so on LOSS it never appeared at all,
  // and on WIN it flashed only during VictoryAnimation before
  // GauntletResults replaced the tree. The `key` prop resets the 3s
  // auto-dismiss timer on the results-screen transition so the player
  // still sees the toast after they dismiss VictoryAnimation.
  const xpToast = xpResult ? (
    <XpToast
      key={showResults ? 'results' : 'playing'}
      xp={xpResult.xpGain}
      streakBonus={xpResult.streakBonus}
      dailyBonus={xpResult.dailyBonus}
      sweepBonus={xpResult.sweepBonus}
      flawlessBonus={xpResult.flawlessBonus} flawlessStreak={xpResult.flawlessStreak}
      leveledUp={xpResult.leveledUp}
      newLevel={xpResult.newLevel}
    />
  ) : null;

  // Show results screen
  // Cross-device revisit: this daily Gauntlet was played on another device, so
  // there's no local session — render the results from the server-persisted
  // stage breakdown instead of starting a fresh game. recordOnMount=false so we
  // don't re-count a run that wasn't played here.
  if (serverResults && !showResults) {
    return (
      <>
        {xpToast}
        <GauntletResults
          won={serverResults.won}
          stages={serverResults.stages}
          stageResults={serverResults.stageResults}
          totalTimeMs={serverResults.totalTimeMs}
          onPlayAgain={handlePlayAgain}
          onHome={handleHome}
          showPlayAgain={false}
          isDaily={isDaily}
          recordOnMount={false}
          day={isDaily ? getDailySeedDate(seed) ?? undefined : undefined}
        />
        <BottomNav />
      </>
    );
  }

  if (showResults) {
    return (
      <>
        {xpToast}
        <GauntletResults
          won={state.status === GameStatus.WON}
          stages={gauntlet.stages}
          stageResults={gauntlet.stageResults}
          totalTimeMs={elapsedTime * 1000}
          onPlayAgain={handlePlayAgain}
          onHome={handleHome}
          showPlayAgain={!isDaily && isPro}
          isDaily={isDaily}
          day={isDaily ? getDailySeedDate(seed) ?? undefined : undefined}
        />
        {/* Keep bottom navigation available on the results screen so
            players can jump to Home / Leaderboard / Profile / Records
            without re-entering the game tree. Matches every other
            completed-game surface across the app. */}
        <BottomNav />
      </>
    );
  }

  // Determine which board component to render
  const renderGameArea = () => {
    if (isSingleBoard) {
      const board = state.boards[state.currentBoardIndex];
      if (!board) return null;

      return (
        <div ref={classicAreaRef} className="flex flex-col items-center gap-1 w-full h-full justify-center">
          <Board
            trayAccent={modeTrayAccent('GAUNTLET')}
            sizePx={classicSize ?? undefined}
            gap={classicFit?.gap}
            guesses={board.guesses}
            currentGuess={currentGuess}
            maxGuesses={board.maxGuesses}
            evaluations={evaluations}
            solution={board.solution}
            showSolution={board.status === GameStatus.LOST}
            darkMode
            isShaking={isShaking}
            isInvalidWord={currentGuess.length === 5 && (!isValidWord(currentGuess) || hasDuplicateGuess(state.boards, currentGuess))}
          />
        </div>
      );
    } else if (isSequential) {
      // Sequence-style 2x2 grid with sequential board unlocking
      return (
        <div ref={seqAreaRef} className="w-full h-full">
        <div
          className={seqFit ? 'grid gap-2 w-full h-full justify-center content-center' : 'grid grid-cols-2 grid-rows-2 gap-2 w-full h-full max-w-lg mx-auto'}
          style={seqFit ? { gridTemplateColumns: `repeat(${seqFit.cols}, ${seqFit.boardW}px)` } : undefined}
        >
          {state.boards.map((board, idx) => (
            <GauntletSequenceMiniBoard
              tileSize={seqFit?.tile}
              key={idx}
              board={board}
              boardIndex={idx}
              isActive={idx === sequenceActiveBoardIndex}
              isCompleted={board.status === GameStatus.WON}
              isFailed={board.status === GameStatus.LOST}
              isLocked={idx !== sequenceActiveBoardIndex && board.status === GameStatus.PLAYING}
              currentGuess={idx === sequenceActiveBoardIndex ? currentGuess : ''}
              isShaking={idx === sequenceActiveBoardIndex && isShaking}
              isInvalidWord={idx === sequenceActiveBoardIndex && currentGuess.length === 5 && !isValidWord(currentGuess)}
            />
          ))}
        </div>
        </div>
      );
    } else {
      return (
        <MultiBoard
          accent={modeTrayAccent('GAUNTLET')}
          boards={state.boards}
          currentGuess={currentGuess}
          isShaking={isShaking}
          isInvalidWord={currentGuess.length === 5 && (!isValidWord(currentGuess) || hasDuplicateGuess(state.boards, currentGuess))}
        />
      );
    }
  };

  return (
    <GameBackground
      mode="GAUNTLET"
      className={`h-screen-stable flex flex-col relative ${state.status !== GameStatus.PLAYING ? 'pb-[calc(env(safe-area-inset-bottom)+80px)]' : ''}`}
    >
      {/* Progress Bar + Stage Header */}
      <div className="shrink-0 relative">
        {/* In-game Home escape hatch. BottomNav is hidden during play
            so the keyboard owns the bottom edge, which means the player
            has no in-app way out of the game short of the browser back
            button (flaky in embedded views). Tapping Home unmounts the
            game — useGameSnapshot has already been saving state on
            every change + beforeunload, and useActivePlayTimer pauses
            on unmount, so the run resumes cleanly when the player taps
            the Gauntlet mode card again. */}
        <GameHomeButton accentColor="#d97706" positionClass="absolute top-1 left-2 z-10" />
        <GameGuideButton slug="gauntlet" accentColor="#d97706" positionClass="absolute top-1 right-2 z-10" />
        <SoundToggle accentColor="#d97706" positionClass="absolute top-1 right-[52px] z-10" />
        <GauntletProgress
          stages={gauntlet.stages}
          currentStage={gauntlet.currentStage}
          stageResults={gauntlet.stageResults}
        />
        <GauntletStageHeader
          stage={currentStageConfig}
          elapsedTime={elapsedTime}
          boardsSolved={state.boards.filter(b => b.status === GameStatus.WON).length}
          totalBoards={currentStageConfig.boardCount}
          guessesUsed={state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0)}
          maxGuesses={currentStageConfig.maxGuesses}
        />
      </div>

      {/* Message / Blackout Warning — absolutely positioned so it doesn't shift layout */}
      {message && (
        <div
          className="absolute left-0 right-0 z-20 flex justify-center animate-fade-in-scale"
          style={{ top: '140px' }}
        >
          <span className={`font-bold px-4 py-2 rounded-lg text-sm shadow-lg ${
            showStolenGuess
              ? 'bg-orange-600 text-white border border-orange-400/60'
              : 'bg-gray-800 text-white'
          }`}>
            {message}
          </span>
        </div>
      )}

      {/* Stolen Guess Flash */}
      {showStolenGuess && (
        <div
          className="fixed inset-0 bg-orange-500 pointer-events-none z-40 animate-fade-in"
          style={{ opacity: 0.3 }}
        />
      )}

      {/* Game Area */}
      <div className={`flex-1 min-h-0 overflow-hidden px-1 pt-2 pb-1 ${isSingleBoard ? 'flex items-center justify-center' : ''}`}>
        {renderGameArea()}
      </div>

      {/* Keyboard — hidden when game is complete so the VictoryAnimation /
          final Results sit over a clean canvas, matching standalone modes. */}
      {state.status === GameStatus.PLAYING && (
        <div className="shrink-0 pb-2 px-2 pt-1">
          <Keyboard
            onKey={handleKey}
            letterStates={letterStates}
            boardLetterStates={boardLetterStates}
            revealWord={latestGuess(state.boards)}
          />
        </div>
      )}

      {state.status !== GameStatus.PLAYING && <BottomNav />}

      {/* Overlays */}
      {showTransition && (
        <StageTransition
          completedStage={currentStageConfig}
          nextStage={gauntlet.currentStage + 1 < gauntlet.totalStages
            ? gauntlet.stages[gauntlet.currentStage + 1]
            : null
          }
          cleared={gauntlet.currentStage + 1}
          totalStages={gauntlet.totalStages}
          guessesSoFar={gauntlet.stageResults.reduce((sum, r) => sum + r.guesses, 0) + state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0)}
          onAdvance={handleTransitionAdvance}
          onComplete={handleTransitionDone}
        />
      )}

      {showVictory && (
        <VictoryAnimation mode="GAUNTLET"
          onComplete={handleVictoryComplete}
          onPlayAgain={!isDaily && isPro ? handlePlayAgain : undefined}
          timeSeconds={(() => {
            const last = gauntlet.stageResults[gauntlet.stageResults.length - 1];
            return last ? Math.floor(last.timeMs / 1000) : elapsedTime;
          })()}
          solutions={state.boards.map(b => b.solution)}
          points={(() => {
            // The run's composite score — the same cross-stage tally GauntletResults uses.
            const rs = gauntlet.stageResults;
            const won = rs.filter(r => r.status === GameStatus.WON);
            const totalBoards = gauntlet.stages.reduce((s, st) => s + st.boardCount, 0) || 21;
            const boards = won.reduce((s, r) => s + (gauntlet.stages[r.stageIndex]?.boardCount ?? 0), 0);
            return computeScoreBreakdown('GAUNTLET', true, rs.reduce((s, r) => s + r.guesses, 0),
              Math.floor(rs.reduce((s, r) => s + r.timeMs, 0) / 1000), boards, totalBoards, 0, won.length).total;
          })()}
        />
      )}
      {xpToast}
    </GameBackground>
  );
}
