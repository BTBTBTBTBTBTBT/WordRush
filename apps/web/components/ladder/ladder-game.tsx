'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const VictoryAnimation = dynamic(() => import('@/components/effects/victory-animation').then(m => m.VictoryAnimation), { ssr: false });
const GameOverAnimation = dynamic(() => import('@/components/effects/game-over-animation').then(m => m.GameOverAnimation), { ssr: false });
import { Clock, Undo2, Lightbulb } from 'lucide-react';
import {
  ladderPuzzleForDay, ladderPuzzleForSeed, ladderDailyNumber, createLadderState, ladderReduce, ladderMatchRow, ladderGuessCount, ladderMaxMoves,
  generateDailySeed, getAllowedWordsForLength, type LadderState, type LadderAction, type LadderBank, type LadderReject,
} from '@wordle-duel/core';
import ladderBankJson from '@/data/ladder-puzzles.json';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';
import { GameHomeButton } from '@/components/game/game-home-button';
import { GameGuideButton } from '@/components/game/game-guide-button';
import { SoundToggle } from '@/components/game/sound-toggle';
import { Keyboard } from '@/components/game/keyboard';
import { LadderBoard, LADDER_ACCENT } from './ladder-board';
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
import { playInvalid, playKeyTap } from '@/lib/sounds';
import { haptic } from '@/lib/haptics';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { NextDailyCta } from '@/components/game/next-daily-cta';
import { formatGuessStat } from '@/lib/format';
import { computeScoreBreakdown } from '@/lib/composite-scoring';

// Letter Ladder (More Games §15): change one letter at a time from START to
// END. Rejected entries are free; every accepted word is a move; the budget
// is par + 5; Undo is free but spent moves stay spent; Hint places the next
// rung on a shortest path and counts as a move. guess_count = moves − par + 1.

const BANK = ladderBankJson as LadderBank;
const REJECT_COPY: Record<LadderReject, string> = {
  finished: 'This ladder is finished',
  length: 'Five letters, please',
  'not-one-letter': 'Change exactly one letter',
  revisit: 'Already on the ladder',
  'not-word': 'Not in word list',
};

interface LadderGameProps {
  /** /letter-ladder?daily=true → today's ladder, recorded to daily_results. */
  isDaily?: boolean;
}

export function LadderGame({ isDaily = false }: LadderGameProps) {
  const { profile, isProActive } = useAuth();
  const isPro = isProActive;
  const mode: 'daily' | 'practice' = isDaily ? 'daily' : 'practice';

  const [state, setState] = useState<LadderState | null>(null);
  const [typing, setTyping] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const restoredRef = useRef(false);
  const hasRecordedRef = useRef(false);

  // The engine's dictionary: the 5-letter allowed list, uppercased once.
  const allowed = useMemo(() => { ensureDictionaryInitialized(); return new Set(getAllowedWordsForLength(5).map((w) => w.toUpperCase())); }, []);

  const status = state?.status ?? 'playing';
  const { elapsedSeconds, reset: resetTimer } = useActivePlayTimer(!!state && status === 'playing', 0);

  const startPractice = useCallback(() => {
    const seed = `unlimited-LADDER-${Date.now()}`;
    const p = ladderPuzzleForSeed(BANK, seed);
    if (!p) return;
    setState(createLadderState(p, seed, Date.now()));
    setTyping(''); setShowVictory(false); setShowGameOver(false); setXpResult(null); setMessage('');
    resetTimer(0);
    restoredRef.current = false;
    hasRecordedRef.current = false;
  }, [resetTimer]);

  useEffect(() => {
    if (mode === 'daily') {
      const today = getTodayLocal();
      const seed = generateDailySeed(today, 'LADDER');
      const saved = loadDailySave(seed);
      if (saved) {
        setState(saved.state); resetTimer(saved.elapsedSeconds);
        const done = saved.state.status !== 'playing';
        restoredRef.current = done; hasRecordedRef.current = done;
        return;
      }
      const p = ladderPuzzleForDay(BANK, today);
      if (p) setState(createLadderState(p, seed, Date.now()));
      resetTimer(0);
      restoredRef.current = false;
    } else {
      const saved = loadPracticeSave();
      if (saved) {
        setState(saved.state); resetTimer(saved.elapsedSeconds);
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

  const dispatch = useCallback((a: LadderAction) => {
    setState((s) => {
      if (!s) return s;
      const next = ladderReduce(s, a, allowed, Date.now());
      if (a.type === 'SUBMIT') {
        if (next.reject) {
          flash(REJECT_COPY[next.reject]); haptic('medium'); playInvalid();
          setInvalid(true); setShaking(true); setTimeout(() => { setInvalid(false); setShaking(false); setTyping(''); }, 500);
        } else { setTyping(''); playKeyTap(); }
      } else if (a.type === 'HINT' && next.words.length > s.words.length) { setTyping(''); }
      return next;
    });
  }, [allowed, flash]);

  const recordResult = useCallback(() => {
    if (!profile || !state || hasRecordedRef.current) return;
    if (state.status !== 'won' && state.status !== 'lost') return;
    hasRecordedRef.current = true;
    const won = state.status === 'won';
    const gc = ladderGuessCount(state);
    const seed = mode === 'daily' ? state.seed : undefined;
    recordGameResult(profile.id, 'LADDER', 'solo', won, gc, elapsedSeconds * 1000, seed, won ? 1 : 0, 1, state.hintsUsed)
      .then((xp) => { if (xp) setXpResult(xp); });
    const row = ladderMatchRow(state);
    recordSoloMatch({
      userId: profile.id, gameMode: 'LADDER', won, score: gc, timeSeconds: elapsedSeconds, seed: state.seed,
      solutions: row.solutions, guesses: row.guesses,
      startedAtIso: new Date(Date.now() - elapsedSeconds * 1000).toISOString(), hintsUsed: state.hintsUsed,
    });
  }, [profile, state, elapsedSeconds, mode]);

  useEffect(() => {
    if (!state || state.status === 'playing') return;
    if (!restoredRef.current) { if (state.status === 'won') setShowVictory(true); else setShowGameOver(true); }
    recordModePlayed('letter-ladder');
    recordResult();
    restoredRef.current = false;
  }, [state?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (profile && state && state.status !== 'playing') recordResult(); }, [profile, recordResult, state]);

  const onKey = useCallback((key: string) => {
    if (!state || state.status !== 'playing') return;
    if (key === 'ENTER') { if (typing.length === 5) dispatch({ type: 'SUBMIT', word: typing }); else flash('Five letters, please'); return; }
    if (key === 'BACK') { setTyping((t) => t.slice(0, -1)); return; }
    if (/^[A-Z]$/.test(key) && typing.length < 5) setTyping((t) => t + key);
  }, [state, typing, dispatch, flash]);
  const undo = useCallback(() => { dispatch({ type: 'UNDO' }); setTyping(''); }, [dispatch]);
  const hint = useCallback(() => dispatch({ type: 'HINT' }), [dispatch]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;
      if (!state || state.status !== 'playing') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') onKey('ENTER');
      else if (e.key === 'Backspace') onKey('BACK');
      else if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key.toUpperCase());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state, onKey, undo]);

  const points = state ? computeScoreBreakdown('LADDER', state.status === 'won', ladderGuessCount(state), elapsedSeconds, state.status === 'won' ? 1 : 0, 1, state.hintsUsed).total : 0;

  const handleShare = useCallback(async () => {
    if (!state) return;
    const out = await shareResult({
      layout: 'ladder', mode: 'Letter Ladder', won: state.status === 'won',
      guesses: ladderGuessCount(state), maxGuesses: 6, timeSeconds: elapsedSeconds,
      start: state.start, end: state.end, words: state.words, hintMask: state.hintMask, par: state.par, moves: state.moves,
      puzzleNumber: mode === 'daily' ? ladderDailyNumber(getTodayLocal()) : undefined, points,
    });
    if (out.via !== 'failed') { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }, [state, elapsedSeconds, mode, points]);

  const formatTime = (s: number) => { const m = Math.floor(s / 60), sec = s % 60; return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`; };

  if (!state) return null;

  const finished = state.status !== 'playing';
  const won = state.status === 'won';
  const gc = ladderGuessCount(state);
  const parLabel = formatGuessStat('overPar', 1, gc);
  const movesLeft = Math.max(0, ladderMaxMoves(state) - state.moves);
  const capsule = (dim: boolean) => `flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${dim ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'hover:opacity-80'}`;
  const capsuleStyle = (dim: boolean) => dim ? undefined : { borderColor: `${LADDER_ACCENT}66`, color: LADDER_ACCENT, background: `${LADDER_ACCENT}0d` };

  return (
    <div className={`h-screen-stable flex flex-col relative ${finished ? 'pb-[calc(env(safe-area-inset-bottom)+64px)]' : ''}`} style={{ backgroundColor: 'var(--color-bg)' }}>
      {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} guesses={state.moves} guessLabel="Moves" timeSeconds={elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={state.moves} guessLabel="Moves" timeSeconds={elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} flawlessStreak={xpResult.flawlessStreak} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      <div className="text-center py-2 px-2 shrink-0 relative">
        <GameHomeButton accentColor={LADDER_ACCENT} />
        <GameGuideButton slug="letter-ladder" accentColor={LADDER_ACCENT} />
        <SoundToggle accentColor={LADDER_ACCENT} />
        <h1 className="text-2xl font-black" style={{ color: LADDER_ACCENT }}>LETTER LADDER</h1>
        <div className="flex justify-center items-center gap-2 mt-1 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
          {mode === 'daily' && <span>#{ladderDailyNumber(getTodayLocal())}</span>}
          <span>Par {state.par}</span>
          <span>{state.moves} move{state.moves === 1 ? '' : 's'} · {movesLeft} left</span>
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
          <div className="flex-1 min-h-0 overflow-y-auto flex items-start justify-center px-3 pb-1 pt-1">
            <LadderBoard state={state} typing={typing} invalid={invalid} shaking={shaking} revealPath={false} />
          </div>
          <div className="shrink-0 pb-2 px-2 pt-1 flex flex-col gap-2">
            <div className="flex justify-center gap-2 px-1" role="group" aria-label="Ladder controls">
              <button type="button" onClick={() => { haptic('light'); playKeyTap(); undo(); }} disabled={state.words.length <= 1} className={capsule(state.words.length <= 1)} style={capsuleStyle(state.words.length <= 1)} aria-label="Undo">
                <Undo2 className="w-3.5 h-3.5" /> Undo
              </button>
              <button type="button" onClick={() => { haptic('light'); playKeyTap(); hint(); }} className={capsule(false)} style={capsuleStyle(false)} aria-label="Hint">
                <Lightbulb className="w-3.5 h-3.5" /> Hint{state.hintsUsed > 0 ? ` · ${state.hintsUsed}` : ''}
              </button>
            </div>
            <Keyboard onKey={onKey} />
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex items-center justify-center px-3 py-2">
              <LadderBoard state={state} typing="" invalid={false} shaking={false} revealPath={!won} />
            </div>
            <div className="px-4 pb-4 animate-fade-in-up">
              <div className="flex items-center gap-3 rounded-xl p-3 bg-white border border-gray-100 shadow-sm">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-xl font-black"
                  style={{ backgroundColor: `${LADDER_ACCENT}15`, border: `2px solid ${LADDER_ACCENT}44`, color: LADDER_ACCENT }}>
                  {won ? parLabel : '✗'}
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className={`text-sm font-bold ${won ? 'text-green-600' : 'text-red-500'}`}>
                    {won ? (gc === 1 ? 'Ladder climbed on par' : 'Ladder climbed') : 'Out of moves'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {won
                      ? `${state.moves} move${state.moves === 1 ? '' : 's'} · Par ${state.par} · ${formatTime(elapsedSeconds)}${state.hintsUsed ? ` · ${state.hintsUsed} hint${state.hintsUsed === 1 ? '' : 's'}` : ''}`
                      : `${state.moves} moves · Par ${state.par} · ${formatTime(elapsedSeconds)}`}
                  </span>
                  <div className="flex items-center gap-3 mt-0.5">
                    <Link href="/" className="text-gray-400 text-xs font-bold underline">Home</Link>
                    <button onClick={handleShare} className="text-blue-500 text-xs font-bold underline">{copied ? 'Copied!' : 'Share'}</button>
                    {mode === 'daily' && <DailyRankBadge gameMode="LADDER" />}
                    {mode !== 'daily' && isPro && <button onClick={startPractice} className="text-xs font-bold underline" style={{ color: LADDER_ACCENT }}>Play Again</button>}
                  </div>
                </div>
              </div>
              <ScoreBreakdownCard gameMode="LADDER" completed={won} guessCount={gc} timeSeconds={elapsedSeconds}
                boardsSolved={won ? 1 : 0} totalBoards={1} hintsUsed={state.hintsUsed} day={mode === 'daily' ? getTodayLocal() : undefined} />
              {mode === 'daily' && <NextDailyCta currentMode="LADDER" />}
            </div>
          </div>
          <BottomNav />
        </>
      )}
    </div>
  );
}
