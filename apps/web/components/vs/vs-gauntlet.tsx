'use client';

import { keyDuringReject } from '@/lib/tile-motion';
import { useRejectRow } from '@/hooks/use-reject-row';
import { latestGuess } from '@/lib/key-reveal';
import { RUNNING, activeMs, pauseAt, resumeAt, type PauseLedger } from '@/lib/active-clock';
import { useReducer, useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { modeColor } from '@/lib/vs-lobby';
import {
  gameReducer,
  initializeGame,
  GameMode,
  GameStatus,
  isValidWord,
  evaluateGuess,
} from '@wordle-duel/core';
import { Board } from '@/components/game/board';
import { MultiBoard, computeActiveLetterStates, computePerBoardLetterStates } from '@/components/game/multi-board';
import { Keyboard } from '@/components/game/keyboard';
import { GauntletProgress, GauntletStageHeader } from '@/components/gauntlet/gauntlet-progress';
import { StageTransition } from '@/components/gauntlet/stage-transition';
import { GauntletSequenceMiniBoard } from '@/components/gauntlet/gauntlet-sequence-mini-board';
import { useSquareBoardFit } from '@/hooks/use-square-board-fit';
import { OpponentHUD } from './opponent-hud';
import { hasDuplicateGuess } from '@/lib/game-utils';
import { playInvalid } from '@/lib/sounds';
import { isTypingTarget } from '@/lib/keyboard';
import { FeedbackToast } from '@/components/game/feedback-toast';

export interface VsGauntletProps {
  seed: string;
  /** Server-dealt answer words (match_start); undefined/empty → derive from seed. */
  solutions?: string[];
  mode: GameMode;
  onBoardSolved: (boardIndex: number) => void;
  onCompleted: (status: 'won' | 'lost', totalGuesses: number, timeMs: number) => void;
  onGuessSubmitted: (guess: string, boardIndex: number) => void;
  opponentProgress: { attempts: number; boardsSolved: number; totalBoards: number; currentStage?: number };
  opponentTiles: Record<number, string[][]>;
  startTime: number;
  onStageCompleted?: (stageIndex: number) => void;
  /** Fired on letter entry — vs-game throttles + relays as a typing ping. */
  onTyping?: () => void;
}

export function VsGauntlet({ seed, mode, solutions, onBoardSolved, onCompleted, onGuessSubmitted, opponentProgress, opponentTiles, startTime, onStageCompleted, onTyping }: VsGauntletProps) {
  const [state, dispatch] = useReducer(gameReducer, initializeGame(seed, GameMode.GAUNTLET, solutions));
  const [currentGuess, setCurrentGuess] = useState('');
  const [message, setMessage] = useState('');
  const { isShaking, reject: rejectRow, cutShort: cutReject } = useRejectRow(() => setCurrentGuess(''));
  const [elapsedTime, setElapsedTime] = useState(0);
  // Founder 10-02 (VS matches solo): this player's race clock PAUSES while their
  // own stage card is up; the recorded race + stage times exclude that time.
  const pauseRef = useRef<PauseLedger>(RUNNING);
  const activeElapsedMs = useCallback(() => activeMs(startTime, pauseRef.current, Date.now()), [startTime]);
  const [showTransition, setShowTransition] = useState(false);
  const [hasReported, setHasReported] = useState(false);
  const prevSolvedRef = useRef(0);

  const gauntlet = state.gauntlet!;
  const currentStageConfig = gauntlet.stages[gauntlet.currentStage];
  const isSequential = currentStageConfig.sequential;
  const isSingleBoard = currentStageConfig.boardCount === 1;

  // For sequence stages, track the active board
  const sequenceActiveBoardIndex = useMemo(() => {
    if (!isSequential) return -1;
    for (let i = 0; i < state.boards.length; i++) {
      if (state.boards[i]?.status === GameStatus.PLAYING) return i;
    }
    return -1;
  }, [isSequential, state.boards]);

  // Build letter states
  const letterStates = useMemo(() => {
    if (isSequential && sequenceActiveBoardIndex >= 0) {
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

  useEffect(() => {
    pauseRef.current = showTransition ? pauseAt(pauseRef.current, Date.now()) : resumeAt(pauseRef.current, Date.now());
  }, [showTransition]);

  // Track board solves across all stages
  useEffect(() => {
    const solvedCount = state.boards.filter(b => b.status === GameStatus.WON).length;
    if (solvedCount > prevSolvedRef.current) {
      for (let i = prevSolvedRef.current; i < solvedCount; i++) {
        onBoardSolved(i);
      }
      prevSolvedRef.current = solvedCount;
    }
  }, [state.boards, onBoardSolved]);

  // Check for stage completion (no blackout in VS)
  useEffect(() => {
    if (state.status !== GameStatus.PLAYING) return;

    const allBoardsDone = state.boards.every(b => b.status !== GameStatus.PLAYING);
    const allBoardsWon = state.boards.every(b => b.status === GameStatus.WON);

    if (allBoardsDone && allBoardsWon) {
      setShowTransition(true);
      onStageCompleted?.(gauntlet.currentStage);
    }

    // In VS gauntlet, if any board is lost, the stage is failed (no blackout restart)
    if (allBoardsDone && !allBoardsWon) {
      if (!hasReported) {
        setHasReported(true);
        // Current stage isn't in stageResults yet; add its max-across-boards count.
        const completedStageGuesses = gauntlet.stageResults.reduce((sum, r) => sum + r.guesses, 0);
        const currentStageGuesses = state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0);
        const totalGuesses = completedStageGuesses + currentStageGuesses;
        onCompleted('lost', totalGuesses, activeElapsedMs());
      }
    }
  }, [state.boards, state.status, gauntlet.currentStage, onStageCompleted, hasReported, onCompleted, activeElapsedMs]);

  // Check for game over
  useEffect(() => {
    if (hasReported) return;
    if (state.status === GameStatus.WON) {
      setHasReported(true);
      // Final NEXT_STAGE has already pushed the last stage into stageResults.
      const totalGuesses = gauntlet.stageResults.reduce((sum, r) => sum + r.guesses, 0);
      onCompleted('won', totalGuesses, activeElapsedMs());
    } else if (state.status === GameStatus.LOST) {
      setHasReported(true);
      // Current stage isn't in stageResults yet; add its max-across-boards count.
      const completedStageGuesses = gauntlet.stageResults.reduce((sum, r) => sum + r.guesses, 0);
      const currentStageGuesses = state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0);
      const totalGuesses = completedStageGuesses + currentStageGuesses;
      onCompleted('lost', totalGuesses, activeElapsedMs());
    }
  }, [state.status, hasReported, gauntlet.stageResults, state.boards, activeElapsedMs, onCompleted]);

  const handleKey = useCallback((key: string) => {
    if (state.status !== GameStatus.PLAYING) return;
    if (showTransition) return;
    // AQ1: a key during a not-a-word reject cuts it short; it's never dropped.
    let guess = currentGuess;
    if (isShaking) { cutReject(); guess = ''; if (keyDuringReject(key) === 'swallow') return; }

    // Invalid entries shake the row like solo, then clear it.
    const reject = (msg: string) => {
      setMessage(msg);
      playInvalid();
      rejectRow(currentGuess.length);
      setTimeout(() => setMessage(''), 1500);
    };

    if (key === 'ENTER') {
      if (currentGuess.length !== 5) { reject('Not enough letters'); return; }
      if (!isValidWord(currentGuess)) { reject('Not in word list'); return; }
      if (hasDuplicateGuess(state.boards, currentGuess)) { reject('Already guessed'); return; }

      // On the sequential (Succession) stage the guess lands on the active
      // still-playing board, not currentBoardIndex (which the reducer doesn't
      // advance for sequence) — relay that so the opponent's board 1+ populates
      // and the server scores against the right answer (matches native).
      onGuessSubmitted(currentGuess, isSequential ? Math.max(0, sequenceActiveBoardIndex) : state.currentBoardIndex);
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
      onTyping?.();
    }
  }, [state, currentGuess, showTransition, isShaking, isSingleBoard, onTyping]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;   // don't steal keys from a focused input/modal
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') handleKey('ENTER');
      else if (e.key === 'Backspace') handleKey('BACK');
      else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKey]);

  // AU3: the next stage starts under the stage card as it leaves; the card unmounts after.
  const handleTransitionAdvance = useCallback(() => {
    // The active clock (card time excluded) times the stage, like solo.
    dispatch({ type: 'NEXT_STAGE', elapsedMs: activeElapsedMs() });
    setCurrentGuess('');
    prevSolvedRef.current = 0; // Reset for new stage boards
  }, [activeElapsedMs]);
  const handleTransitionDone = useCallback(() => setShowTransition(false), []);

  // Match clock for the stage header (solo shows it there too).
  useEffect(() => {
    if (state.status !== GameStatus.PLAYING) return;
    const tick = () => setElapsedTime(Math.floor(activeElapsedMs() / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [state.status, activeElapsedMs]);

  // Same measured sizing as the solo Gauntlet stages: the Succession stage's
  // square-tile fit and the Classic stage's exact-pixel board.
  const seqAreaRef = useRef<HTMLDivElement>(null);
  const seqFit = useSquareBoardFit(seqAreaRef, isSequential ? state.boards.length : 0, state.boards[0]?.maxGuesses ?? 10, 18);
  const classicAreaRef = useRef<HTMLDivElement>(null);
  const [classicSize, setClassicSize] = useState<{ w: number; h: number } | null>(null);
  const classicCols = isSingleBoard ? (currentBoard?.solution.length ?? 5) : 5;
  const classicRows = isSingleBoard ? (currentBoard?.maxGuesses ?? 6) : 6;
  useLayoutEffect(() => {
    const el = classicAreaRef.current;
    if (!el || !isSingleBoard) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const availW = Math.min(400, Math.max(0, r.width - 8));
      const availH = Math.max(0, r.height - 8);
      const w = Math.min(availW, (availH * classicCols) / classicRows);
      if (w > 40) setClassicSize({ w, h: (w * classicRows) / classicCols });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isSingleBoard, classicCols, classicRows, gauntlet.currentStage]);

  const renderGameArea = () => {
    if (isSingleBoard) {
      const board = state.boards[state.currentBoardIndex];
      if (!board) return null;

      return (
        <div ref={classicAreaRef} className="flex flex-col items-center gap-1 w-full h-full justify-center">
          <Board
            sizePx={classicSize ?? undefined}
            // FINISH_SPEC L: the shared game tray in the mode's accent.
            trayAccent={modeColor(mode)}
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
          accent={modeColor(mode)}
          boards={state.boards}
          currentGuess={currentGuess}
          isShaking={isShaking}
          isInvalidWord={currentGuess.length === 5 && (!isValidWord(currentGuess) || hasDuplicateGuess(state.boards, currentGuess))}
        />
      );
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
      {/* The solo stage stepper + stage header (home + VS pill overlay the
          stepper row from vs-game, like solo's corner buttons). */}
      <div className="shrink-0">
        <GauntletProgress
          stages={gauntlet.stages}
          currentStage={gauntlet.currentStage}
          stageResults={gauntlet.stageResults}
        />
        {/* The feedback popup sits over the stage header (never on the boards). */}
        <div className="relative">
          <GauntletStageHeader
            stage={currentStageConfig}
            elapsedTime={elapsedTime}
            boardsSolved={state.boards.filter(b => b.status === GameStatus.WON).length}
            totalBoards={currentStageConfig.boardCount}
            guessesUsed={state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0)}
            maxGuesses={currentStageConfig.maxGuesses}
          />
          <FeedbackToast message={message} />
        </div>
      </div>

      {/* Opponent strip */}
      <div className="shrink-0 px-3 pt-1">
        <OpponentHUD
          attempts={opponentProgress.attempts}
          boardsSolved={opponentProgress.boardsSolved}
          totalBoards={opponentProgress.totalBoards}
          currentStage={opponentProgress.currentStage ?? 0}
          opponentTiles={opponentTiles}
          maxGuesses={6}
          wordLength={5}
        />
      </div>

      {/* Game Area */}
      <div className={`flex-1 min-h-0 overflow-hidden px-1 pt-2 pb-1 ${isSingleBoard ? 'flex items-center justify-center' : ''}`}>
        {renderGameArea()}
      </div>

      {/* Keyboard */}
      <div className="shrink-0 pb-2 px-2 pt-1">
        <Keyboard
          onKey={handleKey}
          letterStates={letterStates}
          boardLetterStates={boardLetterStates}
          revealWord={latestGuess(state.boards)}
        />
      </div>

      {/* Stage Transition Overlay */}
      {showTransition && (
        <StageTransition
          isVersus
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
    </div>
  );
}
