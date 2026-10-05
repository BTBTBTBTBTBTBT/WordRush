'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MORE_HOME_HREF } from '@/lib/more-games';
import dynamic from 'next/dynamic';
const VictoryAnimation = dynamic(() => import('@/components/effects/victory-animation').then(m => m.VictoryAnimation), { ssr: false });
const GameOverAnimation = dynamic(() => import('@/components/effects/game-over-animation').then(m => m.GameOverAnimation), { ssr: false });
import { Clock } from 'lucide-react';
import {
  generateRegions, createRegionsState, regionsReduce, regionsMatchRow, regionsRemaining, regionsDailyNumber,
  regionsSizeForDay, generateDailySeed, REGIONS_MAX_MISTAKES, type RegionsState, type RegionsAction, type RegionsSize,
} from '@wordle-duel/core';
import { GameHomeButton } from '@/components/game/game-home-button';
import { GameGuideButton } from '@/components/game/game-guide-button';
import { GameHostTitle } from '@/components/ui/mascot';
import { SoundToggle } from '@/components/game/sound-toggle';
import { RegionsBoard, STARSWEEP_BOARD_EXTRA } from './regions-board';
import { RegionsPad } from './regions-pad';
import { REGIONS_ACCENT, REGIONS_HEADER, REGIONS_TITLE, REGIONS_WIN_TITLE, REGIONS_LOSS_TITLE, REGIONS_SIZE_LABEL, REGIONS_TAP_HINT } from './copy';
import { loadDailySave, saveDaily, loadPracticeSave, savePractice } from './persistence';
import { recordModePlayed } from '@/lib/play-limit-service';
import { shareResult } from '@/lib/share-utils';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult, noteGuestDailyFinish, recordSoloMatch, type XpResult } from '@/lib/stats-service';
import { XpToast } from '@/components/effects/xp-toast';
import { DailyRankBadge } from '@/components/game/daily-rank-badge';
import { getTodayLocal, fetchSolvedDailyRow } from '@/lib/daily-service';
import { useActivePlayTimer } from '@/hooks/use-active-play-timer';
import { useThrottledSave } from '@/hooks/use-throttled-save';
import { PlayClock } from '@/components/game/play-clock';
import { useCompletedElsewhere } from '@/hooks/use-completed-elsewhere';
import { PuzzleElsewhere, PuzzleFinished, FINISHED_SHELL_PAD } from '@/components/puzzles/finished-screen';
import { regionsElsewhere } from '@/lib/elsewhere-progress';
import { isTypingTarget } from '@/lib/keyboard';
import { playInvalid } from '@/lib/sounds';
import { haptic } from '@/lib/haptics';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { formatGuessStat } from '@/lib/format';
import { computeScoreBreakdown } from '@/lib/composite-scoring';
import { GameBackground } from '@/components/ui/page-background';
import { gameHeaderStyle } from '@/lib/art';
import { FeedbackToast } from '@/components/game/feedback-toast';
import { FinishedDock, MoreDisclosure, ResultStrip } from '@/components/game/finished-kit';
import { useBoardFit } from '@/hooks/use-board-fit';
import { softPill, softBackground, softBorder } from '@/lib/soft-surface';
import { CandySegment } from '@/components/ui/candy-segment';

// Starsweep (More Games §18b): place one star in every row, column and color
// region, no two stars touching. Daily 7 × 7 Monday–Wednesday, 8 × 8
// Thursday–Sunday; Pro Unlimited picks 7 / 8 / 9. Tap = a black (unjudged) star
// that auto-crosses, double-tap = play it (purple right, red wrong — a red star's
// ×s go), tap a black star = ×, tap an × = clear. A wrong star is a mistake, the third loses; a hint
// places one correct star for a score cost, never a mistake.
// guess_count = mistakes + 1 (perfect = 1), boards 1/1 — the Sudocious scoring row.

const SIZES: RegionsSize[] = [7, 8, 9];
/** Two taps on one cell within this window are a double tap (play the star). */
const DOUBLE_TAP_MS = 350;

interface RegionsGameProps {
  /** /starsweep?daily=true → today's board, recorded to daily_results. */
  isDaily?: boolean;
}

function buildState(seed: string, n: RegionsSize): RegionsState | null {
  const p = generateRegions(seed, n);
  return p ? createRegionsState(p, Date.now()) : null;
}

export function RegionsGame({ isDaily = false }: RegionsGameProps) {
  const { profile, isProActive } = useAuth();
  const isPro = isProActive;
  const mode: 'daily' | 'practice' = isDaily ? 'daily' : 'practice';

  const [state, setState] = useState<RegionsState | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
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
  const { checking, completion } = useCompletedElsewhere('REGIONS', mode === 'daily' && noLocalSave);
  const holdPlay = checking || !!completion;
  // The finished board and exact breakdown inputs from the matches row when today's daily was played elsewhere.
  const [elsewhere, setElsewhere] = useState<ReturnType<typeof regionsElsewhere> | null>(null);

  const status = state?.status ?? 'playing';
  // The header clock ticks on its own (PlayClock); the board re-renders only on play (founder, 2026-09-29).
  const timer = useActivePlayTimer(!!state && status === 'playing' && !holdPlay, 0, { tick: false });
  const { elapsedSeconds, reset: resetTimer, getElapsed } = timer;

  // FINISH_SPEC B5: the playing board fills the space between the status line
  // and the pad (the shared rule, lib/board-fit.ts), capped at the old 420 px.
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const boardN = state?.n ?? 8;
  const boardFit = useBoardFit(
    boardAreaRef,
    { cols: boardN, rows: boardN, gap: 0, extraWidth: STARSWEEP_BOARD_EXTRA.width, vPad: STARSWEEP_BOARD_EXTRA.height + 8, maxTile: 60, maxWidth: 440 },
    `${status}-${holdPlay}-${state ? state.seed : ''}`,
  );

  const startPractice = useCallback((n: RegionsSize) => {
    // The trailing size segment is what regionsSizeForSeed() reads back.
    const seed = `unlimited-REGIONS-${Date.now()}-${n}`;
    setState(buildState(seed, n));
    setFocused(null);
    setShowVictory(false); setShowGameOver(false); setXpResult(null); setMessage('');
    resetTimer(0);
    restoredRef.current = false;
    hasRecordedRef.current = false;
  }, [resetTimer]);

  useEffect(() => {
    if (mode === 'daily') {
      const today = getTodayLocal();
      const seed = generateDailySeed(today, 'REGIONS');
      const saved = loadDailySave(seed);
      if (saved) {
        setState(saved.state); resetTimer(saved.elapsedSeconds);
        const done = saved.state.status !== 'playing';
        restoredRef.current = done; hasRecordedRef.current = done;
        return;
      }
      setState(buildState(seed, regionsSizeForDay(today)));
      resetTimer(0);
      restoredRef.current = false;
      setNoLocalSave(true);
    } else {
      const saved = loadPracticeSave();
      if (saved) {
        setState(saved.state); resetTimer(saved.elapsedSeconds);
        const done = saved.state.status !== 'playing';
        restoredRef.current = done; hasRecordedRef.current = done;
        return;
      }
      startPractice(8);
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const dispatch = useCallback((a: RegionsAction) => {
    setState((s) => (s ? regionsReduce(s, a, Date.now()) : s));
  }, []);

  // Never write the untouched fresh board while the other-device check is
  // pending or positive: that save would hide the completed card on reload.
  useThrottledSave(!state || (mode === 'daily' && holdPlay) ? null : (sec) => {
    if (mode === 'daily') saveDaily(state.seed, state, sec);
    else savePractice(state.seed, state, sec);
  }, getElapsed, [state, mode, holdPlay]);

  // Played elsewhere today (founder, 2026-09-28: "make it exact everywhere"):
  // the matches row holds what daily_results does not — hints_used and the
  // finished board — so the card scores the same inputs the phone recorded.
  useEffect(() => {
    if (!completion || !profile || mode !== 'daily') return;
    const seed = generateDailySeed(getTodayLocal(), 'REGIONS');
    let cancelled = false;
    fetchSolvedDailyRow(profile.id, 'REGIONS', seed).then((row) => {
      if (cancelled || !row) return;
      setElsewhere(regionsElsewhere(row, { seed, won: completion.won, guessCount: completion.guesses }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [completion, profile, mode]);

  const mistakes = state?.mistakes ?? 0;

  const recordResult = useCallback(() => {
    const elapsedSeconds = getElapsed();
    if (!state || hasRecordedRef.current) return;
    if (state.status !== 'won' && state.status !== 'lost') return;
    hasRecordedRef.current = true;
    const won = state.status === 'won';
    const timeMs = elapsedSeconds * 1000;
    const seed = mode === 'daily' ? state.seed : undefined;
    // Guest: today's daily still flips Home (the optimistic path, no server).
    if (!profile) { noteGuestDailyFinish('REGIONS', won, state.mistakes + 1, timeMs, seed, won ? 1 : 0, 1, state.hintsUsed); return; }
    recordGameResult(profile.id, 'REGIONS', 'solo', won, state.mistakes + 1, timeMs, seed, won ? 1 : 0, 1, state.hintsUsed)
      .then((xp) => { if (xp) setXpResult(xp); });
    const row = regionsMatchRow(state);
    recordSoloMatch({
      userId: profile.id,
      gameMode: 'REGIONS',
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

  useEffect(() => {
    if (!state || state.status === 'playing') return;
    if (!restoredRef.current) {
      if (state.status === 'won') setShowVictory(true); else setShowGameOver(true);
    }
    recordModePlayed('starsweep');
    recordResult();
    restoredRef.current = false;
  }, [state?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // A board with every star played must end (a save from before the red-star fix could sit
  // solved with the clock running — founder, 2026-09-28).
  useEffect(() => {
    if (state && state.status === 'playing' && regionsRemaining(state) === 0) dispatch({ type: 'SETTLE' });
  }, [state, dispatch]);

  useEffect(() => {
    if (profile && state && state.status !== 'playing') recordResult();
  }, [profile, recordResult, state]);

  // Input: a tap cycles the cell (empty → black star → × → empty) and applies at once;
  // a second tap on the same cell within DOUBLE_TAP_MS, when the first tap started from
  // empty or a black star, is a double tap: undo the first tap and COMMIT the star
  // (founder, 2026-09-28 afternoon). The cell becomes the focus for Erase/keys.
  const lastTapRef = useRef<{ cell: number; at: number; from: string } | null>(null);
  const commitCell = useCallback((cell: number, undoFirst: boolean) => {
    if (!state) return;
    const r = Math.floor(cell / state.n);
    if (state.solution.charCodeAt(r) - 48 !== cell % state.n) { haptic('medium'); playInvalid(); }
    if (undoFirst) dispatch({ type: 'UNDO' });
    dispatch({ type: 'COMMIT', cell });
  }, [state, dispatch]);
  const tapCell = useCallback((cell: number) => {
    if (!state || state.status !== 'playing') return;
    setFocused(cell);
    if (state.board[cell] === '*' && state.hintMask[cell] === '1') { playInvalid(); return; }
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.cell === cell && now - last.at <= DOUBLE_TAP_MS && (last.from === '.' || last.from === 'o')) {
      lastTapRef.current = null;
      commitCell(cell, true);
      return;
    }
    lastTapRef.current = { cell, at: now, from: state.board[cell] };
    dispatch({ type: 'TAP', cell });
  }, [state, dispatch, commitCell]);
  const erase = useCallback(() => { if (focused != null) dispatch({ type: 'ERASE', cell: focused }); }, [focused, dispatch]);
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [dispatch]);
  const toggleAutoCross = useCallback(() => { if (state) dispatch({ type: 'SET_AUTO_CROSS', value: !state.autoCross }); }, [state, dispatch]);
  const hint = useCallback(() => {
    if (!state || state.status !== 'playing') return;
    dispatch({ type: 'HINT', cell: focused ?? undefined });
  }, [state, focused, dispatch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;
      if (!state || state.status !== 'playing') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === ' ') { if (focused != null) { e.preventDefault(); tapCell(focused); } return; }
      // Enter plays the focused black star (the keyboard's double tap).
      if (e.key === 'Enter') { if (focused != null && (state.board[focused] === 'o' || state.board[focused] === '.')) { e.preventDefault(); commitCell(focused, false); } return; }
      if (e.key === 'Backspace' || e.key === 'Delete') { erase(); return; }
      if (e.key.toLowerCase() === 'h') { hint(); return; }
      const n = state.n, cur = focused ?? 0;
      const r = Math.floor(cur / n), c = cur % n;
      if (e.key === 'ArrowUp' && r > 0) setFocused(cur - n);
      else if (e.key === 'ArrowDown' && r < n - 1) setFocused(cur + n);
      else if (e.key === 'ArrowLeft' && c > 0) setFocused(cur - 1);
      else if (e.key === 'ArrowRight' && c < n - 1) setFocused(cur + 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, focused, tapCell, commitCell, erase, undo, hint]);

  const handleShare = useCallback(async () => {
    if (!state) return;
    const out = await shareResult({
      layout: 'regions',
      mode: 'Starsweep',
      won: state.status === 'won',
      guesses: state.mistakes + 1,
      maxGuesses: REGIONS_MAX_MISTAKES + 1,
      timeSeconds: elapsedSeconds,
      n: state.n,
      regions: state.regions,
      board: state.board,
      hintMask: state.hintMask,
      mistakes: state.mistakes,
      sizeLabel: REGIONS_SIZE_LABEL[state.n] ?? `${state.n} × ${state.n}`,
      puzzleNumber: mode === 'daily' ? regionsDailyNumber(getTodayLocal()) : undefined,
      points: computeScoreBreakdown('REGIONS', state.status === 'won', state.mistakes + 1, elapsedSeconds, state.status === 'won' ? 1 : 0, 1, state.hintsUsed).total,
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
  const remaining = regionsRemaining(state);
  const points = computeScoreBreakdown('REGIONS', won, state.mistakes + 1, elapsedSeconds, won ? 1 : 0, 1, state.hintsUsed).total;
  const mistakeDots = (
    <span className="inline-flex items-center gap-0.5 align-middle" aria-label={`${mistakes} of ${REGIONS_MAX_MISTAKES} mistakes`}>
      {Array.from({ length: REGIONS_MAX_MISTAKES }, (_, i) => (
        <span key={i} className="inline-block w-2 h-2 rounded-full" style={{ background: i < mistakes ? '#dc2626' : 'var(--color-border-light)' }} />
      ))}
    </span>
  );

  const board = (
    <RegionsBoard state={state} focused={finished ? null : focused} onTap={tapCell} revealSolution={state.status === 'lost'}
      maxSize={!finished && boardFit ? boardFit.w : undefined} trayState={state.status === 'won' ? 'won' : state.status === 'lost' ? 'lost' : 'playing'} />
  );

  return (
    <GameBackground
      mode="REGIONS"
      className="h-screen-stable flex flex-col relative"
      style={finished || completion ? FINISHED_SHELL_PAD : undefined}
    >
      {showVictory && <VictoryAnimation mode="REGIONS" onComplete={() => setShowVictory(false)} guesses={state.mistakes} guessLabel="Mistakes" timeSeconds={elapsedSeconds} points={computeScoreBreakdown('REGIONS', true, state.mistakes + 1, elapsedSeconds, 1, 1, state.hintsUsed).total} onPlayAgain={mode !== 'daily' && isPro ? () => startPractice(state.n as RegionsSize) : undefined} />}
      {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={state.mistakes} guessLabel="Mistakes" timeSeconds={elapsedSeconds} points={computeScoreBreakdown('REGIONS', false, state.mistakes + 1, elapsedSeconds, 0, 1, state.hintsUsed).total} onPlayAgain={mode !== 'daily' && isPro ? () => startPractice(state.n as RegionsSize) : undefined} />}
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} flawlessStreak={xpResult.flawlessStreak} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      <div className="game-art-header text-center px-2 shrink-0 relative" style={gameHeaderStyle('REGIONS')}>
        <GameHomeButton accentColor={REGIONS_ACCENT}  href={MORE_HOME_HREF} />
        <GameGuideButton slug="starsweep" accentColor={REGIONS_ACCENT} />
        <SoundToggle accentColor={REGIONS_ACCENT} />
        <GameHostTitle mode="REGIONS" label="Starsweep">
          <h1 className="text-2xl font-black" style={{ color: REGIONS_ACCENT }}>{REGIONS_HEADER}</h1>
        </GameHostTitle>
        <div className="relative flex justify-center items-center gap-2 mt-1 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
          {mode === 'daily' && <span>#{regionsDailyNumber(getTodayLocal())}</span>}
          <span>{REGIONS_SIZE_LABEL[state.n] ?? `${state.n} × ${state.n}`}</span>
          <span className="flex items-center gap-1">Mistakes {mistakeDots}</span>
          <span><Clock className="w-3 h-3 inline mr-0.5" /><PlayClock timer={timer}>{formatTime}</PlayClock></span>
          <FeedbackToast message={message} />
        </div>
      </div>

      {completion ? (
        // Today's daily was finished on another device (founder, 2026-09-28): the
        // day's board from the matches row (a loss shows the missing stars muted), then the card.
        <PuzzleElsewhere dbKey="REGIONS" completion={completion}
          boardsSolved={elsewhere?.progress.boardsSolved} totalBoards={elsewhere?.progress.totalBoards} hintsUsed={elsewhere?.progress.hintsUsed}>
          {elsewhere?.state && <RegionsBoard state={elsewhere.state} focused={null} onTap={() => {}} revealSolution={!completion.won} trayState={completion.won ? 'won' : 'lost'} />}
        </PuzzleElsewhere>
      ) : checking ? (
        // Header only while daily_results is read: no fresh-board flash, no clock.
        <div className="flex-1 min-h-0" aria-busy="true" />
      ) : !finished ? (
        <>
          {mode !== 'daily' && isPro && (
            // Button family §4: a three-way choice is the candy segmented (frosted track + glossy thumb).
            <div className="shrink-0 flex justify-center px-4 pb-2">
              <CandySegment label="Board size" height={32} itemPad={14}
                options={SIZES.map((n) => ({ key: String(n), label: REGIONS_SIZE_LABEL[n] }))}
                value={String(state.n)} onChange={(k) => { const n = Number(k) as RegionsSize; if (n !== state.n) startPractice(n); }} />
            </div>
          )}

          <div ref={boardAreaRef} className="flex-1 min-h-0 overflow-hidden flex items-center justify-center pb-1">
            {board}
          </div>

          <div className="shrink-0 pb-2 px-2 pt-1 flex flex-col gap-1.5">
            <div className="text-center text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
              {remaining === state.n && state.history.length === 0 ? REGIONS_TAP_HINT : `${remaining} star${remaining === 1 ? '' : 's'} left`}
            </div>
            <RegionsPad
              onUndo={undo} onErase={erase} onToggleAutoCross={toggleAutoCross} onHint={hint}
              autoCross={state.autoCross} canUndo={state.history.length > 0}
              canErase={focused != null && state.board[focused] !== '.' && !(state.board[focused] === '*' && state.hintMask[focused] === '1')}
              hintsUsed={state.hintsUsed}
            />
          </div>
        </>
      ) : (
        // FINISH_SPEC R2: one screen — the result strip, the board scaled to the
        // room left (a lost board shows the missing stars muted, so nobody
        // leaves without the answer), then the dock; the breakdown under More.
        <>
          <PuzzleFinished
            strip={
              <ResultStrip won={won} guesses={state.mistakes} guessLabel={state.mistakes === 1 ? 'mistake' : 'mistakes'} time={formatTime(elapsedSeconds)} points={points}
                srText={`${won ? REGIONS_WIN_TITLE : REGIONS_LOSS_TITLE}. ${won
                  ? `${formatGuessStat('mistakes', 1, state.mistakes + 1)} · ${formatTime(elapsedSeconds)}${state.hintsUsed ? ` · ${state.hintsUsed} hint${state.hintsUsed === 1 ? '' : 's'}` : ''}`
                  : `${remaining} star${remaining === 1 ? '' : 's'} left · ${formatTime(elapsedSeconds)}`}`} />
            }
            board={<div className="px-1 pb-1">{board}</div>}
            dock={
              <FinishedDock currentMode="REGIONS" isDaily={mode === 'daily'} onShare={handleShare} copied={copied}
                onNewPuzzle={mode !== 'daily' ? () => startPractice(state.n as RegionsSize) : undefined}
                extra={mode === 'daily' ? <DailyRankBadge gameMode="REGIONS" /> : undefined} />
            }
            more={
              <MoreDisclosure accent={REGIONS_ACCENT}>
                <ScoreBreakdownCard
                  gameMode="REGIONS"
                  completed={won}
                  guessCount={state.mistakes + 1}
                  timeSeconds={elapsedSeconds}
                  boardsSolved={won ? 1 : 0}
                  totalBoards={1}
                  hintsUsed={state.hintsUsed}
                  day={mode === 'daily' ? getTodayLocal() : undefined}
                />
              </MoreDisclosure>
            }
          />
          <BottomNav />
        </>
      )}
    </GameBackground>
  );
}

export { REGIONS_TITLE };
