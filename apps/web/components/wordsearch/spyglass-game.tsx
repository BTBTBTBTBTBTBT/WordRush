'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const VictoryAnimation = dynamic(() => import('@/components/effects/victory-animation').then(m => m.VictoryAnimation), { ssr: false });
const GameOverAnimation = dynamic(() => import('@/components/effects/game-over-animation').then(m => m.GameOverAnimation), { ssr: false });
import { Clock, Lightbulb, Eye } from 'lucide-react';
import {
  wordsearchPuzzleForDay, wordsearchPuzzleForSeed, wordsearchDailyNumber, createWordsearchState, wordsearchReduce, wordsearchMatchRow, wordsearchGuessCount,
  generateDailySeed, type WordsearchState, type WordsearchAction, type WordsearchBank,
} from '@wordle-duel/core';
import wordsearchBankJson from '@/data/wordsearch-puzzles.json';
import { GameHomeButton } from '@/components/game/game-home-button';
import { GameGuideButton } from '@/components/game/game-guide-button';
import { SoundToggle } from '@/components/game/sound-toggle';
import { SpyglassGrid, WORDSEARCH_ACCENT } from './spyglass-grid';
import { loadDailySave, saveDaily, loadPracticeSave, savePractice } from './persistence';
import { recordModePlayed } from '@/lib/play-limit-service';
import { shareResult } from '@/lib/share-utils';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult, recordSoloMatch, type XpResult } from '@/lib/stats-service';
import { XpToast } from '@/components/effects/xp-toast';
import { DailyRankBadge } from '@/components/game/daily-rank-badge';
import { getTodayLocal } from '@/lib/daily-service';
import { useActivePlayTimer } from '@/hooks/use-active-play-timer';
import { playInvalid, playKeyTap, playSuccess } from '@/lib/sounds';
import { haptic } from '@/lib/haptics';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { NextDailyCta } from '@/components/game/next-daily-cta';
import { formatGuessStat } from '@/lib/format';
import { computeScoreBreakdown } from '@/lib/composite-scoring';

// Spyglass (More Games §17): ten themed words hidden in a 10 × 10 grid, four
// forward directions in the daily. Tap-start / tap-end or drag to select; a
// straight line of four or more letters that spells no list word is a miss.
// Hint pulses a first letter (score cost, never a miss). Reveal (after five
// minutes) records a loss with what was found. guess_count = min(10+misses, 15).

const BANK = wordsearchBankJson as WordsearchBank;
const REVEAL_AFTER_SECONDS = 300;

interface SpyglassGameProps {
  /** /spyglass?daily=true → today's grid, recorded to daily_results. */
  isDaily?: boolean;
}

export function SpyglassGame({ isDaily = false }: SpyglassGameProps) {
  const { profile, isProActive } = useAuth();
  const isPro = isProActive;
  const mode: 'daily' | 'practice' = isDaily ? 'daily' : 'practice';

  const [state, setState] = useState<WordsearchState | null>(null);
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
    const seed = `unlimited-WORDSEARCH-${Date.now()}`;
    const p = wordsearchPuzzleForSeed(BANK, seed);
    if (!p) return;
    setState(createWordsearchState(p, seed, Date.now()));
    setShowVictory(false); setShowGameOver(false); setXpResult(null); setMessage('');
    resetTimer(0);
    restoredRef.current = false;
    hasRecordedRef.current = false;
  }, [resetTimer]);

  useEffect(() => {
    if (mode === 'daily') {
      const today = getTodayLocal();
      const seed = generateDailySeed(today, 'WORDSEARCH');
      const saved = loadDailySave(seed);
      if (saved) {
        setState(saved.state); resetTimer(saved.elapsedSeconds);
        const done = saved.state.status !== 'playing';
        restoredRef.current = done; hasRecordedRef.current = done;
        return;
      }
      const p = wordsearchPuzzleForDay(BANK, today);
      if (p) setState(createWordsearchState(p, seed, Date.now()));
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

  const dispatch = useCallback((a: WordsearchAction) => {
    setState((s) => {
      if (!s) return s;
      const next = wordsearchReduce(s, a, Date.now());
      if (a.type === 'SELECT') {
        if (next.found.length > s.found.length) { haptic('light'); playSuccess(); }
        else if (next.misses > s.misses) { haptic('medium'); playInvalid(); flash('Not one of the words'); }
      } else if (a.type === 'HINT' && next.hintsUsed > s.hintsUsed) { playKeyTap(); }
      return next;
    });
  }, [flash]);

  const recordResult = useCallback(() => {
    if (!profile || !state || hasRecordedRef.current) return;
    if (state.status !== 'won' && state.status !== 'lost') return;
    hasRecordedRef.current = true;
    const won = state.status === 'won';
    const gc = wordsearchGuessCount(state);
    const seed = mode === 'daily' ? state.seed : undefined;
    recordGameResult(profile.id, 'WORDSEARCH', 'solo', won, gc, elapsedSeconds * 1000, seed, state.found.length, state.words.length, state.hintsUsed)
      .then((xp) => { if (xp) setXpResult(xp); });
    const row = wordsearchMatchRow(state);
    recordSoloMatch({
      userId: profile.id, gameMode: 'WORDSEARCH', won, score: gc, timeSeconds: elapsedSeconds, seed: state.seed,
      solutions: row.solutions, guesses: row.guesses,
      startedAtIso: new Date(Date.now() - elapsedSeconds * 1000).toISOString(), hintsUsed: state.hintsUsed,
    });
  }, [profile, state, elapsedSeconds, mode]);

  useEffect(() => {
    if (!state || state.status === 'playing') return;
    if (!restoredRef.current) { if (state.status === 'won') setShowVictory(true); else setShowGameOver(true); }
    recordModePlayed('spyglass');
    recordResult();
    restoredRef.current = false;
  }, [state?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (profile && state && state.status !== 'playing') recordResult(); }, [profile, recordResult, state]);

  const onSelect = useCallback((from: number, to: number) => dispatch({ type: 'SELECT', from, to }), [dispatch]);
  const hint = useCallback(() => dispatch({ type: 'HINT' }), [dispatch]);
  const reveal = useCallback(() => {
    if (elapsedSeconds < REVEAL_AFTER_SECONDS) { flash(`Reveal unlocks at ${REVEAL_AFTER_SECONDS / 60}:00`); return; }
    dispatch({ type: 'REVEAL' });
  }, [dispatch, elapsedSeconds, flash]);

  const points = state ? computeScoreBreakdown('WORDSEARCH', state.status === 'won', wordsearchGuessCount(state), elapsedSeconds, state.found.length, state.words.length, state.hintsUsed).total : 0;

  const handleShare = useCallback(async () => {
    if (!state) return;
    const out = await shareResult({
      layout: 'wordsearch', mode: 'Spyglass', won: state.status === 'won',
      guesses: wordsearchGuessCount(state), maxGuesses: 15, timeSeconds: elapsedSeconds,
      n: state.n, words: state.words, found: state.found, misses: state.misses, title: state.title,
      puzzleNumber: mode === 'daily' ? wordsearchDailyNumber(getTodayLocal()) : undefined, points,
    });
    if (out.via !== 'failed') { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }, [state, elapsedSeconds, mode, points]);

  const formatTime = (s: number) => { const m = Math.floor(s / 60), sec = s % 60; return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`; };

  if (!state) return null;

  const finished = state.status !== 'playing';
  const won = state.status === 'won';
  const gc = wordsearchGuessCount(state);
  const missLabel = formatGuessStat('misses', 10, gc);
  const canReveal = elapsedSeconds >= REVEAL_AFTER_SECONDS;
  const capsule = (dim: boolean) => `flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${dim ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'hover:opacity-80'}`;
  const capsuleStyle = (dim: boolean) => dim ? undefined : { borderColor: `${WORDSEARCH_ACCENT}66`, color: WORDSEARCH_ACCENT, background: `${WORDSEARCH_ACCENT}0d` };

  const wordList = (
    <div className="flex flex-wrap justify-center gap-2 px-2" aria-label="Words to find">
      {state.words.map((p) => {
        const found = state.found.includes(p.w);
        const hinted = state.hinted.includes(p.w) && !found;
        return (
          <span key={p.w} className={`text-sm font-bold px-3 py-1.5 rounded-full border whitespace-nowrap ${found ? 'line-through' : ''}`}
            style={found
              ? { background: `${WORDSEARCH_ACCENT}22`, borderColor: `${WORDSEARCH_ACCENT}55`, color: '#365314' }
              : { background: 'var(--color-surface)', borderColor: hinted ? WORDSEARCH_ACCENT : 'var(--color-border)', color: 'var(--color-text)' }}>
            {p.w}
          </span>
        );
      })}
    </div>
  );

  return (
    <div className={`h-screen-stable flex flex-col relative ${finished ? 'pb-[calc(env(safe-area-inset-bottom)+64px)]' : ''}`} style={{ backgroundColor: 'var(--color-bg)' }}>
      {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} guesses={state.misses} guessLabel="Misses" timeSeconds={elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={state.misses} guessLabel="Misses" boardsSolved={state.found.length} totalBoards={state.words.length} timeSeconds={elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} flawlessStreak={xpResult.flawlessStreak} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      <div className="text-center py-2 px-2 shrink-0 relative">
        <GameHomeButton accentColor={WORDSEARCH_ACCENT} />
        <GameGuideButton slug="spyglass" accentColor={WORDSEARCH_ACCENT} />
        <SoundToggle accentColor={WORDSEARCH_ACCENT} />
        <h1 className="text-2xl font-black" style={{ color: WORDSEARCH_ACCENT }}>SPYGLASS</h1>
        <div className="text-sm font-black mt-0.5" style={{ color: 'var(--color-text)' }}>{state.title}</div>
        <div className="flex justify-center items-center gap-2 mt-1 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
          {mode === 'daily' && <span>#{wordsearchDailyNumber(getTodayLocal())}</span>}
          <span>{state.found.length}/{state.words.length} found</span>
          <span>{state.misses} miss{state.misses === 1 ? '' : 'es'}</span>
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
          {/* Grid, word chips and the two capsules are one centred block (founder, 2026-09-24). */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col items-center justify-center gap-3 px-3 pb-3">
            <SpyglassGrid state={state} onSelect={onSelect} />
            {wordList}
          <div className="shrink-0 px-2 pt-1 flex justify-center gap-2" role="group" aria-label="Spyglass controls">
            <button type="button" onClick={() => { haptic('light'); hint(); }} className={capsule(false)} style={capsuleStyle(false)} aria-label="Hint">
              <Lightbulb className="w-3.5 h-3.5" /> Hint{state.hintsUsed > 0 ? ` · ${state.hintsUsed}` : ''}
            </button>
            <button type="button" onClick={() => { haptic('light'); reveal(); }} className={capsule(!canReveal)} style={capsuleStyle(!canReveal)} aria-label="Reveal" aria-disabled={!canReveal}>
              <Eye className="w-3.5 h-3.5" /> Reveal{!canReveal ? ` · ${formatTime(REVEAL_AFTER_SECONDS - elapsedSeconds)}` : ''}
            </button>
          </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-col items-center gap-2 px-3 py-2">
              <SpyglassGrid state={state} onSelect={() => {}} disabled revealMissing={!won} />
              {wordList}
            </div>
            <div className="px-4 pb-4 animate-fade-in-up">
              <div className="flex items-center gap-3 rounded-xl p-3 bg-white border border-gray-100 shadow-sm">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-xl font-black"
                  style={{ backgroundColor: `${WORDSEARCH_ACCENT}15`, border: `2px solid ${WORDSEARCH_ACCENT}44`, color: WORDSEARCH_ACCENT }}>
                  {state.found.length}/{state.words.length}
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className={`text-sm font-bold ${won ? 'text-green-600' : 'text-red-500'}`}>
                    {won ? (state.misses === 0 ? 'Clean clear' : 'Grid cleared') : 'Revealed'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {`${state.found.length}/${state.words.length} found · ${missLabel} · ${formatTime(elapsedSeconds)}${state.hintsUsed ? ` · ${state.hintsUsed} hint${state.hintsUsed === 1 ? '' : 's'}` : ''}`}
                  </span>
                  <div className="flex items-center gap-3 mt-0.5">
                    <Link href="/" className="text-gray-400 text-xs font-bold underline">Home</Link>
                    <button onClick={handleShare} className="text-blue-500 text-xs font-bold underline">{copied ? 'Copied!' : 'Share'}</button>
                    {mode === 'daily' && <DailyRankBadge gameMode="WORDSEARCH" />}
                    {mode !== 'daily' && isPro && <button onClick={startPractice} className="text-xs font-bold underline" style={{ color: WORDSEARCH_ACCENT }}>Play Again</button>}
                  </div>
                </div>
              </div>
              <ScoreBreakdownCard gameMode="WORDSEARCH" completed={won} guessCount={gc} timeSeconds={elapsedSeconds}
                boardsSolved={state.found.length} totalBoards={state.words.length} hintsUsed={state.hintsUsed} day={mode === 'daily' ? getTodayLocal() : undefined} />
              {mode === 'daily' && <NextDailyCta currentMode="WORDSEARCH" />}
            </div>
          </div>
          <BottomNav />
        </>
      )}
    </div>
  );
}
