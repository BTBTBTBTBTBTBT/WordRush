'use client';

import { useState, useEffect, useCallback, useRef, useMemo, type CSSProperties } from 'react';
import { MORE_HOME_HREF } from '@/lib/more-games';
import dynamic from 'next/dynamic';
const VictoryAnimation = dynamic(() => import('@/components/effects/victory-animation').then(m => m.VictoryAnimation), { ssr: false });
const GameOverAnimation = dynamic(() => import('@/components/effects/game-over-animation').then(m => m.GameOverAnimation), { ssr: false });
import { Clock, CheckCheck, Lightbulb, Eye, Flag, ArrowLeftRight, ListOrdered, Grid3x3 } from 'lucide-react';
import {
  crosswordPuzzleForDay, crosswordPuzzleForSeed, crosswordDailyNumber, createCrosswordState, crosswordReduce, crosswordMatchRow, crosswordGuessCount,
  crosswordEntryCells, crosswordEntriesAt, crosswordActiveEntry, crosswordCursorAfterType, crosswordNextEntryCursor, crosswordToggleDir, crosswordCorrectCount, crosswordLetterCount, CROSSWORD_BLOCK, CROSSWORD_EMPTY, CROSSWORD_TOTAL_BOARDS,
  generateDailySeed, type CrosswordState, type CrosswordAction, type CrosswordBank, type CrosswordPuzzle, type CrosswordEntry, type CrosswordDir,
} from '@wordle-duel/core';
import { bankSession, useSessionPuzzle } from '@/lib/bank-loader';
import { GameLoading } from '@/components/game/game-loading';
import { HOLIDAY_TABLE, holidayTitle } from '@/lib/holidays';
import { GameHomeButton } from '@/components/game/game-home-button';
import { GameGuideButton } from '@/components/game/game-guide-button';
import { GameHostTitle } from '@/components/ui/mascot';
import { SoundToggle } from '@/components/game/sound-toggle';
import { Keyboard } from '@/components/game/keyboard';
import { CrosswordBoard, ClueColumns, CROSSWORD_ACCENT, CROSSWORD_TRAY_CHROME } from './crossword-board';
import { alphaHex, softBackground, softBorder } from '@/lib/soft-surface';
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
import { crosswordElsewhere } from '@/lib/elsewhere-progress';
import { isTypingTarget } from '@/lib/keyboard';
import { playInvalid, playKeyTap, playSuccess } from '@/lib/sounds';
import { haptic } from '@/lib/haptics';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { computeScoreBreakdown } from '@/lib/composite-scoring';
import { GameBackground } from '@/components/ui/page-background';
import { gameHeaderStyle } from '@/lib/art';
import { FeedbackToast } from '@/components/game/feedback-toast';
import { FinishedDock, MoreDisclosure, ResultStrip } from '@/components/game/finished-kit';
import { candyClass, candyVars } from '@/components/ui/candy-button';
import { HintCountBadge, StableLabel } from '@/components/ui/hint-kit';
import { crosswordCell } from '@/lib/board-fit';

// Crosswordocious (More Games §13): a themed fill-in sayings crossword. Tap a
// cell or a clue, type; letters are free to set and clear. Check locks right
// letters, clears wrong ones and counts (guess_count = min(checks, 98) + 1).
// Reveal letter (1 hint) / word (2). "Reveal puzzle" is the only loss. The
// grid completes itself when every cell is right.

// Puzzles are fetched one at a time from /banks (lib/bank-loader.ts; founder, 2026-09-29).
const BANK = bankSession<CrosswordBank, CrosswordPuzzle>('crossword', (b, d) => crosswordPuzzleForDay(b, d, HOLIDAY_TABLE), crosswordPuzzleForSeed);

interface CrosswordGameProps { isDaily?: boolean }

/** BI18: the play header is compact like Muddle's — the title art (44 px) in the corner-button row, then the title and the meta line. */
const PLAY_HEADER = { ...gameHeaderStyle('CROSSWORD', 36), '--game-title-top': '6px', '--game-title-cap': '44px', '--game-header-shift': '10px' } as CSSProperties;

export function CrosswordGame({ isDaily = false }: CrosswordGameProps) {
  const { profile, isProActive } = useAuth();
  const isPro = isProActive;
  const mode: 'daily' | 'practice' = isDaily ? 'daily' : 'practice';

  const [state, setState] = useState<CrosswordState | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  // BI18 (founder 10-03: "the daily today required you to scroll"): the whole
  // puzzle fits one screen in play. The grid owns the band between the compact
  // header and the pinned clue bar / controls / keyboard, its cell sized from the
  // band's width AND height for the puzzle's real cols × rows (lib/board-fit.ts
  // crosswordCell: 3 px gaps, the tray chrome off first, 14–42 px). The clue list
  // sits behind the Clues toggle beside the clue bar, never under the grid.
  const [bandEl, setBandEl] = useState<HTMLDivElement | null>(null);
  const [boardCell, setBoardCell] = useState<number | undefined>(undefined);
  const [showClues, setShowClues] = useState(false);
  // Short screens (under 700 px tall) get 44 px keys, like the other one-screen games.
  const [shortScreen, setShortScreen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-height: 699.98px)');
    const on = () => setShortScreen(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const rows = state?.h ?? 0, cols = state?.w ?? 0;
  useEffect(() => {
    const el = bandEl;
    if (!el || !rows) return;
    const measure = () => {
      const next = crosswordCell(el.clientWidth, el.clientHeight, cols, rows, CROSSWORD_TRAY_CHROME);
      setBoardCell((prev) => (prev === next ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, [bandEl, rows, cols]);
  const [dir, setDir] = useState<CrosswordDir>('A');
  const [armReveal, setArmReveal] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const restoredRef = useRef(false);
  const hasRecordedRef = useRef(false);

  // Daily with no local save for today's seed → ask daily_results whether it
  // was finished on another device before showing a fresh grid (founder, 2026-09-28).
  const [noLocalSave, setNoLocalSave] = useState(false);
  const { checking, completion } = useCompletedElsewhere('CROSSWORD', mode === 'daily' && noLocalSave);
  const holdPlay = checking || !!completion;
  // The finished grid and exact breakdown inputs from the matches row when today's daily was played elsewhere.
  const [elsewhere, setElsewhere] = useState<ReturnType<typeof crosswordElsewhere> | null>(null);

  const status = state?.status ?? 'playing';
  // The header clock ticks on its own (PlayClock); the board re-renders only on play (founder, 2026-09-29).
  const timer = useActivePlayTimer(!!state && status === 'playing' && !holdPlay, 0, { tick: false });
  const { elapsedSeconds, reset: resetTimer, getElapsed } = timer;

  const firstOpenCell = (s: CrosswordState): number => { const e = s.entries[0]; const cells = crosswordEntryCells(s, e); return cells.find((i) => s.fill[i] === CROSSWORD_EMPTY) ?? cells[0]; };

  const startPractice = useCallback(() => {
    const seed = `unlimited-CROSSWORD-${Date.now()}`;
    BANK.seed(seed).then((p) => {
      if (!p) return;
      const s = createCrosswordState(p, seed, Date.now());
      setState(s); setSelected(firstOpenCell(s)); setDir(s.entries[0].dir);
      setShowVictory(false); setShowGameOver(false); setXpResult(null); setMessage(''); setArmReveal(false);
      resetTimer(0);
      restoredRef.current = false; hasRecordedRef.current = false;
    }).catch(() => setLoadFailed(true));
  }, [resetTimer]);

  useEffect(() => {
    if (mode === 'daily') {
      const today = getTodayLocal();
      const seed = generateDailySeed(today, 'CROSSWORD');
      const saved = loadDailySave(seed);
      if (saved) {
        setState(saved.state); setSelected(firstOpenCell(saved.state)); setDir(saved.state.entries[0].dir); resetTimer(saved.elapsedSeconds);
        const done = saved.state.status !== 'playing';
        restoredRef.current = done; hasRecordedRef.current = done;
        return;
      }
      // The other-device check runs while the puzzle is fetched.
      setNoLocalSave(true);
      BANK.day(today).then((p) => {
        if (p) { const s = createCrosswordState(p, seed, Date.now()); setState(s); setSelected(firstOpenCell(s)); setDir(s.entries[0].dir); }
        resetTimer(0);
        restoredRef.current = false;
      }).catch(() => setLoadFailed(true));
    } else {
      const saved = loadPracticeSave();
      if (saved) {
        setState(saved.state); setSelected(firstOpenCell(saved.state)); setDir(saved.state.entries[0].dir); resetTimer(saved.elapsedSeconds);
        const done = saved.state.status !== 'playing';
        restoredRef.current = done; hasRecordedRef.current = done;
        return;
      }
      startPractice();
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Never write the untouched fresh grid while the other-device check is
  // pending or positive: that save would hide the completed card on reload.
  useThrottledSave(!state || (mode === 'daily' && holdPlay) ? null : (sec) => {
    if (mode === 'daily') saveDaily(state.seed, state, sec);
    else savePractice(state.seed, state, sec);
  }, getElapsed, [state, mode, holdPlay]);

  // Played elsewhere today (founder, 2026-09-28: "make it exact everywhere"):
  // the matches row holds what daily_results does not — hints_used (letter
  // and word reveals) and the fill — so the card scores what the phone did.
  useEffect(() => {
    if (!completion || !profile || mode !== 'daily') return;
    const today = getTodayLocal();
    const seed = generateDailySeed(today, 'CROSSWORD');
    let cancelled = false;
    Promise.all([fetchSolvedDailyRow(profile.id, 'CROSSWORD', seed), BANK.day(today)]).then(([row, p]) => {
      if (cancelled || !row) return;
      setElsewhere(crosswordElsewhere(row, { seed, won: completion.won, guessCount: completion.guesses }, p));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [completion, profile, mode]);

  const flash = useCallback((m: string) => { setMessage(m); setTimeout(() => setMessage(''), 1400); }, []);

  const dispatch = useCallback((a: CrosswordAction) => {
    setState((s) => {
      if (!s) return s;
      const next = crosswordReduce(s, a, Date.now());
      if (a.type === 'CHECK') {
        if (next.lastWrong.length) { flash(`${next.lastWrong.length} wrong letter${next.lastWrong.length === 1 ? '' : 's'} cleared`); haptic('medium'); playInvalid(); }
        else { flash('Everything filled is right'); playSuccess(); }
        setTimeout(() => setState((t) => (t && t.lastWrong.length ? { ...t, lastWrong: [] } : t)), 700);
      }
      return next;
    });
  }, [flash]);

  const recordResult = useCallback(() => {
    const elapsedSeconds = getElapsed();
    if (!state || hasRecordedRef.current) return;
    if (state.status !== 'won' && state.status !== 'lost') return;
    hasRecordedRef.current = true;
    const won = state.status === 'won';
    const gc = crosswordGuessCount(state.checks);
    const seed = mode === 'daily' ? state.seed : undefined;
    // Guest: today's daily still flips Home (the optimistic path, no server).
    if (!profile) { noteGuestDailyFinish('CROSSWORD', won, gc, elapsedSeconds * 1000, seed, won ? 1 : 0, CROSSWORD_TOTAL_BOARDS, state.hintsUsed); return; }
    recordGameResult(profile.id, 'CROSSWORD', 'solo', won, gc, elapsedSeconds * 1000, seed, won ? 1 : 0, CROSSWORD_TOTAL_BOARDS, state.hintsUsed)
      .then((xp) => { if (xp) setXpResult(xp); });
    const row = crosswordMatchRow(state);
    recordSoloMatch({
      userId: profile.id, gameMode: 'CROSSWORD', won, score: gc, timeSeconds: elapsedSeconds, seed: state.seed,
      solutions: row.solutions, guesses: row.guesses,
      startedAtIso: new Date(Date.now() - elapsedSeconds * 1000).toISOString(), hintsUsed: state.hintsUsed,
    });
  }, [profile, state, getElapsed, mode]);

  useEffect(() => {
    if (!state || state.status === 'playing') return;
    if (!restoredRef.current) { if (state.status === 'won') { setShowVictory(true); } else setShowGameOver(true); }
    recordModePlayed('crosswordocious');
    recordResult();
    restoredRef.current = false;
  }, [state?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (profile && state && state.status !== 'playing') recordResult(); }, [profile, recordResult, state]);

  // ── Selection ──────────────────────────────────────────────────────────
  const activeEntry: CrosswordEntry | null = useMemo(() => {
    if (!state) return null;
    return crosswordActiveEntry(state, selected, dir);
  }, [state, selected, dir]);
  const activeCells = useMemo(() => (state && activeEntry ? crosswordEntryCells(state, activeEntry) : []), [state, activeEntry]);

  const selectCell = useCallback((cell: number) => {
    if (!state || state.solution[cell] === CROSSWORD_BLOCK) return;
    playKeyTap();
    if (cell === selected) { setDir((d) => crosswordToggleDir(state, cell, d)); return; }
    const here = crosswordEntriesAt(state, cell);
    if (here.length && !here.some((e) => e.dir === dir)) setDir(here[0].dir);
    setSelected(cell);
  }, [state, selected, dir]);
  const pickEntry = useCallback((e: CrosswordEntry) => {
    if (!state) return;
    const cells = crosswordEntryCells(state, e);
    setDir(e.dir); setSelected(cells.find((i) => state.fill[i] === CROSSWORD_EMPTY) ?? cells[0]);
    setShowClues(false); // BI18: a picked clue goes back to the grid
  }, [state]);
  /** After typing (core crosswordCursorAfterType): the typed entry owns the direction until it is complete (Doug 10-05). */
  const advance = useCallback((s: CrosswordState, from: number, entry: CrosswordEntry | null) => {
    const next = crosswordCursorAfterType(s, from, entry);
    if (next) { setDir(next.dir); setSelected(next.cell); }
  }, []);
  /** Enter: the next entry with an empty cell (same direction first). */
  const nextEntry = useCallback((s: CrosswordState, entry: CrosswordEntry | null) => {
    const next = entry ? crosswordNextEntryCursor(s, entry) : null;
    if (next) { setDir(next.dir); setSelected(next.cell); }
  }, []);
  /** The clue bar / Space: flip only where both directions pass through the selected cell. */
  const toggleDir = useCallback(() => { if (state) setDir((d) => crosswordToggleDir(state, selected, d)); }, [state, selected]);

  const onKey = useCallback((key: string) => {
    if (!state || state.status !== 'playing' || selected === null) return;
    if (key === 'ENTER') { nextEntry(state, activeEntry); return; }
    if (key === 'BACK') {
      if (state.fill[selected] !== CROSSWORD_EMPTY && state.locked[selected] === '0') { dispatch({ type: 'CLEAR', cell: selected }); playKeyTap(); return; }
      const k = activeCells.indexOf(selected);
      if (k > 0 && activeEntry) { const prev = activeCells[k - 1]; setDir(activeEntry.dir); setSelected(prev); if (state.locked[prev] === '0') dispatch({ type: 'CLEAR', cell: prev }); }
      return;
    }
    if (/^[A-Z]$/.test(key)) {
      if (state.locked[selected] === '1') { flash('That letter is locked'); return; }
      dispatch({ type: 'SET', cell: selected, letter: key }); playKeyTap();
      advance({ ...state, fill: state.fill.slice(0, selected) + key + state.fill.slice(selected + 1) }, selected, activeEntry);
    }
  }, [state, selected, activeEntry, activeCells, dispatch, advance, nextEntry, flash]);

  const check = useCallback(() => {
    if (!state) return;
    const any = [...state.fill].some((ch, i) => ch !== CROSSWORD_EMPTY && ch !== CROSSWORD_BLOCK && state.locked[i] === '0');
    if (any) dispatch({ type: 'CHECK' }); else flash('Fill in some letters first');
  }, [state, dispatch, flash]);
  const revealLetter = useCallback(() => { if (selected !== null) { dispatch({ type: 'REVEAL_LETTER', cell: selected }); haptic('light'); } }, [selected, dispatch]);
  const revealWord = useCallback(() => { if (activeEntry) { dispatch({ type: 'REVEAL_WORD', n: activeEntry.n, dir: activeEntry.dir }); haptic('light'); } }, [activeEntry, dispatch]);
  const revealPuzzle = useCallback(() => {
    if (!armReveal) { setArmReveal(true); flash('Tap again to reveal the whole puzzle (records a loss)'); setTimeout(() => setArmReveal(false), 3000); return; }
    setArmReveal(false); dispatch({ type: 'REVEAL_PUZZLE' }); haptic('medium');
  }, [armReveal, dispatch, flash]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;
      if (!state || state.status !== 'playing' || selected === null) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const move = (dr: number, dc: number) => {
        let r = Math.floor(selected / state.w), c = selected % state.w;
        for (let step = 0; step < Math.max(state.w, state.h); step++) { r += dr; c += dc; if (r < 0 || c < 0 || r >= state.h || c >= state.w) return; const i = r * state.w + c; if (state.solution[i] !== CROSSWORD_BLOCK) { setSelected(i); setDir(dr ? 'D' : 'A'); return; } }
      };
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(0, -1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(0, 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1, 0); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(1, 0); }
      else if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); onKey('ENTER'); }
      else if (e.key === ' ') { e.preventDefault(); toggleDir(); }
      else if (e.key === 'Backspace' || e.key === 'Delete') onKey('BACK');
      else if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key.toUpperCase());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state, selected, onKey, toggleDir]);

  const won = state?.status === 'won';
  const gc = state ? crosswordGuessCount(state.checks) : 1;
  const points = state ? computeScoreBreakdown('CROSSWORD', won, gc, elapsedSeconds, won ? 1 : 0, CROSSWORD_TOTAL_BOARDS, state.hintsUsed).total : 0;

  const handleShare = useCallback(async () => {
    if (!state) return;
    const out = await shareResult({
      layout: 'crossword', mode: 'Crosswordocious', won, guesses: gc, maxGuesses: 6, timeSeconds: elapsedSeconds,
      w: state.w, h: state.h, solution: state.solution, checks: state.checks, puzzleNumber: mode === 'daily' ? crosswordDailyNumber(getTodayLocal()) : undefined, points,
    });
    if (out.via !== 'failed') { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }, [state, elapsedSeconds, mode, points, won, gc]);

  const formatTime = (s: number) => { const m = Math.floor(s / 60), sec = s % 60; return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`; };

  // The bank entry behind this session (fresh or restored) names its holiday.
  const sessionPuzzle = useSessionPuzzle(BANK, state?.id, state?.seed);

  if (!state) return <GameLoading failed={loadFailed} />;

  const finished = state.status !== 'playing';
  const holiday = holidayTitle(sessionPuzzle?.holiday ?? null);
  const checksLabel = state.checks === 0 ? 'No checks' : `${state.checks} check${state.checks === 1 ? '' : 's'}`;
  const filled = crosswordCorrectCount(state), total = crosswordLetterCount(state);
  // FINISH_SPEC A8: the action capsules are small glossy candy buttons (components/ui/candy-button.tsx).
  const capsule = (dim: boolean) => candyClass({ dim });
  const capsuleStyle = (_dim: boolean, danger = false) => (danger ? candyVars('pink') : undefined);

  return (
    <GameBackground mode="CROSSWORD" className="h-screen-stable flex flex-col relative" style={finished || completion ? FINISHED_SHELL_PAD : undefined}>
      {showVictory && <VictoryAnimation mode="CROSSWORD" onComplete={() => setShowVictory(false)} guesses={state.checks} guessLabel="Checks" timeSeconds={elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={state.checks} guessLabel="Checks" timeSeconds={elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} flawlessStreak={xpResult.flawlessStreak} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      <div className="game-art-header text-center px-2 shrink-0 relative" style={!finished && !completion ? PLAY_HEADER : gameHeaderStyle('CROSSWORD')}>
        <GameHomeButton accentColor={CROSSWORD_ACCENT}  href={MORE_HOME_HREF} />
        <GameGuideButton slug="crosswordocious" accentColor={CROSSWORD_ACCENT} />
        <SoundToggle accentColor={CROSSWORD_ACCENT} />
        <GameHostTitle mode="CROSSWORD" label="Crosswordocious" className="px-12">
          <h1 className="font-black whitespace-nowrap" style={{ color: CROSSWORD_ACCENT, fontSize: 'clamp(15px, 5vw, 24px)' }}>CROSSWORDOCIOUS</h1>
        </GameHostTitle>
        <div className="text-sm font-black mt-0.5" style={{ color: 'var(--color-text)' }}>{state.title}</div>
        <div className="relative flex justify-center items-center gap-2 mt-0.5 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
          {mode === 'daily' && <span>#{crosswordDailyNumber(getTodayLocal())}</span>}
          {holiday && <span style={{ color: CROSSWORD_ACCENT }}>{holiday}</span>}
          <span>{filled}/{total} letters</span>
          <span>{checksLabel}</span>
          <span><Clock className="w-3 h-3 inline mr-0.5" /><PlayClock timer={timer}>{formatTime}</PlayClock></span>
          <FeedbackToast message={message} />
        </div>
      </div>

      {completion ? (
        // Today's daily was finished on another device (founder, 2026-09-28): the
        // day's grid and clues with the recorded fill from the matches row, then the card.
        <PuzzleElsewhere dbKey="CROSSWORD" completion={completion}
          boardsSolved={elsewhere?.progress.boardsSolved} totalBoards={elsewhere?.progress.totalBoards} hintsUsed={elsewhere?.progress.hintsUsed}
          moreExtra={elsewhere?.state ? <ClueColumns state={elsewhere.state} activeEntry={null} onPick={() => {}} finished /> : undefined}>
          {elsewhere?.state && <CrosswordBoard state={elsewhere.state} selected={null} activeCells={[]} onSelect={() => {}} finished />}
        </PuzzleElsewhere>
      ) : checking ? (
        // Header only while daily_results is read: no fresh-board flash, no clock.
        <div className="flex-1 min-h-0" aria-busy="true" />
      ) : !finished ? (
        <>
          {/* BI18: the band holds the grid alone, fitted (no scrolling); the Clues toggle swaps in the list, which scrolls inside the band. */}
          <div ref={setBandEl} className={`flex-1 min-h-0 flex flex-col items-center px-3 pt-1 pb-1 ${showClues ? 'overflow-y-auto' : 'overflow-hidden justify-center'}`}>
            {showClues
              ? <ClueColumns state={state} activeEntry={activeEntry} onPick={pickEntry} finished={false} />
              : <CrosswordBoard state={state} selected={selected} activeCells={activeCells} onSelect={selectCell} finished={false} cell={boardCell} />}
          </div>
          <div className="shrink-0 pb-2 px-2 pt-1 flex flex-col gap-2">
            {/* BI22: the clue bar's fixed two-line slot ALWAYS renders (empty with no active entry) so the grid never resizes. */}
            {(
              <div className="mx-auto max-w-[700px] w-full flex items-stretch gap-1.5">
                {/* BI18: the bar keeps a fixed two-line height so the grid never resizes between clues. */}
                <button type="button" disabled={!activeEntry} onClick={toggleDir} className="flex-1 min-w-0 h-[60px] flex items-center gap-2 rounded-xl px-3 pt-2.5 pb-2 text-left" style={{ background: softBackground(CROSSWORD_ACCENT, 0.13), border: softBorder(CROSSWORD_ACCENT, 0.13), boxShadow: `inset 0 4px 0 ${CROSSWORD_ACCENT}, 0 4px 10px ${alphaHex(CROSSWORD_ACCENT, 0.12)}` }} aria-label={activeEntry ? 'Active clue; tap to switch direction' : 'No clue selected'}>
                  {activeEntry && (<>
                    <span className="shrink-0 rounded-md text-[11px] font-black w-6 h-6 flex items-center justify-center" style={{ background: '#ede9fe', color: '#7c3aed', boxShadow: `inset 0 0 0 1px #c4b5fd, inset 0 -2px 0 ${alphaHex('#7c3aed', 0.2)}` }}>{activeEntry.n}{activeEntry.dir}</span>
                    <span className="text-[15px] font-extrabold leading-snug flex-1 line-clamp-2" style={{ color: 'var(--color-text)' }}>{activeEntry.clue}</span>
                    <ArrowLeftRight className="w-4 h-4 shrink-0" style={{ color: CROSSWORD_ACCENT }} />
                  </>)}
                </button>
                <button type="button" onClick={() => { playKeyTap(); setShowClues((v) => !v); }} className="shrink-0 w-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-black" style={{ background: softBackground(CROSSWORD_ACCENT, 0.13), border: softBorder(CROSSWORD_ACCENT, 0.13), boxShadow: `inset 0 4px 0 ${CROSSWORD_ACCENT}, 0 4px 10px ${alphaHex(CROSSWORD_ACCENT, 0.12)}`, color: CROSSWORD_ACCENT }} aria-pressed={showClues} aria-label={showClues ? 'Show the grid' : 'Show all clues'}>
                  {showClues ? <Grid3x3 className="w-4 h-4" /> : <ListOrdered className="w-4 h-4" />}
                  {showClues ? 'Grid' : 'Clues'}
                </button>
              </div>
            )}
            <div className="flex justify-center gap-1.5 px-1 flex-wrap" role="group" aria-label="Crossword controls">
              <button type="button" onClick={() => { haptic('light'); playKeyTap(); check(); }} className={capsule(false)} style={capsuleStyle(false)} aria-label="Check the filled letters">
                <CheckCheck className="w-3.5 h-3.5" /> Check<HintCountBadge count={state.checks} />
              </button>
              <button type="button" onClick={() => { playKeyTap(); revealLetter(); }} className={capsule(false)} style={capsuleStyle(false)} aria-label="Reveal the selected letter">
                <Lightbulb className="w-3.5 h-3.5" /> Letter
              </button>
              <button type="button" onClick={() => { playKeyTap(); revealWord(); }} className={capsule(false)} style={capsuleStyle(false)} aria-label="Reveal the active word">
                <Eye className="w-3.5 h-3.5" /> Word<HintCountBadge count={state.hintsUsed} />
              </button>
              <button type="button" onClick={revealPuzzle} className={capsule(false)} style={capsuleStyle(false, armReveal)} aria-label="Reveal the whole puzzle (records a loss)">
                <Flag className="w-3.5 h-3.5" /> <StableLabel value={armReveal ? 'Reveal all?' : 'Reveal all'} reserve={['Reveal all?']} />
              </button>
            </div>
            <Keyboard onKey={onKey} keyHeight={shortScreen ? 44 : undefined} />
          </div>
        </>
      ) : (
        // FINISH_SPEC R2: one screen — the result strip, the finished grid
        // scaled to the room left, then the dock. The clues and the score
        // breakdown sit under More.
        <>
          <PuzzleFinished
            strip={
              <ResultStrip won={won} guesses={state.checks} guessLabel={state.checks === 1 ? 'check' : 'checks'} time={formatTime(elapsedSeconds)} points={points}
                srText={`${won ? (state.checks === 0 ? 'Grid finished clean' : 'Grid finished') : 'Puzzle revealed'}. ${checksLabel} · ${formatTime(elapsedSeconds)}${state.hintsUsed ? ` · ${state.hintsUsed} hint${state.hintsUsed === 1 ? '' : 's'}` : ''}`} />
            }
            board={<div className="flex justify-center px-1 pb-1"><CrosswordBoard state={state} selected={null} activeCells={[]} onSelect={() => {}} finished /></div>}
            dock={
              <FinishedDock currentMode="CROSSWORD" isDaily={mode === 'daily'} onShare={handleShare} copied={copied}
                onNewPuzzle={mode !== 'daily' ? startPractice : undefined}
                extra={mode === 'daily' ? <DailyRankBadge gameMode="CROSSWORD" /> : undefined} />
            }
            more={
              <MoreDisclosure label="Clues & score" accent={CROSSWORD_ACCENT}>
                <div className="flex flex-col items-center gap-3">
                  <ClueColumns state={state} activeEntry={null} onPick={() => {}} finished />
                  <ScoreBreakdownCard gameMode="CROSSWORD" completed={won} guessCount={gc} timeSeconds={elapsedSeconds}
                    boardsSolved={won ? 1 : 0} totalBoards={CROSSWORD_TOTAL_BOARDS} hintsUsed={state.hintsUsed} day={mode === 'daily' ? getTodayLocal() : undefined} />
                </div>
              </MoreDisclosure>
            }
          />
          <BottomNav />
        </>
      )}
    </GameBackground>
  );
}
