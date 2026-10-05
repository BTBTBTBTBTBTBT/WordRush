'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { isTypingTarget } from '@/lib/keyboard';
import { CandyButton } from '@/components/ui/candy-button';
import { playInvalid } from '@/lib/sounds';
import { GameMode, pnGuessBlocked } from '@wordle-duel/core';
import { Keyboard } from '@/components/game/keyboard';
import { OpponentHUD } from './opponent-hud';
import { categoryLabel, CATEGORY_COLORS } from '@/components/propernoundle/categories';
import { BookOpen, Clock, Lightbulb, Eye, Hash, Loader2 } from 'lucide-react';
import NoundleBoard from '@/components/propernoundle/noundle-board';
import { Guess, TileState, type Puzzle } from '@/components/propernoundle/types';
import { normalizeString, evaluateGuess, checkWin } from '@/components/propernoundle/game-logic';
import { useHints } from '@/components/propernoundle/use-hints';
import type { VsGameComponentProps } from './vs-classic';
import type { EvaluatedRow } from './vs-result-detail';
import { FeedbackToast } from '@/components/game/feedback-toast';
import { ClueCard } from '@/components/propernoundle/clue-slot';

/** The three hint pills share the row in equal thirds; a slimmer side padding keeps "Consonant" whole. */
const HINT_THIRD = { paddingLeft: 8, paddingRight: 8 } as const;

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
  const [shouldShake, setShouldShake] = useState(false);
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

  // The whole clue's card: opens when the Clue hint lands, reopened by "Read clue".
  const [clueOpen, setClueOpen] = useState(false);
  const closeClue = useCallback(() => setClueOpen(false), []);
  const statsRef = useRef<HTMLDivElement>(null);

  const handleHintClue = useCallback(async () => {
    if (gameStatus !== 'playing') return;
    const hintGuess = await hints.fetchClue(hintPuzzle, answerLength);
    if (hintGuess) {
      setGuesses((prev) => {
        const next = [...prev, hintGuess];
        if (next.length >= MAX_GUESSES) setGameStatus('lost');
        return next;
      });
      if (guesses.length + 1 < MAX_GUESSES) setClueOpen(true);
    }
  }, [gameStatus, hints, hintPuzzle, answerLength, guesses.length]);

  const handleVowelReveal = useCallback(() => {
    if (gameStatus !== 'playing') return;
    const hintGuess = hints.revealVowel(hintPuzzle, guesses.map(g => g.word));
    if (hintGuess) {
      setGuesses((prev) => {
        const next = [...prev, hintGuess];
        if (next.length >= MAX_GUESSES) setGameStatus('lost');
        return next;
      });
    }
  }, [gameStatus, hints, hintPuzzle, guesses]);

  const handleConsonantReveal = useCallback(() => {
    if (gameStatus !== 'playing') return;
    const hintGuess = hints.revealConsonant(hintPuzzle, guesses.map(g => g.word));
    if (hintGuess) {
      setGuesses((prev) => {
        const next = [...prev, hintGuess];
        if (next.length >= MAX_GUESSES) setGameStatus('lost');
        return next;
      });
    }
  }, [gameStatus, hints, hintPuzzle, guesses]);

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
        // Shake + buzz like solo.
        setShouldShake(true);
        playInvalid();
        setMessage(`Must be ${answerLength} letters`);
        setTimeout(() => { setShouldShake(false); setMessage(''); }, 1500);
        return;
      }

      if (guesses.some((g) => normalizeString(g.word) === normalized)) {
        // Shake + buzz like solo.
        setShouldShake(true);
        playInvalid();
        setMessage('Already guessed');
        setTimeout(() => { setShouldShake(false); setMessage(''); }, 1500);
        return;
      }

      // UGC screen: PN guesses aren't dictionary-validated and the final
      // board is shown to the opponent (mini-board relay + result detail),
      // so a guess containing a blocklisted term is rejected like an
      // invalid word — BEFORE it's relayed to the server.
      if (pnGuessBlocked(normalized, answerDisplay)) {
        // Shake + buzz like solo.
        setShouldShake(true);
        playInvalid();
        setMessage('Not allowed');
        setTimeout(() => { setShouldShake(false); setMessage(''); }, 1500);
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
      if (isTypingTarget(e)) return;   // don't steal keys from a focused input/modal
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
      {/* Solo stats row (the title + VS pill sit above, in vs-game). */}
      <div ref={statsRef} className="relative text-center px-2 shrink-0">
        <div className="flex justify-center items-center gap-2">
          {puzzleMetadata?.themeCategory && (
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full text-white"
              style={{ background: CATEGORY_COLORS[puzzleMetadata.themeCategory] || '#ef4444' }}
            >
              {categoryLabel(puzzleMetadata.themeCategory)}
            </span>
          )}
          <span className="text-gray-400 text-xs font-bold">{answerLength} letters</span>
          <span className="text-gray-400 text-xs font-bold">{guesses.length}/{MAX_GUESSES} guesses</span>
          <span className="text-gray-400 text-xs font-bold"><Clock className="w-3 h-3 inline mr-1 text-blue-400" />{formatTime(elapsedTime)}</span>
        </div>
        <FeedbackToast message={message} />
      </div>

      {/* Opponent strip */}
      <div className="shrink-0 px-3 pt-2 pb-2">
        <OpponentHUD
          attempts={opponentProgress.attempts}
          boardsSolved={opponentProgress.boardsSolved}
          totalBoards={opponentProgress.totalBoards}
          opponentTiles={opponentTiles}
          maxGuesses={6}
          wordLength={puzzleMetadata?.answerLength || 10}
        />
      </div>

      {/* No clue band (founder 10-05): the whole clue is a card hung under the stats row,
          opened when the Clue hint lands and from "Read clue". */}
      <ClueCard clue={gameStatus === 'playing' ? hints.hint : null} open={clueOpen} onClose={closeClue} anchorRef={statsRef} />

      {/* Board */}
      <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center px-2 pb-1">
        <NoundleBoard
          guesses={guesses}
          currentGuess={currentGuess}
          maxGuesses={MAX_GUESSES}
          answerLength={answerLength}
          answerDisplay={answerDisplay}
          shouldShake={shouldShake}
        />
      </div>

      {/* Hint buttons — Clue / Vowel / Consonant, same as solo, hidden once done.
          Hidden with `invisible` (not unmounted) so the row keeps its slot:
          unmounting it re-centered the flex-1 board for the frame between
          finishing and the 'waiting' screen swap — a visible board jump. */}
      <div className={`shrink-0 grid grid-cols-3 gap-1.5 w-full max-w-[360px] mx-auto px-3 pb-1 ${gameStatus === 'playing' ? '' : 'invisible pointer-events-none'}`}>
          {/* A8: the solo screen's candy hint buttons, in equal thirds so a revealed letter never resizes a pill. */}
          {hints.hint ? (
            <CandyButton size="sm" color="purple" block style={HINT_THIRD} onClick={() => setClueOpen(true)} aria-label="Read clue"
              icon={<BookOpen className="w-3 h-3" aria-hidden="true" />}>
              Clue
            </CandyButton>
          ) : (
            <CandyButton size="sm" color="purple" block style={HINT_THIRD} onClick={handleHintClue} disabled={hints.hintUsed || hints.loadingHint}
              icon={hints.loadingHint ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : <Lightbulb className="w-3 h-3" aria-hidden="true" />}>
              Clue
            </CandyButton>
          )}
          <CandyButton size="sm" color="teal" block style={HINT_THIRD} onClick={handleVowelReveal} disabled={hints.vowelUsed} icon={<Eye className="w-3 h-3" aria-hidden="true" />}>
            {hints.vowelRevealed ? hints.vowelRevealed : 'Vowel'}
          </CandyButton>
          <CandyButton size="sm" color="pink" block style={HINT_THIRD} onClick={handleConsonantReveal} disabled={hints.consonantUsed} icon={<Hash className="w-3 h-3" aria-hidden="true" />}>
            {hints.consonantRevealed ? hints.consonantRevealed : 'Consonant'}
          </CandyButton>
        </div>

      {/* Keyboard */}
      <div className="shrink-0 pb-2 px-2 pt-1">
        <Keyboard onKey={handleKey} letterStates={letterStates} revealWord={guesses[guesses.length - 1]?.word} />
      </div>
    </div>
  );
}
