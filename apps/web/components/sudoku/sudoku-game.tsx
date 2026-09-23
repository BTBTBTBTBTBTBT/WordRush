'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const VictoryAnimation = dynamic(() => import('@/components/effects/victory-animation').then(m => m.VictoryAnimation), { ssr: false });
const GameOverAnimation = dynamic(() => import('@/components/effects/game-over-animation').then(m => m.GameOverAnimation), { ssr: false });
import { Clock } from 'lucide-react';
import {
  generateSudoku, createSudokuState, sudokuReduce, sudokuMatchRow, sudokuRemaining, sudokuDailyNumber,
  generateDailySeed, SUDOKU_MAX_MISTAKES, type SudokuState, type SudokuAction, type SudokuDifficulty,
} from '@wordle-duel/core';
import { GameHomeButton } from '@/components/game/game-home-button';
import { GameGuideButton } from '@/components/game/game-guide-button';
import { SoundToggle } from '@/components/game/sound-toggle';
import { SudokuBoard, SUDOKU_ACCENT } from './sudoku-board';
import { NumberPad } from './number-pad';
import { loadDailySave, saveDaily, loadPracticeSave, savePractice } from './persistence';
import { recordModePlayed } from '@/lib/play-limit-service';
import { shareResult } from '@/lib/share-utils';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult, recordSoloMatch, type XpResult } from '@/lib/stats-service';
import { XpToast } from '@/components/effects/xp-toast';
import { DailyRankBadge } from '@/components/game/daily-rank-badge';
import { getTodayLocal } from '@/lib/daily-service';
import { useActivePlayTimer } from '@/hooks/use-active-play-timer';
import { isTypingTarget } from '@/lib/keyboard';
import { playInvalid } from '@/lib/sounds';
import { haptic } from '@/lib/haptics';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { NextDailyCta } from '@/components/game/next-daily-cta';
import { formatGuessStat } from '@/lib/format';
import { computeScoreBreakdown } from '@/lib/composite-scoring';

// Sudocious, the daily sudoku (More Games §4): one fixed Medium puzzle a day, generated on the
// device from the daily seed; Pro Unlimited picks Easy / Medium / Hard. Three
// wrong digits lose; hints fill a cell and cost score but never a mistake.
// guess_count = mistakes + 1 (perfect = 1), boards 1/1 — no new scoring formula.

const DIFFICULTY_LABEL: Record<SudokuDifficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

interface SudokuGameProps {
  /** /sudocious?daily=true → today's Medium daily, recorded to daily_results. */
  isDaily?: boolean;
}

export function SudokuGame({ isDaily = false }: SudokuGameProps) {
  const { profile, isProActive } = useAuth();
  const isPro = isProActive;
  const mode: 'daily' | 'practice' = isDaily ? 'daily' : 'practice';

  const [state, setState] = useState<SudokuState | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<SudokuDifficulty>('medium');
  const [showVictory, setShowVictory] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const restoredRef = useRef(false);
  const hasRecordedRef = useRef(false);

  const status = state?.status ?? 'playing';
  const { elapsedSeconds, reset: resetTimer } = useActivePlayTimer(!!state && status === 'playing', 0);

  const startPractice = useCallback((d: SudokuDifficulty) => {
    const seed = `unlimited-SUDOKU-${Date.now()}-${d}`;
    setState(createSudokuState(generateSudoku(seed, d), Date.now()));
    setDifficulty(d);
    setSelected(null);
    setShowVictory(false); setShowGameOver(false); setXpResult(null); setMessage('');
    resetTimer(0);
    restoredRef.current = false;
    hasRecordedRef.current = false;
  }, [resetTimer]);

  // Load: restore a save (terminal saves never re-animate or re-record) or start fresh.
  useEffect(() => {
    if (mode === 'daily') {
      const seed = generateDailySeed(getTodayLocal(), 'SUDOKU');
      const saved = loadDailySave(seed);
      if (saved) {
        setState(saved.state); resetTimer(saved.elapsedSeconds);
        const done = saved.state.status !== 'playing';
        restoredRef.current = done; hasRecordedRef.current = done;
        return;
      }
      setState(createSudokuState(generateSudoku(seed, 'medium'), Date.now()));
      resetTimer(0);
      restoredRef.current = false;
    } else {
      const saved = loadPracticeSave();
      if (saved) {
        setState(saved.state); setDifficulty(saved.state.difficulty); resetTimer(saved.elapsedSeconds);
        const done = saved.state.status !== 'playing';
        restoredRef.current = done; hasRecordedRef.current = done;
        return;
      }
      startPractice('medium');
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const dispatch = useCallback((a: SudokuAction) => {
    setState((s) => (s ? sudokuReduce(s, a, Date.now()) : s));
  }, []);

  // Persist every change (board, notes, history and the clock) so a reload —
  // or a device switch via the completed-today card — lands on the same board.
  useEffect(() => {
    if (!state) return;
    if (mode === 'daily') saveDaily(state.seed, state, elapsedSeconds);
    else savePractice(state.seed, state, elapsedSeconds);
  }, [state, elapsedSeconds, mode]);

  const hintsUsed = state?.hintsUsed ?? 0;
  const mistakes = state?.mistakes ?? 0;

  const recordResult = useCallback(() => {
    if (!profile || !state || hasRecordedRef.current) return;
    if (state.status !== 'won' && state.status !== 'lost') return;
    hasRecordedRef.current = true;
    const won = state.status === 'won';
    const timeMs = elapsedSeconds * 1000;
    const seed = mode === 'daily' ? state.seed : undefined;
    // guess_count = mistakes + 1: a perfect run is 1, the composite formula and
    // the Perfect medal need no special case (catalog guessBase = 1).
    recordGameResult(profile.id, 'SUDOKU', 'solo', won, state.mistakes + 1, timeMs, seed, won ? 1 : 0, 1, state.hintsUsed)
      .then((xp) => { if (xp) setXpResult(xp); });
    const row = sudokuMatchRow(state);
    recordSoloMatch({
      userId: profile.id,
      gameMode: 'SUDOKU',
      won,
      score: state.mistakes + 1,
      timeSeconds: elapsedSeconds,
      seed: state.seed,
      solutions: row.solutions,
      guesses: row.guesses,
      startedAtIso: new Date(Date.now() - elapsedSeconds * 1000).toISOString(),
      hintsUsed: state.hintsUsed,
    });
  }, [profile, state, elapsedSeconds, mode]);

  // Game-over effects: overlay once (never on a restored finished board), then record.
  useEffect(() => {
    if (!state || state.status === 'playing') return;
    if (!restoredRef.current) {
      if (state.status === 'won') setShowVictory(true); else setShowGameOver(true);
    }
    recordModePlayed('sudoku');
    recordResult();
    restoredRef.current = false;
  }, [state?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-attempt once the profile arrives (restored finished boards on a cold load).
  useEffect(() => {
    if (profile && state && state.status !== 'playing') recordResult();
  }, [profile, recordResult, state]);

  // Input
  const place = useCallback((digit: number) => {
    if (!state || state.status !== 'playing') return;
    if (selected == null) { setMessage('Tap a cell first'); setTimeout(() => setMessage(''), 1200); return; }
    if (state.givens[selected] !== '0') { playInvalid(); return; }
    const before = state.mistakes;
    dispatch({ type: 'PLACE', cell: selected, digit });
    // Wrong digit feedback is read off the next render; a cheap pre-check here
    // gives the haptic immediately.
    if (!state.notesMode && state.solution[selected] !== String(digit)) { haptic('medium'); playInvalid(); }
    void before;
  }, [state, selected, dispatch]);
  const erase = useCallback(() => { if (selected != null) dispatch({ type: 'ERASE', cell: selected }); }, [selected, dispatch]);
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [dispatch]);
  const toggleNotes = useCallback(() => dispatch({ type: 'TOGGLE_NOTES' }), [dispatch]);
  const hint = useCallback(() => {
    if (!state || state.status !== 'playing') return;
    dispatch({ type: 'HINT', cell: selected ?? undefined });
  }, [state, selected, dispatch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;
      if (!state || state.status !== 'playing') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[1-9]$/.test(e.key)) { place(Number(e.key)); return; }
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { erase(); return; }
      if (e.key.toLowerCase() === 'n') { toggleNotes(); return; }
      if (e.key.toLowerCase() === 'h') { hint(); return; }
      const cur = selected ?? 0;
      const r = Math.floor(cur / 9), c = cur % 9;
      if (e.key === 'ArrowUp' && r > 0) setSelected(cur - 9);
      else if (e.key === 'ArrowDown' && r < 8) setSelected(cur + 9);
      else if (e.key === 'ArrowLeft' && c > 0) setSelected(cur - 1);
      else if (e.key === 'ArrowRight' && c < 8) setSelected(cur + 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, selected, place, erase, undo, toggleNotes, hint]);

  // Digits fully placed (nine correct cells) dim on the pad.
  const completeDigits = useMemo(() => {
    const done = new Set<number>();
    if (!state) return done;
    for (let d = 1; d <= 9; d++) {
      let n = 0;
      for (let i = 0; i < 81; i++) if (state.board[i] === String(d) && state.solution[i] === String(d)) n++;
      if (n === 9) done.add(d);
    }
    return done;
  }, [state]);

  const handleShare = useCallback(async () => {
    if (!state) return;
    const out = await shareResult({
      layout: 'sudoku',
      mode: 'Sudocious',
      won: state.status === 'won',
      guesses: state.mistakes + 1,
      maxGuesses: SUDOKU_MAX_MISTAKES + 1,
      timeSeconds: elapsedSeconds,
      givens: state.givens,
      board: state.board,
      hintMask: state.hintMask,
      mistakes: state.mistakes,
      difficulty: DIFFICULTY_LABEL[state.difficulty],
      puzzleNumber: mode === 'daily' ? sudokuDailyNumber(getTodayLocal()) : undefined,
      points: computeScoreBreakdown('SUDOKU', state.status === 'won', state.mistakes + 1, elapsedSeconds, state.status === 'won' ? 1 : 0, 1, state.hintsUsed).total,
    });
    if (out.via !== 'failed') { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }, [state, elapsedSeconds, mode]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
  };

  if (!state) return null;

  const finished = state.status !== 'playing';
  const won = state.status === 'won';
  const remaining = sudokuRemaining(state);
  const mistakeDots = (
    <span className="inline-flex items-center gap-0.5 align-middle" aria-label={`${mistakes} of ${SUDOKU_MAX_MISTAKES} mistakes`}>
      {Array.from({ length: SUDOKU_MAX_MISTAKES }, (_, i) => (
        <span key={i} className="inline-block w-2 h-2 rounded-full" style={{ background: i < mistakes ? '#dc2626' : 'var(--color-border-light)' }} />
      ))}
    </span>
  );

  const board = (
    <SudokuBoard state={state} selected={finished ? null : selected} onSelect={(i) => { if (!finished) setSelected(i); }} revealSolution={state.status === 'lost'} />
  );

  return (
    <div
      className={`h-screen-stable flex flex-col relative ${finished ? 'pb-[calc(env(safe-area-inset-bottom)+64px)]' : ''}`}
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} guesses={state.mistakes} guessLabel="Mistakes" timeSeconds={elapsedSeconds} points={computeScoreBreakdown('SUDOKU', true, state.mistakes + 1, elapsedSeconds, 1, 1, state.hintsUsed).total} onPlayAgain={mode !== 'daily' && isPro ? () => startPractice(difficulty) : undefined} />}
      {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={state.mistakes} guessLabel="Mistakes" timeSeconds={elapsedSeconds} points={computeScoreBreakdown('SUDOKU', false, state.mistakes + 1, elapsedSeconds, 0, 1, state.hintsUsed).total} onPlayAgain={mode !== 'daily' && isPro ? () => startPractice(difficulty) : undefined} />}
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} flawlessStreak={xpResult.flawlessStreak} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      {/* Header — the same Home / "?" / sound trio as every game (§19). */}
      <div className="text-center py-2 px-2 shrink-0 relative">
        <GameHomeButton accentColor={SUDOKU_ACCENT} />
        <GameGuideButton slug="sudocious" accentColor={SUDOKU_ACCENT} />
        <SoundToggle accentColor={SUDOKU_ACCENT} />
        <h1 className="text-2xl font-black" style={{ color: SUDOKU_ACCENT }}>SUDOCIOUS</h1>
        <div className="flex justify-center items-center gap-2 mt-1 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
          {mode === 'daily' && <span>#{sudokuDailyNumber(getTodayLocal())}</span>}
          <span>{DIFFICULTY_LABEL[state.difficulty]}</span>
          <span className="flex items-center gap-1">Mistakes {mistakeDots}</span>
          <span><Clock className="w-3 h-3 inline mr-0.5" />{formatTime(elapsedSeconds)}</span>
        </div>
        {message && (
          <div className="absolute left-0 right-0 z-20 text-center" style={{ top: '90px' }}>
            <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-lg">{message}</span>
          </div>
        )}
      </div>

      {!finished ? (
        <>
          {/* Pro Unlimited: pick the difficulty. Switching starts a fresh puzzle. */}
          {mode !== 'daily' && isPro && (
            <div className="shrink-0 flex justify-center gap-2 px-4 pb-2" role="radiogroup" aria-label="Difficulty">
              {(['easy', 'medium', 'hard'] as SudokuDifficulty[]).map((d) => {
                const active = d === state.difficulty;
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => { if (!active) startPractice(d); }}
                    className={`text-xs font-bold px-3 py-1 rounded-full border transition-all ${active ? 'text-white' : ''}`}
                    style={active ? { background: SUDOKU_ACCENT, borderColor: SUDOKU_ACCENT } : { borderColor: `${SUDOKU_ACCENT}55`, color: SUDOKU_ACCENT }}
                  >
                    {DIFFICULTY_LABEL[d]}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center px-3 pb-1">
            {board}
          </div>

          <div className="shrink-0 pb-2 px-2 pt-1">
            <NumberPad
              onDigit={place} onUndo={undo} onErase={erase} onToggleNotes={toggleNotes} onHint={hint}
              notesMode={state.notesMode} canUndo={state.history.length > 0} hintsUsed={state.hintsUsed}
              completeDigits={completeDigits}
            />
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex items-center justify-center px-3 py-2">{board}</div>

            {/* Result panel — the answer is on the board above (a lost board
                shows the solution in muted digits), so nobody leaves without it. */}
            <div className="px-4 pb-4 animate-fade-in-up">
              <div className="flex items-center gap-3 rounded-xl p-3 bg-white border border-gray-100 shadow-sm">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-2xl font-black"
                  style={{ backgroundColor: `${SUDOKU_ACCENT}15`, border: `2px solid ${SUDOKU_ACCENT}44`, color: SUDOKU_ACCENT }}>
                  {won ? '✓' : remaining}
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className={`text-sm font-bold ${won ? 'text-green-600' : 'text-red-500'}`}>
                    {won ? 'Sudocious solved' : 'Out of mistakes'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {won
                      ? `${formatGuessStat('mistakes', 1, state.mistakes + 1)} · ${formatTime(elapsedSeconds)}${state.hintsUsed ? ` · ${state.hintsUsed} hint${state.hintsUsed === 1 ? '' : 's'}` : ''}`
                      : `${remaining} cell${remaining === 1 ? '' : 's'} left · ${formatTime(elapsedSeconds)}`}
                  </span>
                  <div className="flex items-center gap-3 mt-0.5">
                    <Link href="/" className="text-gray-400 text-xs font-bold underline">Home</Link>
                    <button onClick={handleShare} className="text-blue-500 text-xs font-bold underline">{copied ? 'Copied!' : 'Share'}</button>
                    {mode === 'daily' && <DailyRankBadge gameMode="SUDOKU" />}
                    {mode !== 'daily' && isPro && <button onClick={() => startPractice(difficulty)} className="text-xs font-bold underline" style={{ color: SUDOKU_ACCENT }}>Play Again</button>}
                  </div>
                </div>
              </div>
              <ScoreBreakdownCard
                gameMode="SUDOKU"
                completed={won}
                guessCount={state.mistakes + 1}
                timeSeconds={elapsedSeconds}
                boardsSolved={won ? 1 : 0}
                totalBoards={1}
                hintsUsed={state.hintsUsed}
                day={mode === 'daily' ? getTodayLocal() : undefined}
              />
              {mode === 'daily' && <NextDailyCta currentMode="SUDOKU" />}
            </div>
          </div>
          <BottomNav />
        </>
      )}
    </div>
  );
}
