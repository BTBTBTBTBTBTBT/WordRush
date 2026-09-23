'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const VictoryAnimation = dynamic(() => import('@/components/effects/victory-animation').then(m => m.VictoryAnimation), { ssr: false });
const GameOverAnimation = dynamic(() => import('@/components/effects/game-over-animation').then(m => m.GameOverAnimation), { ssr: false });
import { Clock, CheckCheck, Lightbulb, Eye, Flag, ArrowLeftRight } from 'lucide-react';
import {
  crosswordPuzzleForDay, crosswordPuzzleForSeed, crosswordDailyNumber, createCrosswordState, crosswordReduce, crosswordMatchRow, crosswordGuessCount,
  crosswordEntryCells, crosswordEntriesAt, crosswordEntrySolved, crosswordCorrectCount, crosswordLetterCount, CROSSWORD_BLOCK, CROSSWORD_EMPTY, CROSSWORD_TOTAL_BOARDS,
  generateDailySeed, type CrosswordState, type CrosswordAction, type CrosswordBank, type CrosswordEntry, type CrosswordDir,
} from '@wordle-duel/core';
import crosswordBankJson from '@/data/crossword-puzzles.json';
import { HOLIDAY_TABLE, holidayTitle } from '@/lib/holidays';
import { GameHomeButton } from '@/components/game/game-home-button';
import { GameGuideButton } from '@/components/game/game-guide-button';
import { SoundToggle } from '@/components/game/sound-toggle';
import { Keyboard } from '@/components/game/keyboard';
import { CrosswordBoard, ClueColumns, CROSSWORD_ACCENT } from './crossword-board';
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
import { playInvalid, playKeyTap, playSuccess } from '@/lib/sounds';
import { haptic } from '@/lib/haptics';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { NextDailyCta } from '@/components/game/next-daily-cta';
import { computeScoreBreakdown } from '@/lib/composite-scoring';

// Crosswordocious (More Games §13): a themed fill-in sayings crossword. Tap a
// cell or a clue, type; letters are free to set and clear. Check locks right
// letters, clears wrong ones and counts (guess_count = min(checks, 98) + 1).
// Reveal letter (1 hint) / word (2). "Reveal puzzle" is the only loss. The
// grid completes itself when every cell is right.

const BANK = crosswordBankJson as unknown as CrosswordBank;

interface CrosswordGameProps { isDaily?: boolean }

export function CrosswordGame({ isDaily = false }: CrosswordGameProps) {
  const { profile, isProActive } = useAuth();
  const isPro = isProActive;
  const mode: 'daily' | 'practice' = isDaily ? 'daily' : 'practice';

  const [state, setState] = useState<CrosswordState | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [dir, setDir] = useState<CrosswordDir>('A');
  const [armReveal, setArmReveal] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const restoredRef = useRef(false);
  const hasRecordedRef = useRef(false);

  const status = state?.status ?? 'playing';
  const { elapsedSeconds, reset: resetTimer } = useActivePlayTimer(!!state && status === 'playing', 0);

  const firstOpenCell = (s: CrosswordState): number => { const e = s.entries[0]; const cells = crosswordEntryCells(s, e); return cells.find((i) => s.fill[i] === CROSSWORD_EMPTY) ?? cells[0]; };

  const startPractice = useCallback(() => {
    const seed = `unlimited-CROSSWORD-${Date.now()}`;
    const p = crosswordPuzzleForSeed(BANK, seed);
    if (!p) return;
    const s = createCrosswordState(p, seed, Date.now());
    setState(s); setSelected(firstOpenCell(s)); setDir(s.entries[0].dir);
    setShowVictory(false); setShowGameOver(false); setXpResult(null); setMessage(''); setArmReveal(false);
    resetTimer(0);
    restoredRef.current = false; hasRecordedRef.current = false;
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
      const p = crosswordPuzzleForDay(BANK, today, HOLIDAY_TABLE);
      if (p) { const s = createCrosswordState(p, seed, Date.now()); setState(s); setSelected(firstOpenCell(s)); setDir(s.entries[0].dir); }
      resetTimer(0);
      restoredRef.current = false;
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

  useEffect(() => {
    if (!state) return;
    if (mode === 'daily') saveDaily(state.seed, state, elapsedSeconds);
    else savePractice(state.seed, state, elapsedSeconds);
  }, [state, elapsedSeconds, mode]);

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
    if (!profile || !state || hasRecordedRef.current) return;
    if (state.status !== 'won' && state.status !== 'lost') return;
    hasRecordedRef.current = true;
    const won = state.status === 'won';
    const gc = crosswordGuessCount(state.checks);
    const seed = mode === 'daily' ? state.seed : undefined;
    recordGameResult(profile.id, 'CROSSWORD', 'solo', won, gc, elapsedSeconds * 1000, seed, won ? 1 : 0, CROSSWORD_TOTAL_BOARDS, state.hintsUsed)
      .then((xp) => { if (xp) setXpResult(xp); });
    const row = crosswordMatchRow(state);
    recordSoloMatch({
      userId: profile.id, gameMode: 'CROSSWORD', won, score: gc, timeSeconds: elapsedSeconds, seed: state.seed,
      solutions: row.solutions, guesses: row.guesses,
      startedAtIso: new Date(Date.now() - elapsedSeconds * 1000).toISOString(), hintsUsed: state.hintsUsed,
    });
  }, [profile, state, elapsedSeconds, mode]);

  useEffect(() => {
    if (!state || state.status === 'playing') return;
    if (!restoredRef.current) { if (state.status === 'won') { setShowVictory(true); playSuccess(); } else setShowGameOver(true); }
    recordModePlayed('crosswordocious');
    recordResult();
    restoredRef.current = false;
  }, [state?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (profile && state && state.status !== 'playing') recordResult(); }, [profile, recordResult, state]);

  // ── Selection ──────────────────────────────────────────────────────────
  const activeEntry: CrosswordEntry | null = useMemo(() => {
    if (!state || selected === null) return null;
    const here = crosswordEntriesAt(state, selected);
    return here.find((e) => e.dir === dir) ?? here[0] ?? null;
  }, [state, selected, dir]);
  const activeCells = useMemo(() => (state && activeEntry ? crosswordEntryCells(state, activeEntry) : []), [state, activeEntry]);

  const selectCell = useCallback((cell: number) => {
    if (!state || state.solution[cell] === CROSSWORD_BLOCK) return;
    playKeyTap();
    if (cell === selected) {
      const here = crosswordEntriesAt(state, cell);
      if (here.length > 1) setDir((d) => (d === 'A' ? 'D' : 'A'));
      return;
    }
    const here = crosswordEntriesAt(state, cell);
    if (here.length && !here.some((e) => e.dir === dir)) setDir(here[0].dir);
    setSelected(cell);
  }, [state, selected, dir]);
  const pickEntry = useCallback((e: CrosswordEntry) => {
    if (!state) return;
    const cells = crosswordEntryCells(state, e);
    setDir(e.dir); setSelected(cells.find((i) => state.fill[i] === CROSSWORD_EMPTY) ?? cells[0]);
  }, [state]);
  /** After typing: next empty cell in the active entry, else the next entry's first empty cell. */
  const advance = useCallback((s: CrosswordState, from: number, entry: CrosswordEntry | null) => {
    if (!entry) return;
    const cells = crosswordEntryCells(s, entry);
    const k = cells.indexOf(from);
    const nextIn = cells.slice(k + 1).find((i) => s.fill[i] === CROSSWORD_EMPTY || s.locked[i] === '0');
    if (nextIn !== undefined) { setSelected(nextIn); return; }
    const order = s.entries;
    const idx = order.findIndex((e) => e.n === entry.n && e.dir === entry.dir);
    for (let step = 1; step <= order.length; step++) {
      const e = order[(idx + step) % order.length];
      if (crosswordEntrySolved(s, e)) continue;
      const ec = crosswordEntryCells(s, e);
      setDir(e.dir); setSelected(ec.find((i) => s.fill[i] === CROSSWORD_EMPTY) ?? ec[0]); return;
    }
  }, []);

  const onKey = useCallback((key: string) => {
    if (!state || state.status !== 'playing' || selected === null) return;
    if (key === 'ENTER') { if (activeEntry) advance(state, activeCells[activeCells.length - 1], activeEntry); return; }
    if (key === 'BACK') {
      if (state.fill[selected] !== CROSSWORD_EMPTY && state.locked[selected] === '0') { dispatch({ type: 'CLEAR', cell: selected }); playKeyTap(); return; }
      const k = activeCells.indexOf(selected);
      if (k > 0) { const prev = activeCells[k - 1]; setSelected(prev); if (state.locked[prev] === '0') dispatch({ type: 'CLEAR', cell: prev }); }
      return;
    }
    if (/^[A-Z]$/.test(key)) {
      if (state.locked[selected] === '1') { flash('That letter is locked'); return; }
      dispatch({ type: 'SET', cell: selected, letter: key }); playKeyTap();
      advance({ ...state, fill: state.fill.slice(0, selected) + key + state.fill.slice(selected + 1) }, selected, activeEntry);
    }
  }, [state, selected, activeEntry, activeCells, dispatch, advance, flash]);

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
      else if (e.key === ' ') { e.preventDefault(); setDir((d) => (d === 'A' ? 'D' : 'A')); }
      else if (e.key === 'Backspace' || e.key === 'Delete') onKey('BACK');
      else if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key.toUpperCase());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state, selected, onKey]);

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

  if (!state) return null;

  const finished = state.status !== 'playing';
  const holiday = holidayTitle((BANK.holiday && Object.keys(BANK.holiday).find((k) => BANK.holiday![k].some((q) => q.id === state.id))) ?? null);
  const checksLabel = state.checks === 0 ? 'No checks' : `${state.checks} check${state.checks === 1 ? '' : 's'}`;
  const filled = crosswordCorrectCount(state), total = crosswordLetterCount(state);
  const capsule = (dim: boolean) => `flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-full border transition-all ${dim ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'hover:opacity-80'}`;
  const capsuleStyle = (dim: boolean, danger = false) => dim ? undefined : danger ? { borderColor: '#dc262666', color: '#dc2626', background: '#dc26260d' } : { borderColor: `${CROSSWORD_ACCENT}66`, color: CROSSWORD_ACCENT, background: `${CROSSWORD_ACCENT}0d` };

  return (
    <div className={`h-screen-stable flex flex-col relative ${finished ? 'pb-[calc(env(safe-area-inset-bottom)+64px)]' : ''}`} style={{ backgroundColor: 'var(--color-bg)' }}>
      {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} guesses={state.checks} guessLabel="Checks" timeSeconds={elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={state.checks} guessLabel="Checks" timeSeconds={elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} flawlessStreak={xpResult.flawlessStreak} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      <div className="text-center py-2 px-2 shrink-0 relative">
        <GameHomeButton accentColor={CROSSWORD_ACCENT} />
        <GameGuideButton slug="crosswordocious" accentColor={CROSSWORD_ACCENT} />
        <SoundToggle accentColor={CROSSWORD_ACCENT} />
        <h1 className="font-black whitespace-nowrap px-12" style={{ color: CROSSWORD_ACCENT, fontSize: 'clamp(17px, 5.6vw, 24px)' }}>CROSSWORDOCIOUS</h1>
        <div className="text-sm font-black mt-0.5" style={{ color: 'var(--color-text)' }}>{state.title}</div>
        <div className="flex justify-center items-center gap-2 mt-0.5 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
          {mode === 'daily' && <span>#{crosswordDailyNumber(getTodayLocal())}</span>}
          {holiday && <span style={{ color: CROSSWORD_ACCENT }}>{holiday}</span>}
          <span>{filled}/{total} letters</span>
          <span>{checksLabel}</span>
          <span><Clock className="w-3 h-3 inline mr-0.5" />{formatTime(elapsedSeconds)}</span>
        </div>
        {message && (
          <div className="absolute left-0 right-0 z-20 text-center" style={{ top: '104px' }}>
            <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-lg">{message}</span>
          </div>
        )}
      </div>

      {!finished ? (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-3 px-3 pb-1 pt-1">
            <CrosswordBoard state={state} selected={selected} activeCells={activeCells} onSelect={selectCell} finished={false} />
            <ClueColumns state={state} activeEntry={activeEntry} onPick={pickEntry} finished={false} />
          </div>
          <div className="shrink-0 pb-2 px-2 pt-1 flex flex-col gap-2">
            {activeEntry && (
              <button type="button" onClick={() => setDir((d) => (d === 'A' ? 'D' : 'A'))} className="mx-auto max-w-[700px] w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left" style={{ background: `${CROSSWORD_ACCENT}12`, border: `1.5px solid ${CROSSWORD_ACCENT}44` }} aria-label="Active clue; tap to switch direction">
                <span className="shrink-0 rounded text-[11px] font-black w-6 h-6 flex items-center justify-center" style={{ background: '#ede9fe', color: '#7c3aed', border: '1px solid #c4b5fd' }}>{activeEntry.n}{activeEntry.dir}</span>
                <span className="text-[15px] font-extrabold leading-snug flex-1" style={{ color: 'var(--color-text)' }}>{activeEntry.clue}</span>
                <ArrowLeftRight className="w-4 h-4 shrink-0" style={{ color: CROSSWORD_ACCENT }} />
              </button>
            )}
            <div className="flex justify-center gap-1.5 px-1 flex-wrap" role="group" aria-label="Crossword controls">
              <button type="button" onClick={() => { haptic('light'); playKeyTap(); check(); }} className={capsule(false)} style={capsuleStyle(false)} aria-label="Check the filled letters">
                <CheckCheck className="w-3.5 h-3.5" /> Check{state.checks > 0 ? ` · ${state.checks}` : ''}
              </button>
              <button type="button" onClick={() => { playKeyTap(); revealLetter(); }} className={capsule(false)} style={capsuleStyle(false)} aria-label="Reveal the selected letter">
                <Lightbulb className="w-3.5 h-3.5" /> Letter
              </button>
              <button type="button" onClick={() => { playKeyTap(); revealWord(); }} className={capsule(false)} style={capsuleStyle(false)} aria-label="Reveal the active word">
                <Eye className="w-3.5 h-3.5" /> Word{state.hintsUsed > 0 ? ` · ${state.hintsUsed}` : ''}
              </button>
              <button type="button" onClick={revealPuzzle} className={capsule(false)} style={capsuleStyle(false, armReveal)} aria-label="Reveal the whole puzzle (records a loss)">
                <Flag className="w-3.5 h-3.5" /> {armReveal ? 'Reveal all?' : 'Reveal all'}
              </button>
            </div>
            <Keyboard onKey={onKey} />
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-col items-center gap-3 px-3 py-3">
              <CrosswordBoard state={state} selected={null} activeCells={[]} onSelect={() => {}} finished />
              <ClueColumns state={state} activeEntry={null} onPick={() => {}} finished />
            </div>
            <div className="px-4 pb-4 animate-fade-in-up">
              <div className="flex items-center gap-3 rounded-xl p-3 bg-white border border-gray-100 shadow-sm">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-xl font-black"
                  style={{ backgroundColor: `${CROSSWORD_ACCENT}15`, border: `2px solid ${CROSSWORD_ACCENT}44`, color: CROSSWORD_ACCENT }}>
                  {won ? (state.checks === 0 ? '✓' : state.checks) : '✗'}
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className={`text-sm font-bold ${won ? 'text-green-600' : 'text-red-500'}`}>
                    {won ? (state.checks === 0 ? 'Grid finished clean' : 'Grid finished') : 'Puzzle revealed'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {`${checksLabel} · ${formatTime(elapsedSeconds)}${state.hintsUsed ? ` · ${state.hintsUsed} hint${state.hintsUsed === 1 ? '' : 's'}` : ''}`}
                  </span>
                  <div className="flex items-center gap-3 mt-0.5">
                    <Link href="/" className="text-gray-400 text-xs font-bold underline">Home</Link>
                    <button onClick={handleShare} className="text-blue-500 text-xs font-bold underline">{copied ? 'Copied!' : 'Share'}</button>
                    {mode === 'daily' && <DailyRankBadge gameMode="CROSSWORD" />}
                    {mode !== 'daily' && isPro && <button onClick={startPractice} className="text-xs font-bold underline" style={{ color: CROSSWORD_ACCENT }}>Play Again</button>}
                  </div>
                </div>
              </div>
              <ScoreBreakdownCard gameMode="CROSSWORD" completed={won} guessCount={gc} timeSeconds={elapsedSeconds}
                boardsSolved={won ? 1 : 0} totalBoards={CROSSWORD_TOTAL_BOARDS} hintsUsed={state.hintsUsed} day={mode === 'daily' ? getTodayLocal() : undefined} />
              {mode === 'daily' && <NextDailyCta currentMode="CROSSWORD" />}
            </div>
          </div>
          <BottomNav />
        </>
      )}
    </div>
  );
}
