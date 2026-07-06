'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { GameMode } from '@wordle-duel/core';
import { Keyboard } from '@/components/game/keyboard';
import { OpponentHUD } from './opponent-hud';
import { Clock, Lightbulb, Eye, Hash, Loader2 } from 'lucide-react';
import NoundleBoard from '@/components/propernoundle/noundle-board';
import { Guess, TileState, type Puzzle } from '@/components/propernoundle/types';
import { normalizeString, evaluateGuess, checkWin } from '@/components/propernoundle/game-logic';
import { useHints } from '@/components/propernoundle/use-hints';
import type { VsGameComponentProps } from './vs-classic';
import type { EvaluatedRow } from './vs-result-detail';

const MAX_GUESSES = 6;

interface VsProperNoundleProps extends VsGameComponentProps {
  puzzleMetadata?: {
    display: string;
    category: string;
    answerLength: number;
    themeCategory?: string;
  };
}

export function VsProperNoundle({
  seed,
  mode,
  onBoardSolved,
  onCompleted,
  onGuessSubmitted,
  opponentProgress,
  opponentTiles,
  startTime,
  onTyping,
  onFinalBoard,
  puzzleMetadata,
}: VsProperNoundleProps) {
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [message, setMessage] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [hasReported, setHasReported] = useState(false);
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [letterStates, setLetterStates] = useState<Record<string, 'correct' | 'present' | 'absent'>>({});

  const answerLength = puzzleMetadata?.answerLength || 10;
  const answerDisplay = puzzleMetadata?.display || '';

  // Same clue / vowel / consonant hints as solo ProperNoundle. The hint hook
  // only touches puzzle.answer/display/wikiTitle/hint, so a minimal puzzle-like
  // object from the VS metadata is enough. Each reveal is added as a hint row
  // (counts as a guess — the VS cost, mirroring solo's score penalty).
  const hints = useHints();
  const hintPuzzle = useMemo(
    () => ({ id: seed, display: answerDisplay, answer: answerDisplay } as unknown as Puzzle),
    [seed, answerDisplay],
  );

  const handleHintClue = useCallback(async () => {
    if (gameStatus !== 'playing') return;
    const hintGuess = await hints.fetchClue(hintPuzzle, answerLength);
    if (hintGuess) {
      setGuesses((prev) => {
        const next = [...prev, hintGuess];
        if (next.length >= MAX_GUESSES) setGameStatus('lost');
        return next;
      });
    }
  }, [gameStatus, hints, hintPuzzle, answerLength]);

  const handleVowelReveal = useCallback(() => {
    if (gameStatus !== 'playing') return;
    const hintGuess = hints.revealVowel(hintPuzzle);
    if (hintGuess) {
      setGuesses((prev) => {
        const next = [...prev, hintGuess];
        if (next.length >= MAX_GUESSES) setGameStatus('lost');
        return next;
      });
    }
  }, [gameStatus, hints, hintPuzzle]);

  const handleConsonantReveal = useCallback(() => {
    if (gameStatus !== 'playing') return;
    const hintGuess = hints.revealConsonant(hintPuzzle);
    if (hintGuess) {
      setGuesses((prev) => {
        const next = [...prev, hintGuess];
        if (next.length >= MAX_GUESSES) setGameStatus('lost');
        return next;
      });
    }
  }, [gameStatus, hints, hintPuzzle]);

  useEffect(() => {
    if (gameStatus === 'playing') {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameStatus, startTime]);

  // Snapshot of the final board exactly as it rendered — hint rows/tiles keep
  // their 'hint-used' (→ HINT_USED) state and blank/underscore letters, same
  // as the in-game NoundleBoard. Threaded up to the result screen's recap.
  const captureFinalBoard = useCallback(() => {
    if (!onFinalBoard) return;
    const rows: EvaluatedRow[] = guesses.map((g) => ({
      letters: g.tiles.map((_, i) => {
        const ch = g.word[i] ?? '';
        return ch === '_' ? '' : ch.toUpperCase();
      }),
      states: g.tiles.map((t) => (t === 'hint-used' ? 'HINT_USED' : t.toUpperCase())),
    }));
    onFinalBoard(rows);
  }, [onFinalBoard, guesses]);

  useEffect(() => {
    if (hasReported) return;
    if (gameStatus === 'won') {
      setHasReported(true);
      captureFinalBoard();
      onBoardSolved(0);
      onCompleted('won', guesses.length, Date.now() - startTime);
    } else if (gameStatus === 'lost') {
      setHasReported(true);
      captureFinalBoard();
      onCompleted('lost', guesses.length, Date.now() - startTime);
    }
  }, [gameStatus, hasReported, guesses.length, startTime, onBoardSolved, onCompleted, captureFinalBoard]);

  const handleKey = useCallback((key: string) => {
    if (gameStatus !== 'playing') return;
    setMessage('');

    if (key === 'ENTER') {
      const normalized = normalizeString(currentGuess);
      if (normalized.length !== answerLength) {
        setMessage(`Must be ${answerLength} letters`);
        setTimeout(() => setMessage(''), 1500);
        return;
      }

      if (guesses.some((g) => normalizeString(g.word) === normalized)) {
        setMessage('Already guessed');
        setTimeout(() => setMessage(''), 1500);
        return;
      }

      // Report guess to server for opponent progress
      onGuessSubmitted(currentGuess, 0);

      // Evaluate guess against the answer (using seed-derived answer)
      // In VS mode, the answer comes from the server via puzzleMetadata
      // We use the normalized answer display for evaluation
      const tiles = evaluateGuess(currentGuess, answerDisplay);
      const newGuess: Guess = { word: currentGuess, tiles };
      const newGuesses = [...guesses, newGuess];
      setGuesses(newGuesses);
      setCurrentGuess('');

      // Update letter states
      const newLetterStates = { ...letterStates };
      for (let i = 0; i < normalized.length; i++) {
        const letter = normalized[i].toUpperCase();
        const state = tiles[i];
        if (state === 'correct') newLetterStates[letter] = 'correct';
        else if (state === 'present' && newLetterStates[letter] !== 'correct') newLetterStates[letter] = 'present';
        else if (state === 'absent' && !newLetterStates[letter]) newLetterStates[letter] = 'absent';
      }
      setLetterStates(newLetterStates);

      if (checkWin(tiles)) {
        setGameStatus('won');
      } else if (newGuesses.length >= MAX_GUESSES) {
        setGameStatus('lost');
      }
    } else if (key === 'BACK') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (/^[A-Z]$/.test(key) && normalizeString(currentGuess).length < answerLength) {
      setCurrentGuess(prev => prev + key);
      onTyping?.();
    }
  }, [currentGuess, gameStatus, guesses, letterStates, answerLength, answerDisplay, onTyping]);

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

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header */}
      <div className="text-center py-2 px-2 shrink-0">
        <div className="flex justify-center items-center gap-3 mt-1">
          {puzzleMetadata?.themeCategory && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white bg-red-500">
              {puzzleMetadata.themeCategory}
            </span>
          )}
          <span className="text-gray-400 text-xs font-bold">{answerLength} letters</span>
          <span className="text-gray-400 text-xs font-bold">{guesses.length}/{MAX_GUESSES} guesses</span>
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
          maxGuesses={6}
          wordLength={puzzleMetadata?.answerLength || 10}
        />
      </div>

      {/* Hint clue text (once fetched) */}
      {hints.hint && (
        <div
          className="shrink-0 mx-4 mb-1 px-3 py-1.5 rounded-lg"
          style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
        >
          <p className="text-xs italic leading-snug" style={{ color: 'var(--color-text-secondary)' }}>{hints.hint}</p>
        </div>
      )}

      {/* Board */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-2 pb-2">
        <NoundleBoard
          guesses={guesses}
          currentGuess={currentGuess}
          maxGuesses={MAX_GUESSES}
          answerLength={answerLength}
          answerDisplay={answerDisplay}
          shouldShake={false}
        />
      </div>

      {/* Hint buttons — Clue / Vowel / Consonant, same as solo, hidden once done. */}
      {gameStatus === 'playing' && (
        <div className="shrink-0 flex justify-center gap-2 px-4 pb-1">
          <button
            onClick={handleHintClue}
            disabled={hints.hintUsed || hints.loadingHint}
            className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
              hints.hintUsed ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-purple-300 text-purple-600 bg-purple-50 hover:bg-purple-100'
            }`}
          >
            {hints.loadingHint ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
            Clue
          </button>
          <button
            onClick={handleVowelReveal}
            disabled={hints.vowelUsed}
            className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
              hints.vowelUsed ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-blue-300 text-blue-600 bg-blue-50 hover:bg-blue-100'
            }`}
          >
            <Eye className="w-3 h-3" />
            {hints.vowelRevealed ? hints.vowelRevealed : 'Vowel'}
          </button>
          <button
            onClick={handleConsonantReveal}
            disabled={hints.consonantUsed}
            className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
              hints.consonantUsed ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-teal-300 text-teal-600 bg-teal-50 hover:bg-teal-100'
            }`}
          >
            <Hash className="w-3 h-3" />
            {hints.consonantRevealed ? hints.consonantRevealed : 'Consonant'}
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
