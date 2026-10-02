'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MORE_HOME_HREF } from '@/lib/more-games';
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
import { GameHostTitle } from '@/components/ui/mascot';
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
import { getTodayLocal, fetchSolvedDailyRow } from '@/lib/daily-service';
import { useActivePlayTimer } from '@/hooks/use-active-play-timer';
import { useThrottledSave } from '@/hooks/use-throttled-save';
import { PlayClock } from '@/components/game/play-clock';
import { useCompletedElsewhere } from '@/hooks/use-completed-elsewhere';
import { CompletedCustomDaily } from '@/components/game/completed-custom-daily';
import { sudokuElsewhere } from '@/lib/elsewhere-progress';
import { isTypingTarget } from '@/lib/keyboard';
import { playInvalid } from '@/lib/sounds';
import { haptic } from '@/lib/haptics';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { NextDailyCta } from '@/components/game/next-daily-cta';
import { formatGuessStat } from '@/lib/format';
import { computeScoreBreakdown } from '@/lib/composite-scoring';
import { GameBackground } from '@/components/ui/page-background';
import { gameHeaderStyle, gameToastTop } from '@/lib/art';
import { ResultCard, ShareGlyph, PlayAgainButton } from '@/components/game/result-line';

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

  // Daily with no local save for today's seed → ask daily_results whether it
  // was finished on another device before showing a fresh board (founder, 2026-09-28).
  const [noLocalSave, setNoLocalSave] = useState(false);
  const { checking, completion } = useCompletedElsewhere('SUDOKU', mode === 'daily' && noLocalSave);
  const holdPlay = checking || !!completion;
  // The finished board and exact breakdown inputs from the matches row when today's daily was played elsewhere.
  const [elsewhere, setElsewhere] = useState<ReturnType<typeof sudokuElsewhere> | null>(null);

  const status = state?.status ?? 'playing';
  // The header clock ticks on its own (PlayClock); the board re-renders only on play (founder, 2026-09-29).
  const timer = useActivePlayTimer(!!state && status === 'playing' && !holdPlay, 0, { tick: false });
  const { elapsedSeconds, reset: resetTimer, getElapsed } = timer;

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
      setNoLocalSave(true);
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
  // Never write the untouched fresh board while the other-device check is
  // pending or positive: that save would hide the completed card on reload.
  useThrottledSave(!state || (mode === 'daily' && holdPlay) ? null : (sec) => {
    if (mode === 'daily') saveDaily(state.seed, state, sec);
    else savePractice(state.seed, state, sec);
  }, getElapsed, [state, mode, holdPlay]);

  // Played elsewhere today (founder, 2026-09-28: "make it exact everywhere"):
  // the matches row holds what daily_results does not — hints_used and the
  // finished grid — so the card scores the same inputs the phone recorded.
  useEffect(() => {
    if (!completion || !profile || mode !== 'daily') return;
    const seed = generateDailySeed(getTodayLocal(), 'SUDOKU');
    let cancelled = false;
    fetchSolvedDailyRow(profile.id, 'SUDOKU', seed).then((row) => {
      if (cancelled || !row) return;
      setElsewhere(sudokuElsewhere(row, { seed, won: completion.won, guessCount: completion.guesses }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [completion, profile, mode]);

  const hintsUsed = state?.hintsUsed ?? 0;
  const mistakes = state?.mistakes ?? 0;

  const recordResult = useCallback(() => {
    const elapsedSeconds = getElapsed();
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
  }, [profile, state, getElapsed, mode]);

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
      const isArrow = e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      // Nothing selected yet: the first arrow lands on the top-left cell
      // (it used to step from an implied cell 0, so → selected r1c2).
      if (selected == null) { if (isArrow) { e.preventDefault(); setSelected(0); } return; }
      const cur = selected;
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

  // Stable so memo(SudokuBoard) skips re-renders that do not touch the board (founder, 2026-09-29).
  const isFinished = !!state && state.status !== 'playing';
  const onSelectCell = useCallback((i: number) => { if (!isFinished) setSelected(i); }, [isFinished]);

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
    <SudokuBoard state={state} selected={finished ? null : selected} onSelect={onSelectCell} revealSolution={state.status === 'lost'} />
  );

  return (
    <GameBackground
      mode="SUDOKU"
      className={`h-screen-stable flex flex-col relative ${finished || completion ? 'pb-[calc(env(safe-area-inset-bottom)+80px)]' : ''}`}
    >
      {showVictory && <VictoryAnimation mode="SUDOKU" onComplete={() => setShowVictory(false)} guesses={state.mistakes} guessLabel="Mistakes" timeSeconds={elapsedSeconds} points={computeScoreBreakdown('SUDOKU', true, state.mistakes + 1, elapsedSeconds, 1, 1, state.hintsUsed).total} onPlayAgain={mode !== 'daily' && isPro ? () => startPractice(difficulty) : undefined} />}
      {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={state.mistakes} guessLabel="Mistakes" timeSeconds={elapsedSeconds} points={computeScoreBreakdown('SUDOKU', false, state.mistakes + 1, elapsedSeconds, 0, 1, state.hintsUsed).total} onPlayAgain={mode !== 'daily' && isPro ? () => startPractice(difficulty) : undefined} />}
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} flawlessStreak={xpResult.flawlessStreak} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      {/* Header — the same Home / "?" / sound trio as every game (§19). */}
      <div className="game-art-header text-center px-2 shrink-0 relative" style={gameHeaderStyle('SUDOKU')}>
        <GameHomeButton accentColor={SUDOKU_ACCENT}  href={MORE_HOME_HREF} />
        <GameGuideButton slug="sudocious" accentColor={SUDOKU_ACCENT} />
        <SoundToggle accentColor={SUDOKU_ACCENT} />
        <GameHostTitle mode="SUDOKU" label="Sudocious">
          <h1 className="text-2xl font-black" style={{ color: SUDOKU_ACCENT }}>SUDOCIOUS</h1>
        </GameHostTitle>
        <div className="flex justify-center items-center gap-2 mt-1 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
          {mode === 'daily' && <span>#{sudokuDailyNumber(getTodayLocal())}</span>}
          <span>{DIFFICULTY_LABEL[state.difficulty]}</span>
          <span className="flex items-center gap-1">Mistakes {mistakeDots}</span>
          <span><Clock className="w-3 h-3 inline mr-0.5" /><PlayClock timer={timer}>{formatTime}</PlayClock></span>
        </div>
        {message && (
          <div className="absolute left-0 right-0 z-20 text-center" style={{ top: gameToastTop(90) }}>
            <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-lg">{message}</span>
          </div>
        )}
      </div>

      {completion ? (
        // Today's daily was finished on another device (founder, 2026-09-28): the
        // day's grid from the matches row (a loss shows the solution muted), then the card.
        <CompletedCustomDaily dbKey="SUDOKU" completion={completion}
          boardsSolved={elsewhere?.progress.boardsSolved} totalBoards={elsewhere?.progress.totalBoards} hintsUsed={elsewhere?.progress.hintsUsed}>
          {elsewhere?.state && <SudokuBoard state={elsewhere.state} selected={null} onSelect={() => {}} revealSolution={!completion.won} />}
        </CompletedCustomDaily>
      ) : checking ? (
        // Header only while daily_results is read: no fresh-board flash, no clock.
        <div className="flex-1 min-h-0" aria-busy="true" />
      ) : !finished ? (
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
              <ResultCard accent={SUDOKU_ACCENT}>
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
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <ShareGlyph onShare={handleShare} copied={copied} />
                    {mode === 'daily' && <DailyRankBadge gameMode="SUDOKU" />}
                    {mode !== 'daily' && isPro && <PlayAgainButton onClick={() => startPractice(difficulty)} won />}
                  </div>
                </div>
              </ResultCard>
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
    </GameBackground>
  );
}
