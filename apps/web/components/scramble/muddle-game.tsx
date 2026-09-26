'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MORE_HOME_HREF } from '@/lib/more-games';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const VictoryAnimation = dynamic(() => import('@/components/effects/victory-animation').then(m => m.VictoryAnimation), { ssr: false });
const GameOverAnimation = dynamic(() => import('@/components/effects/game-over-animation').then(m => m.GameOverAnimation), { ssr: false });
import { Clock, Delete, XCircle } from 'lucide-react';
import {
  scramblePuzzleForDay, scramblePuzzleForSeed, scrambleDailyNumber, createScrambleState, scrambleReduce, scrambleMatchRow, scrambleGuessCount, scrambleBoardsSolved,
  scrambleActiveRow, scrambleFinalOpen, scrambleFinalLetters, SCRAMBLE_FINAL, SCRAMBLE_MAX_CHECKS, SCRAMBLE_TOTAL_BOARDS, generateDailySeed,
  type ScrambleState, type ScrambleAction, type ScrambleBank,
} from '@wordle-duel/core';
import scrambleBankJson from '@/data/scramble-puzzles.json';
import { HOLIDAY_TABLE, holidayTitle } from '@/lib/holidays';
import { GameHomeButton } from '@/components/game/game-home-button';
import { GameGuideButton } from '@/components/game/game-guide-button';
import { SoundToggle } from '@/components/game/sound-toggle';
import { Keyboard } from '@/components/game/keyboard';
import { CartoonPanel, WordRow, FinalRow, MUDDLE_ACCENT, COLUMN_CLASS } from './muddle-board';
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

// Muddle (More Games §5): unscramble four words; their circled letters spell
// the punchline that completes the caption under the cartoon. A full word
// checks itself (wrong = a mistake, letters go back); every check counts,
// thirteen lose. Hints (Letter 75, Solve 150) never count as checks.

const BANK = scrambleBankJson as unknown as ScrambleBank;

interface MuddleGameProps { isDaily?: boolean }

export function MuddleGame({ isDaily = false }: MuddleGameProps) {
  const { profile, isProActive } = useAuth();
  const isPro = isProActive;
  const mode: 'daily' | 'practice' = isDaily ? 'daily' : 'practice';

  const [state, setState] = useState<ScrambleState | null>(null);
  const [row, setRow] = useState<number>(0);
  const [shakeRow, setShakeRow] = useState<number | null>(null);
  const [showVictory, setShowVictory] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const restoredRef = useRef(false);
  const hasRecordedRef = useRef(false);

  const status = state?.status ?? 'playing';
  const { elapsedSeconds, reset: resetTimer } = useActivePlayTimer(!!state && status === 'playing', 0);

  const startPractice = useCallback(() => {
    const seed = `unlimited-SCRAMBLE-${Date.now()}`;
    const p = scramblePuzzleForSeed(BANK, seed);
    if (!p) return;
    const s = createScrambleState(p, seed, Date.now());
    setState(s); setRow(scrambleActiveRow(s) ?? 0);
    setShowVictory(false); setShowGameOver(false); setXpResult(null); setMessage('');
    resetTimer(0);
    restoredRef.current = false; hasRecordedRef.current = false;
  }, [resetTimer]);

  useEffect(() => {
    if (mode === 'daily') {
      const today = getTodayLocal();
      const seed = generateDailySeed(today, 'SCRAMBLE');
      const saved = loadDailySave(seed);
      if (saved) {
        setState(saved.state); setRow(scrambleActiveRow(saved.state) ?? 0); resetTimer(saved.elapsedSeconds);
        const done = saved.state.status !== 'playing';
        restoredRef.current = done; hasRecordedRef.current = done;
        return;
      }
      const p = scramblePuzzleForDay(BANK, today, HOLIDAY_TABLE);
      if (p) { const s = createScrambleState(p, seed, Date.now()); setState(s); setRow(0); }
      resetTimer(0);
      restoredRef.current = false;
    } else {
      const saved = loadPracticeSave();
      if (saved) {
        setState(saved.state); setRow(scrambleActiveRow(saved.state) ?? 0); resetTimer(saved.elapsedSeconds);
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

  const dispatch = useCallback((a: ScrambleAction) => {
    setState((s) => {
      if (!s) return s;
      const next = scrambleReduce(s, a, Date.now());
      if (next.lastRow !== null && next.lastRow !== s.lastRow || (next.checks !== s.checks)) {
        if (next.lastResult === 'wrong') { flash(next.lastRow === SCRAMBLE_FINAL ? 'Not the punchline' : 'Not that word'); haptic('medium'); playInvalid(); setShakeRow(next.lastRow); setTimeout(() => setShakeRow(null), 500); }
        else if (next.lastResult === 'correct') { playSuccess(); haptic('light'); }
      }
      // Follow the game: the active row moves to the next open word, then the punchline.
      const active = scrambleActiveRow(next);
      if (active !== null && (next.solved[a.type === 'FINISH' ? 0 : (a as { row?: number }).row ?? 0] || next.checks !== s.checks)) setRow(active);
      return next;
    });
  }, [flash]);

  const recordResult = useCallback(() => {
    if (!profile || !state || hasRecordedRef.current) return;
    if (state.status !== 'won' && state.status !== 'lost') return;
    hasRecordedRef.current = true;
    const won = state.status === 'won';
    const gc = scrambleGuessCount(state);
    const seed = mode === 'daily' ? state.seed : undefined;
    recordGameResult(profile.id, 'SCRAMBLE', 'solo', won, gc, elapsedSeconds * 1000, seed, scrambleBoardsSolved(state), SCRAMBLE_TOTAL_BOARDS, state.hintsUsed)
      .then((xp) => { if (xp) setXpResult(xp); });
    const r = scrambleMatchRow(state);
    recordSoloMatch({
      userId: profile.id, gameMode: 'SCRAMBLE', won, score: gc, timeSeconds: elapsedSeconds, seed: state.seed,
      solutions: r.solutions, guesses: r.guesses,
      startedAtIso: new Date(Date.now() - elapsedSeconds * 1000).toISOString(), hintsUsed: state.hintsUsed,
    });
  }, [profile, state, elapsedSeconds, mode]);

  useEffect(() => {
    if (!state || state.status === 'playing') return;
    if (!restoredRef.current) { if (state.status === 'won') { setShowVictory(true); } else setShowGameOver(true); }
    recordModePlayed('muddle');
    recordResult();
    restoredRef.current = false;
  }, [state?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (profile && state && state.status !== 'playing') recordResult(); }, [profile, recordResult, state]);

  const typeLetter = useCallback((letter: string) => {
    if (!state || state.status !== 'playing') return;
    if (row === SCRAMBLE_FINAL && !scrambleFinalOpen(state)) { flash('Solve the four words first'); return; }
    if (state.solved[row]) return;
    const before = state.entries[row];
    dispatch({ type: 'TYPE', row, letter });
    playKeyTap();
    void before;
  }, [state, row, dispatch, flash]);
  const onKey = useCallback((key: string) => {
    if (!state || state.status !== 'playing') return;
    if (key === 'ENTER') { const next = scrambleActiveRow(state); if (next !== null) setRow(next); return; }
    if (key === 'BACK') { dispatch({ type: 'BACK', row }); playKeyTap(); return; }
    if (/^[A-Z]$/.test(key)) typeLetter(key);
  }, [state, row, dispatch, typeLetter]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;
      if (!state || state.status !== 'playing') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); onKey('ENTER'); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setRow((r) => Math.min(SCRAMBLE_FINAL, r + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setRow((r) => Math.max(0, r - 1)); }
      else if (e.key === 'Backspace' || e.key === 'Delete') onKey('BACK');
      else if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key.toUpperCase());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state, onKey]);

  const won = state?.status === 'won';
  const gc = state ? scrambleGuessCount(state) : 5;
  const points = state ? computeScoreBreakdown('SCRAMBLE', won, gc, elapsedSeconds, scrambleBoardsSolved(state), SCRAMBLE_TOTAL_BOARDS, state.hintsUsed).total : 0;

  const handleShare = useCallback(async () => {
    if (!state) return;
    const out = await shareResult({
      layout: 'scramble', mode: 'Muddle', won, guesses: gc, maxGuesses: SCRAMBLE_MAX_CHECKS, timeSeconds: elapsedSeconds,
      words: state.words.map((w) => ({ length: w.answer.length, circled: w.circled })), pattern: state.final.pattern, checks: state.checks, solvedCount: scrambleBoardsSolved(state),
      puzzleNumber: mode === 'daily' ? scrambleDailyNumber(getTodayLocal()) : undefined, points,
    });
    if (out.via !== 'failed') { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }, [state, elapsedSeconds, mode, points, won, gc]);

  const formatTime = (s: number) => { const m = Math.floor(s / 60), sec = s % 60; return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`; };

  if (!state) return null;

  const finished = state.status !== 'playing';
  const puzzle = [...BANK.daily, ...BANK.extra, ...Object.values(BANK.holiday ?? {}).flat()].find((q) => q.id === state.id);
  const holiday = holidayTitle(puzzle?.holiday ?? null);
  const checksLabel = `${state.checks} check${state.checks === 1 ? '' : 's'}`;
  const captionParts = state.caption.split('____');
  // Compact rule (§5, founder 2026-09-23): 30px capsules; the ::before pseudo stretches the hit target to 44px without adding height.
  const capsule = (dim: boolean) => `relative flex items-center gap-1 text-xs font-bold px-3 h-[30px] rounded-full border transition-all before:content-[''] before:absolute before:-inset-y-[7px] before:inset-x-0 ${dim ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'hover:opacity-80'}`;
  const capsuleStyle = (dim: boolean) => dim ? undefined : { borderColor: `${MUDDLE_ACCENT}66`, color: MUDDLE_ACCENT, background: `${MUDDLE_ACCENT}0d` };

  return (
    <div className={`h-screen-stable flex flex-col relative ${finished ? 'pb-[calc(env(safe-area-inset-bottom)+64px)]' : ''}`} style={{ backgroundColor: 'var(--color-bg)' }}>
      {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} guesses={state.checks} guessLabel="Checks" timeSeconds={elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={state.checks} guessLabel="Checks" timeSeconds={elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} flawlessStreak={xpResult.flawlessStreak} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      <div className="text-center py-1.5 px-2 shrink-0 relative">
        <GameHomeButton accentColor={MUDDLE_ACCENT}  href={MORE_HOME_HREF} />
        <GameGuideButton slug="muddle" accentColor={MUDDLE_ACCENT} />
        <SoundToggle accentColor={MUDDLE_ACCENT} />
        <h1 className="text-xl font-black leading-7" style={{ color: MUDDLE_ACCENT }}>MUDDLE</h1>
        <div className="flex justify-center items-center gap-2 mt-0.5 text-[11px] leading-none font-bold" style={{ color: 'var(--color-text-muted)' }}>
          {mode === 'daily' && <span>#{scrambleDailyNumber(getTodayLocal())}</span>}
          {holiday && <span style={{ color: MUDDLE_ACCENT }}>{holiday}</span>}
          <span>{scrambleBoardsSolved(state)}/{SCRAMBLE_TOTAL_BOARDS} solved</span>
          <span>{checksLabel} · {SCRAMBLE_MAX_CHECKS - state.checks} left</span>
          <span><Clock className="w-3 h-3 inline mr-0.5" />{formatTime(elapsedSeconds)}</span>
        </div>
        {message && (
          <div className="absolute left-0 right-0 z-20 text-center" style={{ top: '60px' }}>
            <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-lg">{message}</span>
          </div>
        )}
      </div>

      {/* Compact rule (§5, founder 2026-09-23): one flex column — the cartoon
          flexes to the height left over (96px floor, 26vh cap), caption and
          words never shrink, and only this region scrolls on a short screen;
          the keyboard below is a fixed footer that never scrolls away. */}
      <div className={`flex-1 min-h-0 overflow-y-auto flex flex-col items-center px-3 pt-1 ${finished ? 'gap-2 pb-2' : ''}`}>
        <CartoonPanel src={puzzle?.cartoon ?? null} alt={puzzle?.altText ?? 'Cartoon'} fixed={finished} />
        <p className="shrink-0 text-center font-extrabold max-w-sm px-1 mt-1.5 line-clamp-2" style={{ fontSize: 14, lineHeight: 1.25, color: 'var(--color-text)' }}>
          {captionParts[0]}
          <span className="inline-block min-w-[3em] border-b-2 mx-1 align-baseline" style={{ borderColor: MUDDLE_ACCENT, color: '#5b21b6' }}>{finished || state.solved[SCRAMBLE_FINAL] ? state.final.answer.toLowerCase() : ' '}</span>
          {captionParts[1] ?? ''}
        </p>
        <div className={`${COLUMN_CLASS} flex flex-col shrink-0 mt-1.5`}>
          {state.words.map((_, i) => (
            <WordRow key={i} state={state} row={i} active={row === i} shaking={shakeRow === i} finished={finished}
              onSelect={(r) => setRow(r)} onTapTile={(r, ch) => { setRow(r); dispatch({ type: 'TYPE', row: r, letter: ch }); playKeyTap(); }}
              onRevealLetter={(r) => { dispatch({ type: 'REVEAL_LETTER', row: r }); haptic('light'); }} onSolveWord={(r) => { dispatch({ type: 'SOLVE_WORD', row: r }); haptic('light'); }} />
          ))}
          <FinalRow state={state} active={row === SCRAMBLE_FINAL} shaking={shakeRow === SCRAMBLE_FINAL} finished={finished}
            onSelect={() => setRow(SCRAMBLE_FINAL)} onTapTile={(ch) => { setRow(SCRAMBLE_FINAL); dispatch({ type: 'TYPE', row: SCRAMBLE_FINAL, letter: ch }); playKeyTap(); }}
            onRevealLetter={() => { dispatch({ type: 'REVEAL_LETTER', row: SCRAMBLE_FINAL }); haptic('light'); }} />
        </div>
        {finished && (
          <div className={`${COLUMN_CLASS} px-1 pb-2 animate-fade-in-up`}>
            <div className="flex items-center gap-3 rounded-xl p-3 bg-white border border-gray-100 shadow-sm">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-xl font-black" style={{ backgroundColor: `${MUDDLE_ACCENT}15`, border: `2px solid ${MUDDLE_ACCENT}44`, color: MUDDLE_ACCENT }}>
                {won ? state.checks : '✗'}
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <span className={`text-sm font-bold ${won ? 'text-green-600' : 'text-red-500'}`}>
                  {won ? (state.checks === 5 && state.hintsUsed === 0 ? 'Muddle solved clean' : 'Muddle solved') : 'Out of checks'}
                </span>
                <span className="text-xs text-gray-400">{`${scrambleBoardsSolved(state)}/${SCRAMBLE_TOTAL_BOARDS} solved · ${checksLabel} · ${formatTime(elapsedSeconds)}${state.hintsUsed ? ` · ${state.hintsUsed} hint${state.hintsUsed === 1 ? '' : 's'}` : ''}`}</span>
                <div className="flex items-center gap-3 mt-0.5">
                  <Link href={MORE_HOME_HREF} className="text-gray-400 text-xs font-bold underline">Home</Link>
                  <button onClick={handleShare} className="text-blue-500 text-xs font-bold underline">{copied ? 'Copied!' : 'Share'}</button>
                  {mode === 'daily' && <DailyRankBadge gameMode="SCRAMBLE" />}
                  {mode !== 'daily' && isPro && <button onClick={startPractice} className="text-xs font-bold underline" style={{ color: MUDDLE_ACCENT }}>Play Again</button>}
                </div>
              </div>
            </div>
            <ScoreBreakdownCard gameMode="SCRAMBLE" completed={won} guessCount={gc} timeSeconds={elapsedSeconds}
              boardsSolved={scrambleBoardsSolved(state)} totalBoards={SCRAMBLE_TOTAL_BOARDS} hintsUsed={state.hintsUsed} day={mode === 'daily' ? getTodayLocal() : undefined} />
            {mode === 'daily' && <NextDailyCta currentMode="SCRAMBLE" />}
          </div>
        )}
      </div>

      {!finished ? (
        <div className="shrink-0 pb-1.5 px-2 pt-1 flex flex-col gap-1.5">
          <div className="flex justify-center gap-2 px-1" role="group" aria-label="Muddle controls">
            <button type="button" onClick={() => { dispatch({ type: 'BACK', row }); playKeyTap(); }} className={capsule(false)} style={capsuleStyle(false)} aria-label="Delete the last letter">
              <Delete className="w-3.5 h-3.5" /> Delete
            </button>
            <button type="button" onClick={() => { dispatch({ type: 'CLEAR', row }); playKeyTap(); }} className={capsule(false)} style={capsuleStyle(false)} aria-label="Clear the active word">
              <XCircle className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
          <Keyboard onKey={onKey} />
        </div>
      ) : <BottomNav />}
      {finished && void scrambleFinalLetters}
    </div>
  );
}
