'use client';

import { useReducer, useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { GameMode, GameStatus, evaluateGuess, gameReducer, createInitialState, isValidWord } from '@wordle-duel/core';
import { Board } from '@/components/game/board';
import { Keyboard } from '@/components/game/keyboard';
import { OpponentHUD } from './opponent-hud';
import { Clock } from 'lucide-react';
import { hasDuplicateGuess } from '@/lib/game-utils';
import { useClassicHints } from '@/hooks/use-classic-hints';
import type { EvaluatedRow } from './vs-result-detail';

export interface VsGameComponentProps {
  seed: string;
  mode: GameMode;
  onBoardSolved: (boardIndex: number) => void;
  onCompleted: (status: 'won' | 'lost', totalGuesses: number, timeMs: number) => void;
  onGuessSubmitted: (guess: string, boardIndex: number) => void;
  opponentProgress: { attempts: number; boardsSolved: number; totalBoards: number };
  opponentTiles: Record<number, string[][]>;
  startTime: number;
  /** Fired on letter entry — vs-game throttles + relays to the server as a typing ping. */
  onTyping?: () => void;
  /**
   * Fired once at game end (before onCompleted) with the final board rows as
   * they actually rendered in-game — INCLUDING hint rows/tiles, which never
   * enter the guess log. The result screen uses this snapshot for MY side of
   * the recap so hints show; the log rebuild remains the fallback.
   * Single-board modes only (Classic/Six/Seven/ProperNoundle).
   */
  onFinalBoard?: (rows: EvaluatedRow[]) => void;
}

export function VsClassic({ seed, mode, onBoardSolved, onCompleted, onGuessSubmitted, opponentProgress, opponentTiles, startTime, onTyping, onFinalBoard }: VsGameComponentProps) {
  const [state, dispatch] = useReducer(gameReducer, createInitialState(seed, mode));
  const [currentGuess, setCurrentGuess] = useState('');
  const [message, setMessage] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [hasReported, setHasReported] = useState(false);

  const currentBoard = state.boards[state.currentBoardIndex];

  // Six/Seven expose the same vowel + consonant hints as solo. Each reveal is
  // added as a board row (counts as a guess — the VS cost, mirroring solo's
  // score penalty) and never relayed to the opponent's live board.
  const hasHints = mode === GameMode.DUEL_6 || mode === GameMode.DUEL_7;
  const hints = useClassicHints();

  const evaluations = useMemo(() => {
    // Hint rows carry a stored evaluation (revealed letter = CORRECT, rest
    // HINT_USED); everything else is a normal guess.
    return currentBoard.guesses.map((g, i) =>
      currentBoard.hintEvaluations?.[i] ?? evaluateGuess(currentBoard.solution, g),
    );
  }, [currentBoard.guesses, currentBoard.solution, currentBoard.hintEvaluations]);

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
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.status, startTime]);

  // Snapshot of the final board exactly as it rendered — hint rows keep their
  // stored HINT_USED evaluation (blank tiles for unrevealed letters), normal
  // rows re-evaluate. Threaded up to the result screen's recap.
  const captureFinalBoard = useCallback(() => {
    if (!onFinalBoard) return;
    const rows: EvaluatedRow[] = currentBoard.guesses.map((g, i) => {
      const ev = currentBoard.hintEvaluations?.[i] ?? evaluateGuess(currentBoard.solution, g);
      return {
        letters: ev.tiles.map(t => t.letter.trim().toUpperCase()),
        states: ev.tiles.map(t => String(t.state)),
      };
    });
    onFinalBoard(rows);
  }, [onFinalBoard, currentBoard.guesses, currentBoard.hintEvaluations, currentBoard.solution]);

  useEffect(() => {
    if (hasReported) return;
    if (state.status === GameStatus.WON) {
      setHasReported(true);
      captureFinalBoard();
      onBoardSolved(0);
      onCompleted('won', currentBoard.guesses.length, Date.now() - startTime);
    } else if (state.status === GameStatus.LOST) {
      setHasReported(true);
      captureFinalBoard();
      onCompleted('lost', currentBoard.guesses.length, Date.now() - startTime);
    }
  }, [state.status, hasReported, currentBoard.guesses.length, startTime, onBoardSolved, onCompleted, captureFinalBoard]);

  const handleKey = useCallback((key: string) => {
    if (currentBoard.status !== GameStatus.PLAYING) return;
    setMessage('');

    if (key === 'ENTER') {
      if (currentGuess.length !== currentBoard.solution.length) {
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
      if (hasDuplicateGuess(state.boards, currentGuess)) {
        setMessage('Already guessed');
        setCurrentGuess('');
        setTimeout(() => setMessage(''), 1500);
        return;
      }
      onGuessSubmitted(currentGuess, 0);
      dispatch({ type: 'SUBMIT_GUESS', guess: currentGuess });
      setCurrentGuess('');
    } else if (key === 'BACK') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < currentBoard.solution.length) {
      setCurrentGuess(prev => prev + key);
      onTyping?.();
    }
  }, [currentGuess, currentBoard.status, onTyping]);

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

  const handleVowelHint = useCallback(() => {
    if (!hasHints || currentBoard.status !== GameStatus.PLAYING) return;
    const result = hints.revealVowel(currentBoard.solution, currentBoard.guesses);
    if (result) dispatch({ type: 'SUBMIT_HINT', hintWord: result.hintWord, hintEvaluation: result.hintEvaluation });
  }, [hasHints, currentBoard.status, currentBoard.solution, currentBoard.guesses, hints.revealVowel]);

  const handleConsonantHint = useCallback(() => {
    if (!hasHints || currentBoard.status !== GameStatus.PLAYING) return;
    const result = hints.revealConsonant(currentBoard.solution, currentBoard.guesses);
    if (result) dispatch({ type: 'SUBMIT_HINT', hintWord: result.hintWord, hintEvaluation: result.hintEvaluation });
  }, [hasHints, currentBoard.status, currentBoard.solution, currentBoard.guesses, hints.revealConsonant]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const guessesUsed = currentBoard.guesses.length;
  const maxGuesses = currentBoard.maxGuesses;

  // Measured board sizing: fit the (cols x rows) grid inside whatever height
  // is left between the opponent panel and the keyboard. Explicit pixels —
  // iOS Safari doesn't honor percentage max-height on aspect-ratio boxes in
  // flex chains, which let the board overflow under the keyboard.
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState<{ w: number; h: number } | null>(null);
  const cols = currentBoard.solution.length;
  useLayoutEffect(() => {
    const el = boardAreaRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const availW = Math.min(400, Math.max(0, r.width - 32));
      const availH = Math.max(0, r.height - 8);
      const w = Math.min(availW, (availH * cols) / maxGuesses);
      if (w > 40) setBoardSize({ w, h: (w * maxGuesses) / cols });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols, maxGuesses]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header */}
      <div className="text-center py-2 px-2 shrink-0">
        <div className="flex justify-center gap-3 mt-1">
          <span className="text-gray-400 text-xs font-bold">{guessesUsed}/{maxGuesses} guesses</span>
          <span className="text-gray-400 text-xs font-bold"><Clock className="w-3 h-3 inline mr-1 text-blue-400" />{formatTime(elapsedTime)}</span>
        </div>
        {message && (
          <div className="absolute left-0 right-0 z-20 text-center" style={{ top: '90px' }}>
            <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-lg">{message}</span>
          </div>
        )}
      </div>

      {/* Opponent HUD */}
      <div className="flex justify-center px-4 mb-2">
        <OpponentHUD
          attempts={opponentProgress.attempts}
          boardsSolved={opponentProgress.boardsSolved}
          totalBoards={opponentProgress.totalBoards}
          opponentTiles={opponentTiles}
          maxGuesses={currentBoard.maxGuesses}
          wordLength={currentBoard.solution.length}
        />
      </div>

      {/* Board. absolute-inset wrapper: iOS Safari doesn't resolve
          percentage heights (Board's max-h-full) against nested flex-1
          items — the board rendered at its natural aspect height and
          overflowed under the hints/keyboard. An absolutely-positioned box
          has a definite height, so the clamp works on WebKit too. */}
      <div className="flex-1 min-h-0 relative" ref={boardAreaRef}>
        <div className="absolute inset-0 flex items-center justify-center px-4">
        {boardSize && <Board
          sizePx={boardSize}
          guesses={currentBoard.guesses}
          currentGuess={currentGuess}
          maxGuesses={currentBoard.maxGuesses}
          evaluations={evaluations}
          showSolution={currentBoard.status === GameStatus.LOST}
          solution={currentBoard.solution}
          darkMode
          // Six/Seven: without this the Board defaulted to 5 columns (wrong
          // grid for the mode) and a 5-row aspect ratio that oversized it.
          wordLength={currentBoard.solution.length}
          isInvalidWord={currentGuess.length === currentBoard.solution.length && (!isValidWord(currentGuess) || hasDuplicateGuess(state.boards, currentGuess))}
        />}
        </div>
      </div>

      {/* Hint buttons — Six/Seven only, hidden once the board is finished. */}
      {hasHints && currentBoard.status === GameStatus.PLAYING && (
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

      {/* Keyboard */}
      <div className="shrink-0 pb-2 px-2">
        <Keyboard onKey={handleKey} letterStates={letterStates} />
      </div>
    </div>
  );
}
