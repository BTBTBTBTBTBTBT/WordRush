'use client';

import { keyDuringReject } from '@/lib/tile-motion';
import { useRejectRow } from '@/hooks/use-reject-row';
import { latestGuess } from '@/lib/key-reveal';
import { useReducer, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GameMode, GameStatus, gameReducer, initializeGame, isValidWord, evaluateGuess } from '@wordle-duel/core';
import { Keyboard } from '@/components/game/keyboard';
import { SequenceMiniBoard } from '@/components/sequence/sequence-mini-board';
import { useSquareBoardFit } from '@/hooks/use-square-board-fit';
import { OpponentHUD } from './opponent-hud';
import { Clock } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import type { VsGameComponentProps } from './vs-classic';
import { hasDuplicateGuess } from '@/lib/game-utils';
import { playInvalid } from '@/lib/sounds';
import { isTypingTarget } from '@/lib/keyboard';

const BOARD_ORDER = [0, 1, 2, 3];

export function VsSuccession({ seed, mode, solutions, onBoardSolved, onCompleted, onGuessSubmitted, opponentProgress, opponentTiles, startTime, onTyping }: VsGameComponentProps) {
  const [state, dispatch] = useReducer(
    gameReducer,
    initializeGame(seed, GameMode.SEQUENCE, solutions)
  );

  const [currentGuess, setCurrentGuess] = useState('');
  const [error, setError] = useState('');
  const { isShaking, reject: rejectRow, cutShort: cutReject } = useRejectRow(() => setCurrentGuess(''));
  const [elapsedTime, setElapsedTime] = useState(0);
  const [hasReported, setHasReported] = useState(false);
  const prevSolvedRef = useRef(0);

  const activeBoardIndex = useMemo(() => {
    for (const idx of BOARD_ORDER) {
      if (state.boards[idx]?.status === GameStatus.PLAYING) return idx;
    }
    return -1;
  }, [state.boards]);

  useEffect(() => {
    if (state.status === 'PLAYING') {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.status, startTime]);

  // Track board solves
  useEffect(() => {
    const solvedCount = state.boards.filter(b => b.status === GameStatus.WON).length;
    if (solvedCount > prevSolvedRef.current) {
      for (let i = prevSolvedRef.current; i < solvedCount; i++) {
        onBoardSolved(i);
      }
      prevSolvedRef.current = solvedCount;
    }
  }, [state.boards, onBoardSolved]);

  // Report completion
  useEffect(() => {
    if (hasReported) return;
    if (state.status === GameStatus.WON || state.status === GameStatus.LOST) {
      setHasReported(true);
      const totalGuesses = state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0);
      onCompleted(state.status === GameStatus.WON ? 'won' : 'lost', totalGuesses, Date.now() - startTime);
    }
  }, [state.status, hasReported, state.boards, startTime, onCompleted]);

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

    // Invalid entries shake the row like solo, then clear it.
    const reject = (msg: string) => {
      setError(msg);
      playInvalid();
      rejectRow(currentGuess.length);
      setTimeout(() => setError(''), 1500);
    };

    if (key === 'ENTER') {
      if (currentGuess.length !== 5) { reject('Word must be 5 letters'); return; }
      if (!isValidWord(currentGuess)) { reject('Not in word list'); return; }
      if (hasDuplicateGuess(state.boards, currentGuess)) { reject('Already guessed'); return; }

      // Relay the ACTIVE board (not a hardcoded 0): Succession is sequential, so
      // the guess lands on the current still-playing board. Sending 0 made the
      // server score it against board 0's answer and told the opponent the tiles
      // belonged to board 0 — so the opponent's board 1+ never populated and
      // post-board-0 colors were wrong (matches the native fix in build 66).
      onGuessSubmitted(currentGuess, Math.max(0, activeBoardIndex));
      dispatch({ type: 'SUBMIT_GUESS', guess: currentGuess, applyToAll: true });
      setCurrentGuess('');
    } else if (key === 'BACK' || key === 'BACKSPACE') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (guess.length < 5 && /^[A-Z]$/.test(key)) {
      setCurrentGuess(prev => prev + key);
      onTyping?.();
    }
  }, [state, currentGuess, isShaking, onTyping]);

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

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const solvedCount = state.boards.filter(b => b.status === GameStatus.WON).length;
  const guessesUsed = state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0);
  const maxGuesses = state.boards[0]?.maxGuesses || 10;

  // Same measured square-tile fit as the solo Succession screen.
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const boardFit = useSquareBoardFit(boardAreaRef, 4, maxGuesses, 18);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Solo stats row (the title + VS pill sit above, in vs-game). */}
      <div className="text-center px-2 shrink-0">
        <div className="flex justify-center gap-3">
          <span className="text-gray-400 text-xs font-bold"><Icon3D name="trophy" size={14} inline className="mr-1" />{solvedCount}/4</span>
          <span className="text-gray-400 text-xs font-bold">{guessesUsed}/{maxGuesses} guesses</span>
          <span className="text-gray-400 text-xs font-bold"><Clock className="w-3 h-3 inline mr-1 text-blue-400" />{formatTime(elapsedTime)}</span>
        </div>
        {error && <div className="absolute left-0 right-0 z-20 text-center" style={{ top: '90px' }}><span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-lg">{error}</span></div>}
      </div>

      {/* Opponent strip */}
      <div className="shrink-0 px-3 pt-2">
        <OpponentHUD
          attempts={opponentProgress.attempts}
          boardsSolved={opponentProgress.boardsSolved}
          totalBoards={opponentProgress.totalBoards}
          opponentTiles={opponentTiles}
          maxGuesses={maxGuesses}
          wordLength={5}
        />
      </div>

      {/* The solo 2x2 (or 4-across) board grid, sequential unlock. */}
      <div ref={boardAreaRef} className="flex-1 min-h-0 px-2 pt-2 pb-2 overflow-hidden">
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
      </div>

      {/* Keyboard */}
      <div className="shrink-0 pb-2 px-2 pt-1">
        <Keyboard onKey={handleKeyPress} letterStates={letterStates} revealWord={latestGuess(state.boards)} />
      </div>
    </div>
  );
}
