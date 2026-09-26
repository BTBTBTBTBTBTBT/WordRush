'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MORE_HOME_HREF } from '@/lib/more-games';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const VictoryAnimation = dynamic(() => import('@/components/effects/victory-animation').then(m => m.VictoryAnimation), { ssr: false });
const GameOverAnimation = dynamic(() => import('@/components/effects/game-over-animation').then(m => m.GameOverAnimation), { ssr: false });
import { Clock, Shuffle, XCircle, CheckCircle2, Tag, Link2 } from 'lucide-react';
import {
  groupsPuzzleForDay, groupsPuzzleForSeed, groupsDailyNumber, createGroupsState, groupsReduce, groupsMatchRow, groupsGuessCount, groupsBoardsSolved,
  groupsUnsolved, groupsLabelTarget, groupsPairTarget, GROUPS_MAX_MISTAKES, GROUPS_TOTAL_BOARDS, generateDailySeed,
  type GroupsState, type GroupsAction, type GroupsBank,
} from '@wordle-duel/core';
import groupsBankJson from '@/data/groups-puzzles.json';
import { HOLIDAY_TABLE, holidayTitle } from '@/lib/holidays';
import { GameHomeButton } from '@/components/game/game-home-button';
import { GameGuideButton } from '@/components/game/game-guide-button';
import { SoundToggle } from '@/components/game/sound-toggle';
import { GroupBar, TileGrid, MistakeDots, GROUPS_ACCENT, TIER_STYLE } from './groups-board';
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
import { computeScoreBreakdown } from '@/lib/composite-scoring';

// Kindred (More Games §14): sixteen words, four groups of four, four mistakes.
// Submit four → a group locks (bar with pips), three-of-a-kind reads "One
// away", a repeated set is free. Name a category (100) / Show a pair (200)
// never cost a mistake. guess_count = submissions (4 perfect) or found + 4 on a loss.

const BANK = groupsBankJson as unknown as GroupsBank;

interface GroupsGameProps { isDaily?: boolean }

export function GroupsGame({ isDaily = false }: GroupsGameProps) {
  const { profile, isProActive } = useAuth();
  const isPro = isProActive;
  const mode: 'daily' | 'practice' = isDaily ? 'daily' : 'practice';

  const [state, setState] = useState<GroupsState | null>(null);
  const [shaking, setShaking] = useState(false);
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
    const seed = `unlimited-GROUPS-${Date.now()}`;
    const p = groupsPuzzleForSeed(BANK, seed);
    if (!p) return;
    setState(createGroupsState(p, seed, Date.now()));
    setShowVictory(false); setShowGameOver(false); setXpResult(null); setMessage('');
    resetTimer(0);
    restoredRef.current = false; hasRecordedRef.current = false;
  }, [resetTimer]);

  useEffect(() => {
    if (mode === 'daily') {
      const today = getTodayLocal();
      const seed = generateDailySeed(today, 'GROUPS');
      const saved = loadDailySave(seed);
      if (saved) {
        setState(saved.state); resetTimer(saved.elapsedSeconds);
        const done = saved.state.status !== 'playing';
        restoredRef.current = done; hasRecordedRef.current = done;
        return;
      }
      const p = groupsPuzzleForDay(BANK, today, HOLIDAY_TABLE);
      if (p) setState(createGroupsState(p, seed, Date.now()));
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

  const flash = useCallback((m: string) => { setMessage(m); setTimeout(() => setMessage(''), 1500); }, []);

  const dispatch = useCallback((a: GroupsAction) => {
    setState((s) => {
      if (!s) return s;
      const next = groupsReduce(s, a, Date.now());
      if (a.type === 'SUBMIT') {
        switch (next.lastResult) {
          case 'correct': playSuccess(); haptic('light'); break;
          case 'oneaway': flash('One away…'); playInvalid(); haptic('medium'); setShaking(true); setTimeout(() => setShaking(false), 500); break;
          case 'wrong': flash('Not a group'); playInvalid(); haptic('medium'); setShaking(true); setTimeout(() => setShaking(false), 500); break;
          case 'repeat': flash('Already tried that set'); break;
          case 'short': flash('Pick four words'); break;
        }
      }
      return next;
    });
  }, [flash]);

  const recordResult = useCallback(() => {
    if (!profile || !state || hasRecordedRef.current) return;
    if (state.status !== 'won' && state.status !== 'lost') return;
    hasRecordedRef.current = true;
    const won = state.status === 'won';
    const gc = groupsGuessCount(state);
    const seed = mode === 'daily' ? state.seed : undefined;
    recordGameResult(profile.id, 'GROUPS', 'solo', won, gc, elapsedSeconds * 1000, seed, groupsBoardsSolved(state), GROUPS_TOTAL_BOARDS, state.hintsUsed)
      .then((xp) => { if (xp) setXpResult(xp); });
    const row = groupsMatchRow(state);
    recordSoloMatch({
      userId: profile.id, gameMode: 'GROUPS', won, score: gc, timeSeconds: elapsedSeconds, seed: state.seed,
      solutions: row.solutions, guesses: row.guesses,
      startedAtIso: new Date(Date.now() - elapsedSeconds * 1000).toISOString(), hintsUsed: state.hintsUsed,
    });
  }, [profile, state, elapsedSeconds, mode]);

  useEffect(() => {
    if (!state || state.status === 'playing') return;
    if (!restoredRef.current) { if (state.status === 'won') setShowVictory(true); else setShowGameOver(true); }
    recordModePlayed('kindred');
    recordResult();
    restoredRef.current = false;
  }, [state?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (profile && state && state.status !== 'playing') recordResult(); }, [profile, recordResult, state]);

  const toggle = useCallback((w: string) => { playKeyTap(); dispatch({ type: 'TOGGLE', word: w }); }, [dispatch]);
  const submit = useCallback(() => dispatch({ type: 'SUBMIT' }), [dispatch]);
  const hintLabel = useCallback(() => { if (state && groupsLabelTarget(state)) { dispatch({ type: 'HINT_LABEL' }); haptic('light'); } else flash('Every category is already named'); }, [state, dispatch, flash]);
  const hintPair = useCallback(() => { if (state && groupsPairTarget(state)) { dispatch({ type: 'HINT_PAIR' }); haptic('light'); } else flash('Every group already has a pair shown'); }, [state, dispatch, flash]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!state || state.status !== 'playing') return;
      if (e.key === 'Enter') submit();
      else if (e.key === 'Escape') dispatch({ type: 'DESELECT' });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state, submit, dispatch]);

  const won = state?.status === 'won';
  const gc = state ? groupsGuessCount(state) : 4;
  const points = state ? computeScoreBreakdown('GROUPS', won, gc, elapsedSeconds, groupsBoardsSolved(state), GROUPS_TOTAL_BOARDS, state.hintsUsed).total : 0;

  const handleShare = useCallback(async () => {
    if (!state) return;
    const out = await shareResult({
      layout: 'groups', mode: 'Kindred', won, guesses: gc, maxGuesses: 7, timeSeconds: elapsedSeconds,
      solvedTiers: state.solved.map((g) => g.tier), mistakes: state.mistakes, maxMistakes: GROUPS_MAX_MISTAKES,
      puzzleNumber: mode === 'daily' ? groupsDailyNumber(getTodayLocal()) : undefined, points,
    });
    if (out.via !== 'failed') { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }, [state, elapsedSeconds, mode, points, won, gc]);

  const formatTime = (s: number) => { const m = Math.floor(s / 60), sec = s % 60; return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`; };

  if (!state) return null;

  const finished = state.status !== 'playing';
  const holiday = holidayTitle((BANK.holiday && Object.keys(BANK.holiday).find((k) => BANK.holiday![k].some((q) => q.id === state.id))) ?? null);
  const revealedLabels = state.revealedTiers.map((t) => state.groups.find((g) => g.tier === t)!).filter((g) => !state.solved.some((s) => s.tier === g.tier));
  const unsolved = groupsUnsolved(state);
  const capsule = (dim: boolean) => `flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${dim ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'hover:opacity-80'}`;
  const capsuleStyle = (dim: boolean, filled = false) => dim ? undefined : filled ? { borderColor: GROUPS_ACCENT, color: '#fff', background: GROUPS_ACCENT } : { borderColor: `${GROUPS_ACCENT}66`, color: GROUPS_ACCENT, background: `${GROUPS_ACCENT}0d` };
  const mistakesLabel = `${state.mistakes} mistake${state.mistakes === 1 ? '' : 's'}`;

  return (
    <div className={`h-screen-stable flex flex-col relative ${finished ? 'pb-[calc(env(safe-area-inset-bottom)+64px)]' : ''}`} style={{ backgroundColor: 'var(--color-bg)' }}>
      {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} guesses={state.mistakes} guessLabel="Mistakes" timeSeconds={elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={state.mistakes} guessLabel="Mistakes" timeSeconds={elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} flawlessStreak={xpResult.flawlessStreak} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      <div className="text-center py-2 px-2 shrink-0 relative">
        <GameHomeButton accentColor={GROUPS_ACCENT}  href={MORE_HOME_HREF} />
        <GameGuideButton slug="kindred" accentColor={GROUPS_ACCENT} />
        <SoundToggle accentColor={GROUPS_ACCENT} />
        <h1 className="text-2xl font-black" style={{ color: GROUPS_ACCENT }}>KINDRED</h1>
        <div className="flex justify-center items-center gap-2 mt-1 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
          {mode === 'daily' && <span>#{groupsDailyNumber(getTodayLocal())}</span>}
          {holiday && <span style={{ color: GROUPS_ACCENT }}>{holiday}</span>}
          <span>{state.solved.length}/{GROUPS_TOTAL_BOARDS} groups</span>
          <span>{mistakesLabel}</span>
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
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-2 px-3 pb-1 pt-1">
            <div className="w-full max-w-md flex flex-col gap-1.5">
              {state.solved.map((g) => <GroupBar key={g.tier} group={g} />)}
            </div>
            {revealedLabels.length > 0 && (
              <div className="w-full max-w-md flex flex-wrap justify-center gap-1.5">
                {revealedLabels.map((g) => (
                  <span key={g.tier} className="text-[11px] font-black px-2.5 py-1 rounded-full" style={{ background: TIER_STYLE[g.tier].bg, color: TIER_STYLE[g.tier].fg }}>
                    <span className="text-[7px] tracking-[2px] mr-1.5" aria-hidden>{'●'.repeat(g.tier)}</span>{g.label}
                  </span>
                ))}
              </div>
            )}
            <TileGrid state={state} onToggle={toggle} shaking={shaking} />
            <MistakeDots mistakes={state.mistakes} max={GROUPS_MAX_MISTAKES} />
          </div>
          <div className="shrink-0 pb-3 px-2 pt-1 flex flex-col gap-2">
            <div className="flex justify-center gap-2 px-1 flex-wrap" role="group" aria-label="Kindred controls">
              <button type="button" onClick={() => { haptic('light'); playKeyTap(); dispatch({ type: 'SHUFFLE' }); }} className={capsule(false)} style={capsuleStyle(false)} aria-label="Shuffle the words">
                <Shuffle className="w-3.5 h-3.5" /> Shuffle
              </button>
              <button type="button" onClick={() => { playKeyTap(); dispatch({ type: 'DESELECT' }); }} disabled={!state.selected.length} className={capsule(!state.selected.length)} style={capsuleStyle(!state.selected.length)} aria-label="Deselect all">
                <XCircle className="w-3.5 h-3.5" /> Deselect
              </button>
              <button type="button" onClick={() => { haptic('light'); submit(); }} disabled={state.selected.length !== 4} className={capsule(state.selected.length !== 4)} style={capsuleStyle(state.selected.length !== 4, true)} aria-label="Submit the four selected words">
                <CheckCircle2 className="w-3.5 h-3.5" /> Submit
              </button>
            </div>
            <div className="flex justify-center gap-2 px-1" role="group" aria-label="Hints">
              <button type="button" onClick={hintLabel} className={capsule(false)} style={capsuleStyle(false)} aria-label="Hint: name a category">
                <Tag className="w-3.5 h-3.5" /> Name a category
              </button>
              <button type="button" onClick={hintPair} className={capsule(false)} style={capsuleStyle(false)} aria-label="Hint: show a pair">
                <Link2 className="w-3.5 h-3.5" /> Show a pair{state.hintsUsed > 0 ? ` · ${state.hintsUsed}` : ''}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-col items-center gap-1.5 px-3 py-3 max-w-md mx-auto">
              {state.solved.map((g) => <GroupBar key={g.tier} group={g} />)}
              {unsolved.map((g) => <GroupBar key={g.tier} group={g} revealed />)}
            </div>
            <div className="px-4 pb-4 animate-fade-in-up">
              <div className="flex items-center gap-3 rounded-xl p-3 bg-white border border-gray-100 shadow-sm">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-xl font-black"
                  style={{ backgroundColor: `${GROUPS_ACCENT}15`, border: `2px solid ${GROUPS_ACCENT}44`, color: GROUPS_ACCENT }}>
                  {won ? (state.mistakes === 0 ? '✓' : state.mistakes) : '✗'}
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className={`text-sm font-bold ${won ? 'text-green-600' : 'text-red-500'}`}>
                    {won ? (state.mistakes === 0 ? 'Flawless — all four groups' : 'All four groups found') : 'Out of mistakes'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {`${state.solved.length}/${GROUPS_TOTAL_BOARDS} groups · ${mistakesLabel} · ${formatTime(elapsedSeconds)}${state.hintsUsed ? ` · ${state.hintsUsed} hint${state.hintsUsed === 1 ? '' : 's'}` : ''}`}
                  </span>
                  <div className="flex items-center gap-3 mt-0.5">
                    <Link href={MORE_HOME_HREF} className="text-gray-400 text-xs font-bold underline">Home</Link>
                    <button onClick={handleShare} className="text-blue-500 text-xs font-bold underline">{copied ? 'Copied!' : 'Share'}</button>
                    {mode === 'daily' && <DailyRankBadge gameMode="GROUPS" />}
                    {mode !== 'daily' && isPro && <button onClick={startPractice} className="text-xs font-bold underline" style={{ color: GROUPS_ACCENT }}>Play Again</button>}
                  </div>
                </div>
              </div>
              <ScoreBreakdownCard gameMode="GROUPS" completed={won} guessCount={gc} timeSeconds={elapsedSeconds}
                boardsSolved={groupsBoardsSolved(state)} totalBoards={GROUPS_TOTAL_BOARDS} hintsUsed={state.hintsUsed} day={mode === 'daily' ? getTodayLocal() : undefined} />
              {mode === 'daily' && <NextDailyCta currentMode="GROUPS" />}
            </div>
          </div>
          <BottomNav />
        </>
      )}
    </div>
  );
}
