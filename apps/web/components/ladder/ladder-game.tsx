'use client';

import { keyDuringReject } from '@/lib/tile-motion';
import { useRejectRow } from '@/hooks/use-reject-row';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MORE_HOME_HREF } from '@/lib/more-games';
import dynamic from 'next/dynamic';
const VictoryAnimation = dynamic(() => import('@/components/effects/victory-animation').then(m => m.VictoryAnimation), { ssr: false });
const GameOverAnimation = dynamic(() => import('@/components/effects/game-over-animation').then(m => m.GameOverAnimation), { ssr: false });
import { Clock, Undo2, Lightbulb } from 'lucide-react';
import {
  ladderPuzzleForDay, ladderPuzzleForSeed, ladderDailyNumber, createLadderState, ladderReduce, ladderMatchRow, ladderGuessCount, ladderMaxMoves,
  generateDailySeed, getAllowedWordsForLength, type LadderState, type LadderAction, type LadderBank, type LadderPuzzle, type LadderReject,
} from '@wordle-duel/core';
import { bankSession } from '@/lib/bank-loader';
import { GameLoading } from '@/components/game/game-loading';
import { useDictionary } from '@/lib/init-dictionary';
import { GameHomeButton } from '@/components/game/game-home-button';
import { GameGuideButton } from '@/components/game/game-guide-button';
import { GameHostTitle } from '@/components/ui/mascot';
import { SoundToggle } from '@/components/game/sound-toggle';
import { Keyboard } from '@/components/game/keyboard';
import { LadderBoard, LadderSummary, LADDER_ACCENT } from './ladder-board';
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
import { ladderElsewhere } from '@/lib/elsewhere-progress';
import { isTypingTarget } from '@/lib/keyboard';
import { playInvalid, playKeyTap } from '@/lib/sounds';
import { haptic } from '@/lib/haptics';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { computeScoreBreakdown } from '@/lib/composite-scoring';
import { GameBackground } from '@/components/ui/page-background';
import { gameHeaderStyle } from '@/lib/art';
import { FeedbackToast } from '@/components/game/feedback-toast';
import { FinishedDock, MoreDisclosure, ResultStrip } from '@/components/game/finished-kit';
import { candyClass } from '@/components/ui/candy-button';
import { HintCountBadge } from '@/components/ui/hint-kit';

// Letter Ladder (More Games §15): change one letter at a time from START to
// END. Rejected entries are free; every accepted word is a move; the budget
// is par + 5; Undo is free but spent moves stay spent; Hint places the next
// rung on a shortest path and counts as a move. guess_count = moves − par + 1.

// Puzzles are fetched one at a time from /banks (lib/bank-loader.ts; founder, 2026-09-29).
const BANK = bankSession<LadderBank, LadderPuzzle>('ladder', (b, d) => ladderPuzzleForDay(b, d), ladderPuzzleForSeed);
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

/** Rungs are checked against the 5-letter list, which loads on demand (founder, 2026-09-29). */
export function LadderGame(props: LadderGameProps) {
  return useDictionary([5]) ? <LadderGameInner {...props} /> : <GameLoading />;
}

function LadderGameInner({ isDaily = false }: LadderGameProps) {
  const { profile, isProActive } = useAuth();
  const isPro = isProActive;
  const mode: 'daily' | 'practice' = isDaily ? 'daily' : 'practice';

  const [state, setState] = useState<LadderState | null>(null);
  const [typing, setTyping] = useState('');
  const [invalid, setInvalid] = useState(false);
  const { isShaking: shaking, reject: rejectRow, cutShort: cutReject } = useRejectRow(() => { setInvalid(false); setTyping(''); });
  const [showVictory, setShowVictory] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const restoredRef = useRef(false);
  const hasRecordedRef = useRef(false);

  // The engine's dictionary: the 5-letter allowed list, uppercased once.
  const allowed = useMemo(() => { return new Set(getAllowedWordsForLength(5).map((w) => w.toUpperCase())); }, []);

  // Daily with no local save for today's seed → ask daily_results whether it
  // was finished on another device before showing a fresh ladder (founder, 2026-09-28).
  const [noLocalSave, setNoLocalSave] = useState(false);
  const { checking, completion } = useCompletedElsewhere('LADDER', mode === 'daily' && noLocalSave);
  const holdPlay = checking || !!completion;
  // The finished ladder and exact breakdown inputs from the matches row when today's daily was played elsewhere.
  const [elsewhere, setElsewhere] = useState<ReturnType<typeof ladderElsewhere> | null>(null);

  const status = state?.status ?? 'playing';
  // The header clock ticks on its own (PlayClock); the board re-renders only on play (founder, 2026-09-29).
  const timer = useActivePlayTimer(!!state && status === 'playing' && !holdPlay, 0, { tick: false });
  const { elapsedSeconds, reset: resetTimer, getElapsed } = timer;

  const startPractice = useCallback(() => {
    const seed = `unlimited-LADDER-${Date.now()}`;
    BANK.seed(seed).then((p) => {
      if (!p) return;
      setState(createLadderState(p, seed, Date.now()));
      setTyping(''); setShowVictory(false); setShowGameOver(false); setXpResult(null); setMessage('');
      resetTimer(0);
      restoredRef.current = false;
      hasRecordedRef.current = false;
    }).catch(() => setLoadFailed(true));
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
      // The other-device check runs while the puzzle is fetched.
      setNoLocalSave(true);
      BANK.day(today).then((p) => {
        if (p) setState(createLadderState(p, seed, Date.now()));
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

  // Never write the untouched fresh ladder while the other-device check is
  // pending or positive: that save would hide the completed card on reload.
  useThrottledSave(!state || (mode === 'daily' && holdPlay) ? null : (sec) => {
    if (mode === 'daily') saveDaily(state.seed, state, sec);
    else savePractice(state.seed, state, sec);
  }, getElapsed, [state, mode, holdPlay]);

  // Played elsewhere today (founder, 2026-09-28: "make it exact everywhere"):
  // the matches row holds what daily_results does not — hints_used and the
  // rungs — so the card scores the same inputs the phone recorded.
  useEffect(() => {
    if (!completion || !profile || mode !== 'daily') return;
    const today = getTodayLocal();
    const seed = generateDailySeed(today, 'LADDER');
    let cancelled = false;
    Promise.all([fetchSolvedDailyRow(profile.id, 'LADDER', seed), BANK.day(today)]).then(([row, p]) => {
      if (cancelled || !row) return;
      setElsewhere(ladderElsewhere(row, { seed, won: completion.won, guessCount: completion.guesses }, p?.id));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [completion, profile, mode]);

  const flash = useCallback((m: string) => { setMessage(m); setTimeout(() => setMessage(''), 1400); }, []);

  const dispatch = useCallback((a: LadderAction) => {
    setState((s) => {
      if (!s) return s;
      const next = ladderReduce(s, a, allowed, Date.now());
      if (a.type === 'SUBMIT') {
        if (next.reject) {
          flash(REJECT_COPY[next.reject]); haptic('medium'); playInvalid();
          setInvalid(true); rejectRow(s.words[0]?.length ?? 5);
        } else { setTyping(''); playKeyTap(); }
      } else if (a.type === 'HINT' && next.words.length > s.words.length) { setTyping(''); }
      return next;
    });
  }, [allowed, flash, rejectRow]);

  const recordResult = useCallback(() => {
    const elapsedSeconds = getElapsed();
    if (!state || hasRecordedRef.current) return;
    if (state.status !== 'won' && state.status !== 'lost') return;
    hasRecordedRef.current = true;
    const won = state.status === 'won';
    const gc = ladderGuessCount(state);
    const seed = mode === 'daily' ? state.seed : undefined;
    // Guest: today's daily still flips Home (the optimistic path, no server).
    if (!profile) { noteGuestDailyFinish('LADDER', won, gc, elapsedSeconds * 1000, seed, won ? 1 : 0, 1, state.hintsUsed); return; }
    recordGameResult(profile.id, 'LADDER', 'solo', won, gc, elapsedSeconds * 1000, seed, won ? 1 : 0, 1, state.hintsUsed)
      .then((xp) => { if (xp) setXpResult(xp); });
    const row = ladderMatchRow(state);
    recordSoloMatch({
      userId: profile.id, gameMode: 'LADDER', won, score: gc, timeSeconds: elapsedSeconds, seed: state.seed,
      solutions: row.solutions, guesses: row.guesses,
      startedAtIso: new Date(Date.now() - elapsedSeconds * 1000).toISOString(), hintsUsed: state.hintsUsed,
    });
  }, [profile, state, getElapsed, mode]);

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
    // AQ1: a key during a not-a-word reject cuts it short; it's never dropped.
    let word = typing;
    if (shaking) { cutReject(); word = ''; if (keyDuringReject(key) === 'swallow') return; }
    if (key === 'ENTER') { if (word.length === 5) dispatch({ type: 'SUBMIT', word }); else flash('Five letters, please'); return; }
    if (key === 'BACK') { setTyping((t) => t.slice(0, -1)); return; }
    if (/^[A-Z]$/.test(key) && word.length < 5) setTyping((t) => t + key);
  }, [state, typing, shaking, cutReject, dispatch, flash]);
  const undo = useCallback(() => { dispatch({ type: 'UNDO' }); setTyping(''); }, [dispatch]);
  const hint = useCallback(() => dispatch({ type: 'HINT' }), [dispatch]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;
      if (!state || state.status !== 'playing') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') onKey('ENTER');
      else if (e.key === 'Backspace' || e.key === 'Delete') onKey('BACK');
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

  if (!state) return <GameLoading failed={loadFailed} />;

  const finished = state.status !== 'playing';
  const won = state.status === 'won';
  const gc = ladderGuessCount(state);
  const movesLeft = Math.max(0, ladderMaxMoves(state) - state.moves);
  // FINISH_SPEC A8: the action capsules are small glossy candy buttons (components/ui/candy-button.tsx).
  const capsule = (dim: boolean) => candyClass({ dim });
  const capsuleStyle = (_dim: boolean) => undefined;

  return (
    <GameBackground mode="LADDER" className="h-screen-stable flex flex-col relative" style={finished || completion ? FINISHED_SHELL_PAD : undefined}>
      {showVictory && <VictoryAnimation mode="LADDER" onComplete={() => setShowVictory(false)} guesses={state.moves} guessLabel="Moves" timeSeconds={elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={state.moves} guessLabel="Moves" timeSeconds={elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} flawlessStreak={xpResult.flawlessStreak} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      <div className="game-art-header text-center px-2 shrink-0 relative" style={gameHeaderStyle('LADDER')}>
        <GameHomeButton accentColor={LADDER_ACCENT}  href={MORE_HOME_HREF} />
        <GameGuideButton slug="letter-ladder" accentColor={LADDER_ACCENT} />
        <SoundToggle accentColor={LADDER_ACCENT} />
        <GameHostTitle mode="LADDER" label="Letter Ladder">
          <h1 className="text-2xl font-black" style={{ color: LADDER_ACCENT }}>LETTER LADDER</h1>
        </GameHostTitle>
        <div className="relative flex justify-center items-center gap-2 mt-1 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
          {mode === 'daily' && <span>#{ladderDailyNumber(getTodayLocal())}</span>}
          <span>Par {state.par}</span>
          <span>{state.moves} move{state.moves === 1 ? '' : 's'} · {movesLeft} left</span>
          <span><Clock className="w-3 h-3 inline mr-0.5" /><PlayClock timer={timer}>{formatTime}</PlayClock></span>
          <FeedbackToast message={message} />
        </div>
      </div>

      {completion ? (
        // Today's daily was finished on another device (founder, 2026-09-28): the
        // day's rungs from the matches row (a loss shows the shortest path muted), then the card.
        <PuzzleElsewhere dbKey="LADDER" completion={completion}
          boardsSolved={elsewhere?.progress.boardsSolved} totalBoards={elsewhere?.progress.totalBoards} hintsUsed={elsewhere?.progress.hintsUsed}
          moreExtra={elsewhere?.state ? <LadderBoard state={elsewhere.state} typing="" invalid={false} shaking={false} revealPath={!completion.won} /> : undefined}>
          {elsewhere?.state && <LadderSummary state={elsewhere.state} />}
        </PuzzleElsewhere>
      ) : checking ? (
        // Header only while daily_results is read: no fresh-board flash, no clock.
        <div className="flex-1 min-h-0" aria-busy="true" />
      ) : !finished ? (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto flex items-start justify-center px-3 pb-1 pt-1">
            <LadderBoard state={state} typing={typing} invalid={invalid} shaking={shaking} revealPath={false} />
          </div>
          <div className="shrink-0 pb-2 px-2 pt-1 flex flex-col gap-2">
            <div className="flex justify-center gap-2 px-1" role="group" aria-label="Ladder controls">
              <button type="button" onClick={() => { haptic('light'); playKeyTap(); undo(); }} disabled={state.words.length <= 1} className={capsule(state.words.length <= 1)} style={capsuleStyle(state.words.length <= 1)} aria-label="Undo">
                <Undo2 className="w-3.5 h-3.5" /> Undo
              </button>
              {/* The count is a corner coin, never in the label, so the row never shifts (lib/hint-layout.ts). */}
              <button type="button" onClick={() => { haptic('light'); playKeyTap(); hint(); }} className={capsule(false)} style={capsuleStyle(false)} aria-label={state.hintsUsed > 0 ? `Hint (${state.hintsUsed} used)` : 'Hint'}>
                <Lightbulb className="w-3.5 h-3.5" /> Hint<HintCountBadge count={state.hintsUsed} />
              </button>
            </div>
            <Keyboard onKey={onKey} />
          </div>
        </>
      ) : (
        // FINISH_SPEC R2: one screen — the result strip, the ladder collapsed
        // to a summary (START · +N steps · last rung; a loss names one shortest
        // route) scaled to the room left, then the dock. "See all steps" (More)
        // holds the full ladder and the score breakdown.
        <>
          <PuzzleFinished
            strip={
              <ResultStrip won={won} guesses={state.moves} guessLabel={`move${state.moves === 1 ? '' : 's'} · par ${state.par}`} time={formatTime(elapsedSeconds)} points={points}
                srText={`${won ? (gc === 1 ? 'Ladder climbed on par' : 'Ladder climbed') : 'Out of moves'}. ${won
                  ? `${state.moves} move${state.moves === 1 ? '' : 's'} · Par ${state.par} · ${formatTime(elapsedSeconds)}${state.hintsUsed ? ` · ${state.hintsUsed} hint${state.hintsUsed === 1 ? '' : 's'}` : ''}`
                  : `${state.moves} moves · Par ${state.par} · ${formatTime(elapsedSeconds)}`}`} />
            }
            board={<div className="flex justify-center px-1 pb-1"><LadderSummary state={state} /></div>}
            dock={
              <FinishedDock currentMode="LADDER" isDaily={mode === 'daily'} onShare={handleShare} copied={copied}
                onNewPuzzle={mode !== 'daily' ? startPractice : undefined}
                extra={mode === 'daily' ? <DailyRankBadge gameMode="LADDER" /> : undefined} />
            }
            more={
              <MoreDisclosure label="See all steps" accent={LADDER_ACCENT}>
                <div className="flex flex-col items-center gap-3">
                  <LadderBoard state={state} typing="" invalid={false} shaking={false} revealPath={!won} />
                  <ScoreBreakdownCard gameMode="LADDER" completed={won} guessCount={gc} timeSeconds={elapsedSeconds}
                    boardsSolved={won ? 1 : 0} totalBoards={1} hintsUsed={state.hintsUsed} day={mode === 'daily' ? getTodayLocal() : undefined} />
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
