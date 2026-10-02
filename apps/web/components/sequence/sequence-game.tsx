'use client';
import { computeScoreBreakdown } from '@/lib/composite-scoring';

import { useReducer, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GameMode, GameStatus, gameReducer, getDailySeedDate, initializeGame, isValidWord, evaluateGuess } from '@wordle-duel/core';
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
import { useSquareBoardFit } from '@/hooks/use-square-board-fit';
import { hasDuplicateGuess } from '@/lib/game-utils';
import { playInvalid } from '@/lib/sounds';
import { isTypingTarget } from '@/lib/keyboard';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { FinishedDock, ResultStrip } from '@/components/game/finished-kit';
import { FinishedScreen, FINISHED_NAV_CLEAR } from '@/components/game/finished-screen';
import { FittedBoardsRecap } from '@/components/game/fitted-recap';
import { keyDuringReject } from '@/lib/tile-motion';
import { useRejectRow } from '@/hooks/use-reject-row';
import { latestGuess } from '@/lib/key-reveal';
import { DailyRankBadge } from '@/components/game/daily-rank-badge';
import { toRecapBoards } from '@/components/game/completed-mini-board';
import { SequenceMiniBoard } from './sequence-mini-board';
import { GameBackground } from '@/components/ui/page-background';
import { gameHeaderStyle, gameToastTop } from '@/lib/art';

// Board order: TL(0) → TR(1) → BL(2) → BR(3)
const BOARD_ORDER = [0, 1, 2, 3];

interface SequenceGameProps {
  initialSeed?: string;
  isDaily?: boolean;
}

export function SequenceGame({ initialSeed, isDaily }: SequenceGameProps = {}) {
  const { profile, isProActive } = useAuth();
  const isPro = isProActive;
  // Restore any previously saved session for this mode+variant.
  const [savedSession] = useState(() => loadGameSession(GameMode.SEQUENCE, !!isDaily));
  const [gameSeed, setGameSeed] = useState(() => savedSession?.seed ?? initialSeed ?? Date.now().toString());
  const [state, dispatch] = useReducer(
    gameReducer,
    gameSeed,
    (s) => savedSession?.state ?? initializeGame(s, GameMode.SEQUENCE),
  );

  const [currentGuess, setCurrentGuess] = useState('');
  const [error, setError] = useState('');
  const { isShaking, reject: rejectRow, cutShort: cutReject } = useRejectRow(() => setCurrentGuess(''));
  const [showVictory, setShowVictory] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [streak, setStreak] = useState(0);
  const [copied, setCopied] = useState(false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);

  // Flag so the effect below doesn't refire victory/loss on mount when a
  // completed save is loaded. Reset in handleNextPuzzle.
  const isRestoredCompleted = useRef(savedSession?.isCompleted ?? false);

  const { elapsedSeconds: elapsedTime, reset: resetTimer } = useActivePlayTimer(
    state.status === 'PLAYING',
    savedSession?.elapsedTime ?? 0,
  );

  useGameSnapshot(GameMode.SEQUENCE, !!isDaily, gameSeed, state, elapsedTime);

  // Cross-device fallback: a daily already played on the native app (or
  // another browser) has no local snapshot, so replay it from the server's
  // matches row. Flag restored-completed BEFORE dispatching so the
  // record-on-finish effect below sees the ref and doesn't re-record.
  useServerDailyReplay(GameMode.SEQUENCE, !!isDaily, gameSeed, profile?.id, !!savedSession, state, (session) => {
    isRestoredCompleted.current = true;
    dispatch({ type: 'RESTORE_STATE', state: session.state });
    resetTimer(session.elapsedTime);
  });

  // The active board is the first unsolved board in sequence order
  const activeBoardIndex = useMemo(() => {
    for (const idx of BOARD_ORDER) {
      if (state.boards[idx]?.status === GameStatus.PLAYING) return idx;
    }
    return -1; // all solved or lost
  }, [state.boards]);

  useEffect(() => {
    if (state.status === 'WON' && !isRestoredCompleted.current) {
      setShowVictory(true);
      setStreak((prev) => prev + 1);
    } else if (state.status === 'LOST') {
      if (!isRestoredCompleted.current) setShowGameOver(true);
      setStreak(0);
    }
    if (profile && !isRestoredCompleted.current && (state.status === 'WON' || state.status === 'LOST')) {
      // Use the frozen elapsedTime (timer stops when status leaves PLAYING)
      // so the recorded time exactly matches what the user sees in the
      // header, VictoryAnimation, and share text. Using a fresh Date.now()
      // subtraction would drift by up to 1000ms from the displayed value.
      const timeMs = elapsedTime * 1000;
      const guesses = state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0);
      const boardsSolved = state.boards.filter(b => b.status === 'WON').length;
      recordGameResult(profile.id, 'SEQUENCE', 'solo', state.status === 'WON', guesses, timeMs, gameSeed, boardsSolved, 4).then(xp => { if (xp) setXpResult(xp); });
      const allGuesses = state.boards.flatMap(b => b.guesses);
      recordSoloMatch({
        userId: profile.id,
        gameMode: 'SEQUENCE',
        won: state.status === 'WON',
        score: guesses,
        timeSeconds: elapsedTime,
        seed: gameSeed,
        solutions: state.boards.map(b => b.solution),
        guesses: allGuesses,
        startedAtIso: new Date(Date.now() - elapsedTime * 1000).toISOString(),
      });
    }
    if (!isRestoredCompleted.current && (state.status === 'WON' || state.status === 'LOST')) {
      recordModePlayed('sequence');
    }
  }, [state.status]);

  // Build letter states ONLY from the active board's perspective
  // Previous guesses are evaluated against the current active board's solution
  const letterStates = useMemo(() => {
    const states: Record<string, 'correct' | 'present' | 'absent'> = {};
    if (activeBoardIndex < 0) return states;

    const activeBoard = state.boards[activeBoardIndex];
    if (!activeBoard) return states;

    for (const guess of activeBoard.guesses) {
      const result = evaluateGuess(activeBoard.solution, guess);
      for (const tile of result.tiles) {
        const letter = tile.letter.toUpperCase();
        if (tile.state === 'CORRECT') states[letter] = 'correct';
        else if (tile.state === 'PRESENT' && states[letter] !== 'correct') states[letter] = 'present';
        else if (tile.state === 'ABSENT' && !states[letter]) states[letter] = 'absent';
      }
    }

    return states;
  }, [state.boards, activeBoardIndex]);

  const handleKeyPress = useCallback((key: string) => {
    if (state.status !== 'PLAYING') return;
    // AQ1: a key during a not-a-word reject cuts it short; it's never dropped.
    let guess = currentGuess;
    if (isShaking) { cutReject(); guess = ''; if (keyDuringReject(key) === 'swallow') return; }

    setError('');

    if (key === 'ENTER') {
      if (currentGuess.length !== 5) {
        setError('Word must be 5 letters');
        playInvalid();
        rejectRow(currentGuess.length);
        setTimeout(() => setError(''), 1500);
        return;
      }

      if (!isValidWord(currentGuess)) {
        setError('Not in word list');
        playInvalid();
        rejectRow(currentGuess.length);
        setTimeout(() => setError(''), 1500);
        return;
      }

      if (hasDuplicateGuess(state.boards, currentGuess)) {
        setError('Already guessed');
        playInvalid();
        rejectRow(currentGuess.length);
        setTimeout(() => setError(''), 1500);
        return;
      }

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
      if (e.key === 'Enter') {
        handleKeyPress('ENTER');
      } else if (e.key === 'Backspace') {
        handleKeyPress('BACK');
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleKeyPress(e.key.toUpperCase());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleNextPuzzle = () => {
    const newSeed = Date.now().toString();
    setGameSeed(newSeed);
    dispatch({ type: 'RESET', seed: newSeed, mode: GameMode.SEQUENCE });
    // §255: dismiss the celebration overlays. §242 wired "Play again" on the
    // victory card to this handler, which reset the board but left the card
    // mounted — so it kept showing, now with the NEW word and 0/6 guesses,
    // an "auto victory" (founder report). Nothing was ever recorded (the
    // recording effect only fires on WON/LOST), but it looked exactly like it.
    setShowVictory(false);
    setShowGameOver(false);
    setCurrentGuess('');
    setError('');
    resetTimer(0);
    isRestoredCompleted.current = false;
  };

  const solvedCount = state.boards.filter(b => b.status === GameStatus.WON).length;
  const guessesUsed = state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0);
  const maxGuesses = state.boards[0]?.maxGuesses || 10;
  // R2: the strip's points — the same total the score card shows.
  const finishedPoints = state.status === GameStatus.PLAYING ? null
    : computeScoreBreakdown('SEQUENCE', state.status === GameStatus.WON, guessesUsed, elapsedTime, solvedCount, 4, 0, undefined, undefined, isDaily ? getDailySeedDate(gameSeed) ?? undefined : undefined).total;
  // §255 (founder: "Succession needs to be formatted more like quadword, it
  // still looks bad"): this screen has its own mini board and never went
  // through MultiBoard, so it kept the stretched 2x2 grid — flat tiles on a
  // wide window. Same fit as MultiBoard: measure, one square tile size, the
  // arrangement with the biggest tile, centered. 18px reserved under each
  // board for the failed-board solution line.
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const boardFit = useSquareBoardFit(boardAreaRef, 4, maxGuesses, 18);

  const handleShare = useCallback(async () => {
    const variant = await chooseShareVariant();
    if (!variant) return;
    const boards = state.boards.map(b => ({ grid: boardToGrid(b), letters: boardToLetters(b), won: b.status === GameStatus.WON, solution: b.solution }));
    const out = await shareResult({
      layout: 'multi',
      mode: 'Succession',
      won: state.status === 'WON',
      guesses: guessesUsed,
      maxGuesses,
      timeSeconds: elapsedTime,
      boards,
      boardsSolved: solvedCount,
      totalBoards: 4,
      reveal: variant === 'full',
    });
    if (out.via !== 'failed') { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }, [state, guessesUsed, maxGuesses, elapsedTime, solvedCount]);

  return (
    <GameBackground
      mode="SEQUENCE"
      className={`h-screen-stable flex flex-col relative ${state.status !== 'PLAYING' ? FINISHED_NAV_CLEAR : ''}`}
    >
      {showVictory && <VictoryAnimation mode="SEQUENCE" onComplete={() => setShowVictory(false)} guesses={guessesUsed} maxGuesses={maxGuesses} timeSeconds={elapsedTime} boardsSolved={solvedCount} totalBoards={4} solutions={state.boards.map(b => b.solution)} points={computeScoreBreakdown('SEQUENCE', true, state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0), elapsedTime, state.boards.filter(b => b.status === GameStatus.WON).length, 4).total} onPlayAgain={!isDaily && isPro ? handleNextPuzzle : undefined} />}
      {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={guessesUsed} maxGuesses={maxGuesses} timeSeconds={elapsedTime} boardsSolved={solvedCount} totalBoards={4} solutions={state.boards.map(b => b.solution)} points={computeScoreBreakdown('SEQUENCE', false, state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0), elapsedTime, state.boards.filter(b => b.status === GameStatus.WON).length, 4).total} onPlayAgain={!isDaily && isPro ? handleNextPuzzle : undefined} />}
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} flawlessStreak={xpResult.flawlessStreak} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      {/* Compact Header */}
      <div className="game-art-header text-center px-2 shrink-0 relative" style={gameHeaderStyle('SEQUENCE')}>
        <GameHomeButton accentColor="#2563eb" />
        <GameGuideButton slug="succession" accentColor="#2563eb" />
        <SoundToggle accentColor="#2563eb" />
        <GameHostTitle mode="SEQUENCE" label="Succession">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400">
            SUCCESSION
          </h1>
        </GameHostTitle>
        {state.status === 'PLAYING' && <div className="flex justify-center gap-3 mt-1">
          <span className="text-gray-400 text-xs font-bold"><Icon3D name="trophy" size={14} inline className="mr-1" />{solvedCount}/4</span>
          <span className="text-gray-400 text-xs font-bold">{guessesUsed}/{maxGuesses} guesses</span>
          <span className="text-gray-400 text-xs font-bold"><Clock className="w-3 h-3 inline mr-1 text-blue-400" />{formatTime(elapsedTime)}</span>
        </div>}
        {error && <div className="absolute left-0 right-0 z-20 text-center" style={{ top: gameToastTop(90) }}><span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-lg">{error}</span></div>}
      </div>

      {/* The ref'd area stays mounted in both states (useSquareBoardFit measures it while playing). */}
      <div ref={boardAreaRef} className={state.status === GameStatus.PLAYING ? 'flex-1 min-h-0 px-2 pb-2 overflow-hidden' : 'flex-1 min-h-0 flex flex-col'}>
        {state.status === GameStatus.PLAYING ? (
        <div
          className={boardFit ? 'grid gap-2 w-full h-full justify-center content-center' : 'grid grid-cols-2 grid-rows-2 gap-2 w-full max-w-lg mx-auto h-full'}
          style={boardFit ? { gridTemplateColumns: `repeat(${boardFit.cols}, ${boardFit.boardW}px)` } : undefined}
        >

            {BOARD_ORDER.map((boardIdx) => {
              const board = state.boards[boardIdx];
              if (!board) return null;

              const isActive = boardIdx === activeBoardIndex;
              const isCompleted = board.status === GameStatus.WON;
              const isFailed = board.status === GameStatus.LOST;
              // A board is "locked" if it comes after the active board in sequence and isn't solved
              const isLocked = !isActive && !isCompleted && !isFailed;

              return (
                <SequenceMiniBoard
                  key={boardIdx}
                  board={board}
                  boardIndex={boardIdx}
                  isActive={isActive}
                  isCompleted={isCompleted}
                  isFailed={isFailed}
                  isLocked={isLocked}
                  currentGuess={isActive ? currentGuess : ''}
                  isShaking={isActive && isShaking}
                  isInvalidWord={isActive && currentGuess.length === 5 && (!isValidWord(currentGuess) || hasDuplicateGuess(state.boards, currentGuess))}
                  tileSize={boardFit?.tile}
                />
              );
            })}
          </div>
        ) : (
          // FINISH_SPEC R2: one screen — the result strip, the 4 boards in the
          // mini grid with the biggest tiles that fit (2 × 2 vs 1 × 4 / 4 × 2 vs 2 × 4), the dock (share · Next daily /
          // Leaderboard · the Unlimited card); the score breakdown under "More".
          <FinishedScreen
            fit="self"
            strip={
              <ResultStrip
                won={state.status === 'WON'}
                guesses={guessesUsed}
                time={formatTime(elapsedTime)}
                points={finishedPoints}
                srText={state.status === 'WON' ? `All 4 solved in ${guessesUsed} guesses · ${formatTime(elapsedTime)}` : `Boards Completed ${solvedCount}/4`}
              />
            }
            sub={isDaily ? <DailyRankBadge gameMode="SEQUENCE" /> : undefined}
            board={<FittedBoardsRecap boards={toRecapBoards(state.boards)} />}
            dock={
              <FinishedDock
                currentMode="SEQUENCE"
                isDaily={!!isDaily}
                onShare={handleShare}
                copied={copied}
                onNewPuzzle={!isDaily && isPro ? handleNextPuzzle : undefined}
              />
            }
            moreLabel="Score breakdown"
            more={
              <ScoreBreakdownCard
                gameMode="SEQUENCE"
                completed={state.status === GameStatus.WON}
                guessCount={state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0)}
                timeSeconds={elapsedTime}
                boardsSolved={state.boards.filter(b => b.status === GameStatus.WON).length}
                totalBoards={4}
                day={isDaily ? getDailySeedDate(gameSeed) ?? undefined : undefined}
              />
            }
          />
        )}
      </div>

      {/* Keyboard — hidden when game is complete */}
      {state.status === 'PLAYING' && (
        <div className="shrink-0 pb-2 px-2 pt-1">
          <Keyboard onKey={handleKeyPress} letterStates={letterStates} revealWord={latestGuess(state.boards)} />
        </div>
      )}

      {state.status !== 'PLAYING' && <BottomNav />}
    </GameBackground>
  );
}
