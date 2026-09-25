'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
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
import { SoundToggle } from '@/components/game/sound-toggle';
import { RegionsBoard } from './regions-board';
import { RegionsPad } from './regions-pad';
import { REGIONS_ACCENT, REGIONS_HEADER, REGIONS_TITLE, REGIONS_WIN_TITLE, REGIONS_LOSS_TITLE, REGIONS_SIZE_LABEL, REGIONS_TAP_HINT } from './copy';
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

// Starsweep (More Games §18b): place one star in every row, column and color
// region, no two stars touching. Daily 7 × 7 Monday–Wednesday, 8 × 8
// Thursday–Sunday; Pro Unlimited picks 7 / 8 / 9. Tap = cross out, tap again =
// star, again = clear. A wrong star is a mistake, the third loses; a hint
// places one correct star for a score cost, never a mistake.
// guess_count = mistakes + 1 (perfect = 1), boards 1/1 — the Sudocious scoring row.

const SIZES: RegionsSize[] = [7, 8, 9];

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

  const status = state?.status ?? 'playing';
  const { elapsedSeconds, reset: resetTimer } = useActivePlayTimer(!!state && status === 'playing', 0);

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

  useEffect(() => {
    if (!state) return;
    if (mode === 'daily') saveDaily(state.seed, state, elapsedSeconds);
    else savePractice(state.seed, state, elapsedSeconds);
  }, [state, elapsedSeconds, mode]);

  const mistakes = state?.mistakes ?? 0;

  const recordResult = useCallback(() => {
    if (!profile || !state || hasRecordedRef.current) return;
    if (state.status !== 'won' && state.status !== 'lost') return;
    hasRecordedRef.current = true;
    const won = state.status === 'won';
    const timeMs = elapsedSeconds * 1000;
    const seed = mode === 'daily' ? state.seed : undefined;
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
  }, [profile, state, elapsedSeconds, mode]);

  useEffect(() => {
    if (!state || state.status === 'playing') return;
    if (!restoredRef.current) {
      if (state.status === 'won') setShowVictory(true); else setShowGameOver(true);
    }
    recordModePlayed('starsweep');
    recordResult();
    restoredRef.current = false;
  }, [state?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (profile && state && state.status !== 'playing') recordResult();
  }, [profile, recordResult, state]);

  // Input: a tap cycles the cell; the cell becomes the focus for Erase/keys.
  const tapCell = useCallback((cell: number) => {
    if (!state || state.status !== 'playing') return;
    setFocused(cell);
    if (state.board[cell] === '*' && state.hintMask[cell] === '1') { playInvalid(); return; }
    // Placing a star (cross → star) on a non-solution cell is the mistake path.
    if (state.board[cell] === 'x') {
      const r = Math.floor(cell / state.n);
      if (state.solution.charCodeAt(r) - 48 !== cell % state.n) { haptic('medium'); playInvalid(); }
    }
    dispatch({ type: 'TAP', cell });
  }, [state, dispatch]);
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
      if (e.key === ' ' || e.key === 'Enter') { if (focused != null) { e.preventDefault(); tapCell(focused); } return; }
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
  }, [state, focused, tapCell, erase, undo, hint]);

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
  const mistakeDots = (
    <span className="inline-flex items-center gap-0.5 align-middle" aria-label={`${mistakes} of ${REGIONS_MAX_MISTAKES} mistakes`}>
      {Array.from({ length: REGIONS_MAX_MISTAKES }, (_, i) => (
        <span key={i} className="inline-block w-2 h-2 rounded-full" style={{ background: i < mistakes ? '#dc2626' : 'var(--color-border-light)' }} />
      ))}
    </span>
  );

  const board = (
    <RegionsBoard state={state} focused={finished ? null : focused} onTap={tapCell} revealSolution={state.status === 'lost'} />
  );

  return (
    <div
      className={`h-screen-stable flex flex-col relative ${finished ? 'pb-[calc(env(safe-area-inset-bottom)+64px)]' : ''}`}
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} guesses={state.mistakes} guessLabel="Mistakes" timeSeconds={elapsedSeconds} points={computeScoreBreakdown('REGIONS', true, state.mistakes + 1, elapsedSeconds, 1, 1, state.hintsUsed).total} onPlayAgain={mode !== 'daily' && isPro ? () => startPractice(state.n as RegionsSize) : undefined} />}
      {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={state.mistakes} guessLabel="Mistakes" timeSeconds={elapsedSeconds} points={computeScoreBreakdown('REGIONS', false, state.mistakes + 1, elapsedSeconds, 0, 1, state.hintsUsed).total} onPlayAgain={mode !== 'daily' && isPro ? () => startPractice(state.n as RegionsSize) : undefined} />}
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} flawlessStreak={xpResult.flawlessStreak} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      <div className="text-center py-2 px-2 shrink-0 relative">
        <GameHomeButton accentColor={REGIONS_ACCENT} />
        <GameGuideButton slug="starsweep" accentColor={REGIONS_ACCENT} />
        <SoundToggle accentColor={REGIONS_ACCENT} />
        <h1 className="text-2xl font-black" style={{ color: REGIONS_ACCENT }}>{REGIONS_HEADER}</h1>
        <div className="flex justify-center items-center gap-2 mt-1 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
          {mode === 'daily' && <span>#{regionsDailyNumber(getTodayLocal())}</span>}
          <span>{REGIONS_SIZE_LABEL[state.n] ?? `${state.n} × ${state.n}`}</span>
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
          {mode !== 'daily' && isPro && (
            <div className="shrink-0 flex justify-center gap-2 px-4 pb-2" role="radiogroup" aria-label="Board size">
              {SIZES.map((n) => {
                const active = n === state.n;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => { if (!active) startPractice(n); }}
                    className={`text-xs font-bold px-3 py-1 rounded-full border transition-all ${active ? 'text-white' : ''}`}
                    style={active ? { background: REGIONS_ACCENT, borderColor: REGIONS_ACCENT } : { borderColor: `${REGIONS_ACCENT}55`, color: REGIONS_ACCENT }}
                  >
                    {REGIONS_SIZE_LABEL[n]}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center px-3 pb-1">
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
        <>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex items-center justify-center px-3 py-2">{board}</div>

            {/* Result panel — a lost board shows the missing stars muted above,
                so nobody leaves without the answer. */}
            <div className="px-4 pb-4 animate-fade-in-up">
              <div className="flex items-center gap-3 rounded-xl p-3 bg-white border border-gray-100 shadow-sm">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-2xl font-black"
                  style={{ backgroundColor: `${REGIONS_ACCENT}15`, border: `2px solid ${REGIONS_ACCENT}44`, color: REGIONS_ACCENT }}>
                  {won ? '★' : remaining}
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className={`text-sm font-bold ${won ? 'text-green-600' : 'text-red-500'}`}>
                    {won ? REGIONS_WIN_TITLE : REGIONS_LOSS_TITLE}
                  </span>
                  <span className="text-xs text-gray-400">
                    {won
                      ? `${formatGuessStat('mistakes', 1, state.mistakes + 1)} · ${formatTime(elapsedSeconds)}${state.hintsUsed ? ` · ${state.hintsUsed} hint${state.hintsUsed === 1 ? '' : 's'}` : ''}`
                      : `${remaining} star${remaining === 1 ? '' : 's'} left · ${formatTime(elapsedSeconds)}`}
                  </span>
                  <div className="flex items-center gap-3 mt-0.5">
                    <Link href="/" className="text-gray-400 text-xs font-bold underline">Home</Link>
                    <button onClick={handleShare} className="text-blue-500 text-xs font-bold underline">{copied ? 'Copied!' : 'Share'}</button>
                    {mode === 'daily' && <DailyRankBadge gameMode="REGIONS" />}
                    {mode !== 'daily' && isPro && <button onClick={() => startPractice(state.n as RegionsSize)} className="text-xs font-bold underline" style={{ color: REGIONS_ACCENT }}>Play Again</button>}
                  </div>
                </div>
              </div>
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
              {mode === 'daily' && <NextDailyCta currentMode="REGIONS" />}
            </div>
          </div>
          <BottomNav />
        </>
      )}
    </div>
  );
}

export { REGIONS_TITLE };
