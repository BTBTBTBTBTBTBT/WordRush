'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MORE_HOME_HREF } from '@/lib/more-games';
import dynamic from 'next/dynamic';
const VictoryAnimation = dynamic(() => import('@/components/effects/victory-animation').then(m => m.VictoryAnimation), { ssr: false });
const GameOverAnimation = dynamic(() => import('@/components/effects/game-over-animation').then(m => m.GameOverAnimation), { ssr: false });
import { Clock, List } from 'lucide-react';
import { FamIcon } from '@/components/ui/family-button';
import {
  wordsearchPuzzleForDay, wordsearchPuzzleForSeed, wordsearchDailyNumber, createWordsearchState, wordsearchReduce, wordsearchMatchRow, wordsearchGuessCount, wordsearchNearWord,
  generateDailySeed, type WordsearchState, type WordsearchAction, type WordsearchBank, type WordsearchPuzzle,
} from '@wordle-duel/core';
import { bankSession } from '@/lib/bank-loader';
import { GameLoading } from '@/components/game/game-loading';
import { GameHomeButton } from '@/components/game/game-home-button';
import { GameGuideButton } from '@/components/game/game-guide-button';
import { GameHostTitle } from '@/components/ui/mascot';
import { SoundToggle } from '@/components/game/sound-toggle';
import { SpyglassGrid, SpyglassWordList, WORDSEARCH_ACCENT } from './spyglass-grid';
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
import { wordsearchElsewhere } from '@/lib/elsewhere-progress';
import { playInvalid, playKeyTap, playSuccess } from '@/lib/sounds';
import { haptic } from '@/lib/haptics';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { formatGuessStat } from '@/lib/format';
import { computeScoreBreakdown } from '@/lib/composite-scoring';
import { GameBackground } from '@/components/ui/page-background';
import { gameHeaderStyle } from '@/lib/art';
import { FeedbackToast } from '@/components/game/feedback-toast';
import { FinishedDock, MoreDisclosure, ResultStrip } from '@/components/game/finished-kit';
import { candyClass } from '@/components/ui/candy-button';
import { HintCountBadge, StableLabel } from '@/components/ui/hint-kit';

// Spyglass (More Games §17): ten themed words hidden in a 10 × 10 grid, four
// forward directions in the daily. Tap-start / tap-end or drag to select; a
// straight line of four or more letters that spells no list word is a miss.
// Hint pulses a first letter (score cost, never a miss). Reveal (after five
// minutes) records a loss with what was found. The word list starts HIDDEN
// (founder, 2026-09-26): chips show only each word's length; Show words lists
// the rest and every later find counts like a miss. guess_count = min(10 + misses + late finds, 15).

// Puzzles are fetched one at a time from /banks (lib/bank-loader.ts; founder, 2026-09-29).
const BANK = bankSession<WordsearchBank, WordsearchPuzzle>('wordsearch', (b, d) => wordsearchPuzzleForDay(b, d), wordsearchPuzzleForSeed);
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
  const [loadFailed, setLoadFailed] = useState(false);
  const restoredRef = useRef(false);
  const hasRecordedRef = useRef(false);
  // Daily with no local save for today's seed → ask daily_results whether it
  // was finished on another device before showing a fresh grid (founder, 2026-09-28).
  const [noLocalSave, setNoLocalSave] = useState(false);
  const { checking, completion } = useCompletedElsewhere('WORDSEARCH', mode === 'daily' && noLocalSave);
  const holdPlay = checking || !!completion;
  // The finished grid rebuilt from the matches row when today's daily was played elsewhere.
  const [elsewhereState, setElsewhereState] = useState<WordsearchState | null>(null);

  const status = state?.status ?? 'playing';
  // The header clock ticks on its own (PlayClock); the board re-renders only on play (founder, 2026-09-29).
  const timer = useActivePlayTimer(!!state && status === 'playing' && !holdPlay, 0, { tick: false });
  const { elapsedSeconds, reset: resetTimer, getElapsed } = timer;

  const startPractice = useCallback(() => {
    const seed = `unlimited-WORDSEARCH-${Date.now()}`;
    BANK.seed(seed).then((p) => {
      if (!p) return;
      setState(createWordsearchState(p, seed, Date.now()));
      setShowVictory(false); setShowGameOver(false); setXpResult(null); setMessage('');
      resetTimer(0);
      restoredRef.current = false;
      hasRecordedRef.current = false;
    }).catch(() => setLoadFailed(true));
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
      // The other-device check runs while the puzzle is fetched.
      setNoLocalSave(true);
      BANK.day(today).then((p) => {
        if (p) setState(createWordsearchState(p, seed, Date.now()));
        resetTimer(0);
        restoredRef.current = false;
      }).catch(() => setLoadFailed(true));
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

  // Never write the untouched fresh grid while the other-device check is
  // pending or positive: that save would hide the completed card on reload.
  useThrottledSave(!state || (mode === 'daily' && holdPlay) ? null : (sec) => {
    if (mode === 'daily') saveDaily(state.seed, state, sec);
    else savePractice(state.seed, state, sec);
  }, getElapsed, [state, mode, holdPlay]);

  // Played elsewhere today: rebuild the finished grid from the matches row
  // (solutions + event log, mirror of iOS solvedDaily) over the bank puzzle,
  // so the completed screen shows the day's grid with its found words.
  useEffect(() => {
    if (!completion || !profile || mode !== 'daily') return;
    const today = getTodayLocal();
    const seed = generateDailySeed(today, 'WORDSEARCH');
    let cancelled = false;
    Promise.all([fetchSolvedDailyRow(profile.id, 'WORDSEARCH', seed), BANK.day(today)]).then(([row, p]) => {
      if (cancelled || !p) return;
      setElsewhereState(wordsearchElsewhere(row, { seed, won: completion.won, guessCount: completion.guesses }, p));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [completion, profile, mode]);

  const flash = useCallback((m: string, ms = 1400) => { setMessage(m); setTimeout(() => setMessage(''), ms); }, []);

  const dispatch = useCallback((a: WordsearchAction) => {
    setState((s) => {
      if (!s) return s;
      const next = wordsearchReduce(s, a, Date.now());
      if (a.type === 'SELECT') {
        // A theme word hiding in the filler (founder, 2026-09-30: STARS in Night Sky) — never a miss.
        const near = next === s ? wordsearchNearWord(s, a.from, a.to) : null;
        if (near) { playKeyTap(); flash(`${near} fits the theme, but it's not one of today's 10`, 2600); }
        else if (next.found.length > s.found.length) { haptic('light'); playSuccess(); }
        else if (next.misses > s.misses) { haptic('medium'); playInvalid(); flash('Not one of the words'); }
      } else if (a.type === 'HINT' && next.hintsUsed > s.hintsUsed) { playKeyTap(); }
      return next;
    });
  }, [flash]);

  const recordResult = useCallback(() => {
    const elapsedSeconds = getElapsed();
    if (!state || hasRecordedRef.current) return;
    if (state.status !== 'won' && state.status !== 'lost') return;
    hasRecordedRef.current = true;
    const won = state.status === 'won';
    const gc = wordsearchGuessCount(state);
    const seed = mode === 'daily' ? state.seed : undefined;
    // Guest: today's daily still flips Home (the optimistic path, no server).
    if (!profile) { noteGuestDailyFinish('WORDSEARCH', won, gc, elapsedSeconds * 1000, seed, state.found.length, state.words.length, state.hintsUsed); return; }
    recordGameResult(profile.id, 'WORDSEARCH', 'solo', won, gc, elapsedSeconds * 1000, seed, state.found.length, state.words.length, state.hintsUsed)
      .then((xp) => { if (xp) setXpResult(xp); });
    const row = wordsearchMatchRow(state);
    recordSoloMatch({
      userId: profile.id, gameMode: 'WORDSEARCH', won, score: gc, timeSeconds: elapsedSeconds, seed: state.seed,
      solutions: row.solutions, guesses: row.guesses,
      startedAtIso: new Date(Date.now() - elapsedSeconds * 1000).toISOString(), hintsUsed: state.hintsUsed,
    });
  }, [profile, state, getElapsed, mode]);

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
  const showWords = useCallback(() => { dispatch({ type: 'SHOW' }); flash('Words shown — finds from here count like misses'); }, [dispatch, flash]);
  const reveal = useCallback(() => {
    if (getElapsed() < REVEAL_AFTER_SECONDS) { flash(`Reveal unlocks at ${REVEAL_AFTER_SECONDS / 60}:00`); return; }
    dispatch({ type: 'REVEAL' });
  }, [dispatch, getElapsed, flash]);

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

  if (!state) return <GameLoading failed={loadFailed} />;

  const finished = state.status !== 'playing';
  const won = state.status === 'won';
  const gc = wordsearchGuessCount(state);
  const missLabel = formatGuessStat('misses', 10, gc);
  // FINISH_SPEC A8: the action capsules are small glossy candy buttons (components/ui/candy-button.tsx).
  const capsule = (dim: boolean) => candyClass({ dim });
  const capsuleStyle = (_dim: boolean) => undefined;

  const renderWordList = (s: WordsearchState, done: boolean) => <SpyglassWordList state={s} done={done} />;
  const wordList = renderWordList(state, finished);

  return (
    <GameBackground mode="WORDSEARCH" className="h-screen-stable flex flex-col relative" style={finished || completion ? FINISHED_SHELL_PAD : undefined}>
      {showVictory && <VictoryAnimation mode="WORDSEARCH" onComplete={() => setShowVictory(false)} guesses={state.misses} guessLabel="Misses" timeSeconds={elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={state.misses} guessLabel="Misses" boardsSolved={state.found.length} totalBoards={state.words.length} timeSeconds={elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} flawlessStreak={xpResult.flawlessStreak} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      <div className="game-art-header text-center px-2 shrink-0 relative" style={gameHeaderStyle('WORDSEARCH')}>
        <GameHomeButton accentColor={WORDSEARCH_ACCENT}  href={MORE_HOME_HREF} />
        <GameGuideButton slug="spyglass" accentColor={WORDSEARCH_ACCENT} />
        <SoundToggle accentColor={WORDSEARCH_ACCENT} />
        <GameHostTitle mode="WORDSEARCH" label="Spyglass">
          <h1 className="text-2xl font-black" style={{ color: WORDSEARCH_ACCENT }}>SPYGLASS</h1>
        </GameHostTitle>
        <div className="text-sm font-black mt-0.5" style={{ color: 'var(--color-text)' }}>{state.title}</div>
        <div className="relative flex justify-center items-center gap-2 mt-1 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
          {mode === 'daily' && <span>#{wordsearchDailyNumber(getTodayLocal())}</span>}
          <span>{state.found.length}/{state.words.length} found</span>
          <span>{state.misses} miss{state.misses === 1 ? '' : 'es'}{(state.lateFinds ?? 0) > 0 ? ` · ${state.lateFinds} late` : ''}</span>
          <span><Clock className="w-3 h-3 inline mr-0.5" /><PlayClock timer={timer}>{formatTime}</PlayClock></span>
          <FeedbackToast message={message} />
        </div>
      </div>

      {completion ? (
        // Today's daily was finished on another device (founder, 2026-09-28): the
        // day's grid with the found words from the matches row, then the completed card.
        <PuzzleElsewhere dbKey="WORDSEARCH" completion={completion}
          boardsSolved={elsewhereState?.found.length} totalBoards={elsewhereState?.words.length} hintsUsed={elsewhereState?.hintsUsed}
          moreExtra={elsewhereState ? renderWordList(elsewhereState, true) : undefined}>
          {elsewhereState && <SpyglassGrid state={elsewhereState} onSelect={() => {}} disabled revealMissing={!completion.won} />}
        </PuzzleElsewhere>
      ) : checking ? (
        // Header only while daily_results is read: no fresh-grid flash, no clock.
        <div className="flex-1 min-h-0" aria-busy="true" />
      ) : !finished ? (
        <>
          {/* Grid, word chips and the two capsules are one centered block (founder, 2026-09-24). */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col items-center justify-center gap-3 px-3 pb-3">
            <SpyglassGrid state={state} onSelect={onSelect} />
            {wordList}
          <div className="shrink-0 px-2 pt-1 flex justify-center gap-2" role="group" aria-label="Spyglass controls">
            {/* Labels never change width (lib/hint-layout.ts): the hint count is a corner coin,
                the toggles and the countdown keep their widest variant's width. */}
            <button type="button" onClick={() => { haptic('light'); hint(); }} className={capsule(false)} style={capsuleStyle(false)} aria-label={state.hintsUsed > 0 ? `Hint (${state.hintsUsed} used)` : 'Hint'}>
              <FamIcon name="hint" /> Hint<HintCountBadge count={state.hintsUsed} />
            </button>
            <button type="button" onClick={() => { if (!state.wordsShown) { haptic('light'); showWords(); } }} className={capsule(!!state.wordsShown)} style={capsuleStyle(!!state.wordsShown)} aria-label="Show words" aria-disabled={!!state.wordsShown}>
              <List className="w-3.5 h-3.5" /> <StableLabel value={state.wordsShown ? 'Words shown' : 'Show words'} reserve={['Show words', 'Words shown']} />
            </button>
            {/* Counts down on the clock's own tick, not the board's (founder, 2026-09-29). */}
            <PlayClock timer={timer}>{(sec) => { const canReveal = sec >= REVEAL_AFTER_SECONDS; return (
            <button type="button" onClick={() => { haptic('light'); reveal(); }} className={capsule(!canReveal)} style={capsuleStyle(!canReveal)} aria-label="Reveal" aria-disabled={!canReveal}>
              <FamIcon name="eye" /> <StableLabel value={canReveal ? 'Reveal' : `Reveal · ${formatTime(REVEAL_AFTER_SECONDS - sec)}`} reserve={['Reveal · 0:00']} />
            </button>); }}</PlayClock>
          </div>
          </div>
        </>
      ) : (
        // FINISH_SPEC R2: one screen — the result strip, the grid (found words
        // capsuled; after a reveal the missed ones outlined) scaled to the room
        // left, then the dock. The word list and the breakdown sit under More.
        <>
          <PuzzleFinished
            strip={
              <ResultStrip won={won} guesses={state.misses} guessLabel={state.misses === 1 ? 'miss' : 'misses'} time={formatTime(elapsedSeconds)} points={points}
                srText={`${won ? (gc === 10 ? 'Clean clear' : state.wordsShown ? 'Cleared with the list' : 'Grid cleared') : 'Revealed'}. ${state.found.length}/${state.words.length} found · ${missLabel} · ${formatTime(elapsedSeconds)}${state.hintsUsed ? ` · ${state.hintsUsed} hint${state.hintsUsed === 1 ? '' : 's'}` : ''}`} />
            }
            board={<div className="px-1 pb-1"><SpyglassGrid state={state} onSelect={() => {}} disabled revealMissing={!won} /></div>}
            dock={
              <FinishedDock currentMode="WORDSEARCH" isDaily={mode === 'daily'} onShare={handleShare} copied={copied}
                onNewPuzzle={mode !== 'daily' ? startPractice : undefined}
                extra={mode === 'daily' ? <DailyRankBadge gameMode="WORDSEARCH" /> : undefined} />
            }
            more={
              <MoreDisclosure label="Words & score" accent={WORDSEARCH_ACCENT}>
                <div className="flex flex-col gap-3">
                  {wordList}
                  <ScoreBreakdownCard gameMode="WORDSEARCH" completed={won} guessCount={gc} timeSeconds={elapsedSeconds}
                    boardsSolved={state.found.length} totalBoards={state.words.length} hintsUsed={state.hintsUsed} day={mode === 'daily' ? getTodayLocal() : undefined} />
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
