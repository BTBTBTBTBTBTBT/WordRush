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
import { GroupBar, TileGrid, ProgressRail, GROUPS_ACCENT, TIER_STYLE } from './groups-board';
import { loadDailySave, saveDaily, loadPracticeSave, savePractice } from './persistence';
import { recordModePlayed } from '@/lib/play-limit-service';
import { shareResult } from '@/lib/share-utils';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult, recordSoloMatch, type XpResult } from '@/lib/stats-service';
import { XpToast } from '@/components/effects/xp-toast';
import { DailyRankBadge } from '@/components/game/daily-rank-badge';
import { getTodayLocal } from '@/lib/daily-service';
import { useActivePlayTimer } from '@/hooks/use-active-play-timer';
import { useCompletedElsewhere } from '@/hooks/use-completed-elsewhere';
import { CompletedCustomDaily } from '@/components/game/completed-custom-daily';
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

  // Daily with no local save for today's seed → ask daily_results whether it
  // was finished on another device before showing a fresh grid (founder, 2026-09-28).
  const [noLocalSave, setNoLocalSave] = useState(false);
  const { checking, completion } = useCompletedElsewhere('GROUPS', mode === 'daily' && noLocalSave);
  const holdPlay = checking || !!completion;

  const status = state?.status ?? 'playing';
  const { elapsedSeconds, reset: resetTimer } = useActivePlayTimer(!!state && status === 'playing' && !holdPlay, 0);

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
      setNoLocalSave(true);
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
    // Never write the untouched fresh grid while the other-device check is
    // pending or positive: that save would hide the completed card on reload.
    if (mode === 'daily' && holdPlay) return;
    if (mode === 'daily') saveDaily(state.seed, state, elapsedSeconds);
    else savePractice(state.seed, state, elapsedSeconds);
  }, [state, elapsedSeconds, mode, holdPlay]);

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

  // Layout rule (founder, 2026-09-28, on the real build): the grid is the hero of the in-play band
  // instead of sitting content-sized above dead space. Tile height = clamp((band − chips − rail −
  // solved bars − gaps) / rows, 56, 92) with rows = ceil(tiles / 4), so as bars stack under the
  // grid the remaining rows shrink to stay balanced with them. The band is the flex-1 column
  // measured with a ResizeObserver (never window.innerHeight); it keeps overflow-y-auto as the
  // fallback for very short screens — tiles at the 56 floor plus bars may overflow, the pinned
  // buttons never do. Until the first measurement the vw clamp stands in.
  const bandRef = useRef<HTMLDivElement>(null);
  const [tileFit, setTileFit] = useState<{ h: number; w: number } | null>(null);
  const playing = !!state && state.status === 'playing';
  const tileCount = state?.tiles.length ?? 0;
  const solvedCount = state?.solved.length ?? 0;
  const revealedCount = state?.revealedTiers.length ?? 0;
  useEffect(() => {
    const band = bandRef.current;
    if (!band || !playing || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const cs = getComputedStyle(band);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const gap = parseFloat(cs.rowGap) || 0;
      let grid: HTMLElement | null = null;
      let others = 0;
      let count = 0;
      for (const child of Array.from(band.children) as HTMLElement[]) {
        count++;
        if (child.dataset.groupsGrid !== undefined) grid = child; else others += child.offsetHeight;
      }
      if (!grid || band.clientHeight <= 0) return;
      const gcs = getComputedStyle(grid);
      const rowGap = parseFloat(gcs.rowGap) || 0;
      const colGap = parseFloat(gcs.columnGap) || 0;
      const rows = Math.max(1, Math.ceil(tileCount / 4));
      const free = band.clientHeight - padY - others - gap * Math.max(0, count - 1) - rowGap * (rows - 1);
      const h = Math.round(Math.min(92, Math.max(56, free / rows)));
      const w = (grid.clientWidth - colGap * 3) / 4;
      setTileFit((prev) => (prev && prev.h === h && Math.abs(prev.w - w) < 0.5 ? prev : { h, w }));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(band);
    measure();
    return () => ro.disconnect();
  }, [playing, tileCount, solvedCount, revealedCount]);

  if (!state) return null;

  const finished = state.status !== 'playing';
  const holiday = holidayTitle((BANK.holiday && Object.keys(BANK.holiday).find((k) => BANK.holiday![k].some((q) => q.id === state.id))) ?? null);
  const revealedLabels = state.revealedTiers.map((t) => state.groups.find((g) => g.tier === t)!).filter((g) => !state.solved.some((s) => s.tier === g.tier));
  const unsolved = groupsUnsolved(state);
  const capsule = (dim: boolean) => `flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${dim ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'hover:opacity-80'}`;
  const capsuleStyle = (dim: boolean, filled = false) => dim ? undefined : filled ? { borderColor: GROUPS_ACCENT, color: '#fff', background: GROUPS_ACCENT } : { borderColor: `${GROUPS_ACCENT}66`, color: GROUPS_ACCENT, background: `${GROUPS_ACCENT}0d` };
  const mistakesLabel = `${state.mistakes} mistake${state.mistakes === 1 ? '' : 's'}`;

  return (
    <div className={`h-screen-stable flex flex-col relative ${finished || completion ? 'pb-[calc(env(safe-area-inset-bottom)+64px)]' : ''}`} style={{ backgroundColor: 'var(--color-bg)' }}>
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

      {completion ? (
        // Today's daily was finished on another device (founder, 2026-09-28).
        <CompletedCustomDaily dbKey="GROUPS" completion={completion} />
      ) : checking ? (
        // Header only while daily_results is read: no fresh-board flash, no clock.
        <div className="flex-1 min-h-0" aria-busy="true" />
      ) : !finished ? (
        <>
          {/* In-play column order (founder, 2026-09-28): category chips → grid (scaled to the band) →
              progress rail → solved bars (newest at the bottom) → pinned controls. Solved groups stack
              UNDER the grid so the tiles never get pushed down as you solve; nothing is moved up and
              no filler is added. Every direct child except the grid is subtracted by the band fit. */}
          <div ref={bandRef} className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-2 px-3 pb-1 pt-1">
            {revealedLabels.length > 0 && (
              <div className="w-full max-w-md flex flex-wrap justify-center gap-1.5 shrink-0">
                {revealedLabels.map((g) => (
                  <span key={g.tier} className="text-[11px] font-black px-2.5 py-1 rounded-full" style={{ background: TIER_STYLE[g.tier].bg, color: TIER_STYLE[g.tier].fg }}>
                    <span className="text-[7px] tracking-[2px] mr-1.5" aria-hidden>{'●'.repeat(g.tier)}</span>{g.label}
                  </span>
                ))}
              </div>
            )}
            <TileGrid state={state} onToggle={toggle} shaking={shaking} fit={tileFit} />
            <ProgressRail solvedTiers={state.solved.map((g) => g.tier)} total={GROUPS_TOTAL_BOARDS} mistakes={state.mistakes} maxMistakes={GROUPS_MAX_MISTAKES} />
            {state.solved.length > 0 && (
              <div className="w-full max-w-md flex flex-col gap-1.5 shrink-0">
                {state.solved.map((g) => <GroupBar key={g.tier} group={g} />)}
              </div>
            )}
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
