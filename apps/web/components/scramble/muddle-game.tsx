'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MORE_HOME_HREF } from '@/lib/more-games';
import dynamic from 'next/dynamic';
const VictoryAnimation = dynamic(() => import('@/components/effects/victory-animation').then(m => m.VictoryAnimation), { ssr: false });
const GameOverAnimation = dynamic(() => import('@/components/effects/game-over-animation').then(m => m.GameOverAnimation), { ssr: false });
import { Clock, Delete, XCircle } from 'lucide-react';
import {
  scramblePuzzleForDay, scramblePuzzleForSeed, scrambleDailyNumber, createScrambleState, scrambleReduce, scrambleMatchRow, scrambleGuessCount, scrambleBoardsSolved,
  scrambleActiveRow, scrambleFinalOpen, scrambleFinalLetters, SCRAMBLE_FINAL, SCRAMBLE_MAX_CHECKS, SCRAMBLE_TOTAL_BOARDS, generateDailySeed,
  type ScrambleState, type ScrambleAction, type ScrambleBank, type ScramblePuzzle,
} from '@wordle-duel/core';
import { bankSession, useSessionPuzzle } from '@/lib/bank-loader';
import { GameLoading } from '@/components/game/game-loading';
import { HOLIDAY_TABLE, holidayTitle } from '@/lib/holidays';
import { GameHomeButton } from '@/components/game/game-home-button';
import { GameGuideButton } from '@/components/game/game-guide-button';
import { GameHostTitle } from '@/components/ui/mascot';
import { SoundToggle } from '@/components/game/sound-toggle';
import { Keyboard } from '@/components/game/keyboard';
import { CartoonPanel, WordRow, FinalRow, MUDDLE_ACCENT, COLUMN_CLASS } from './muddle-board';
import { GameTray } from '@/components/ui/game-tray';
import { loadDailySave, saveDaily, loadPracticeSave, savePractice } from './persistence';
import { recordModePlayed } from '@/lib/play-limit-service';
import { shareResult } from '@/lib/share-utils';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult, recordSoloMatch, type XpResult } from '@/lib/stats-service';
import { XpToast } from '@/components/effects/xp-toast';
import { DailyRankBadge } from '@/components/game/daily-rank-badge';
import { getTodayLocal, fetchSolvedDailyRow } from '@/lib/daily-service';
import { useActivePlayTimer } from '@/hooks/use-active-play-timer';
import { useThrottledSave } from '@/hooks/use-throttled-save';
import { PlayClock } from '@/components/game/play-clock';
import { useCompletedElsewhere } from '@/hooks/use-completed-elsewhere';
import { PuzzleElsewhere, PuzzleFinished, FINISHED_SHELL_PAD } from '@/components/puzzles/finished-screen';
import { scrambleElsewhere } from '@/lib/elsewhere-progress';
import { isTypingTarget } from '@/lib/keyboard';
import { playInvalid, playKeyTap, playSuccess } from '@/lib/sounds';
import { haptic } from '@/lib/haptics';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { computeScoreBreakdown } from '@/lib/composite-scoring';
import { GameBackground } from '@/components/ui/page-background';
import { gameHeaderStyle, gameToastTop } from '@/lib/art';
import { FinishedDock, MoreDisclosure, ResultStrip } from '@/components/game/finished-kit';
import { candyClass } from '@/components/ui/candy-button';

// Muddle (More Games §5): unscramble four words; their circled letters spell
// the punchline that completes the caption under the cartoon. A full word
// checks itself (wrong = a mistake, letters go back); every check counts,
// thirteen lose. Hints (Letter 75, Solve 150) never count as checks.

// Puzzles are fetched one at a time from /banks (lib/bank-loader.ts; founder, 2026-09-29).
const BANK = bankSession<ScrambleBank, ScramblePuzzle>('scramble', (b, d) => scramblePuzzleForDay(b, d, HOLIDAY_TABLE), scramblePuzzleForSeed);

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
  const [loadFailed, setLoadFailed] = useState(false);
  const restoredRef = useRef(false);
  const hasRecordedRef = useRef(false);

  // Daily with no local save for today's seed → ask daily_results whether it
  // was finished on another device before showing a fresh puzzle (founder, 2026-09-28).
  const [noLocalSave, setNoLocalSave] = useState(false);
  const { checking, completion } = useCompletedElsewhere('SCRAMBLE', mode === 'daily' && noLocalSave);
  const holdPlay = checking || !!completion;
  // The finished puzzle (with its cartoon) and exact breakdown inputs from the matches row when today's daily was played elsewhere.
  const [elsewhere, setElsewhere] = useState<{ result: ReturnType<typeof scrambleElsewhere>; puzzle: ScramblePuzzle | null } | null>(null);

  const status = state?.status ?? 'playing';
  // The header clock ticks on its own (PlayClock); the board re-renders only on play (founder, 2026-09-29).
  const timer = useActivePlayTimer(!!state && status === 'playing' && !holdPlay, 0, { tick: false });
  const { elapsedSeconds, reset: resetTimer, getElapsed } = timer;

  const startPractice = useCallback(() => {
    const seed = `unlimited-SCRAMBLE-${Date.now()}`;
    BANK.seed(seed).then((p) => {
      if (!p) return;
      const s = createScrambleState(p, seed, Date.now());
      setState(s); setRow(scrambleActiveRow(s) ?? 0);
      setShowVictory(false); setShowGameOver(false); setXpResult(null); setMessage('');
      resetTimer(0);
      restoredRef.current = false; hasRecordedRef.current = false;
    }).catch(() => setLoadFailed(true));
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
      // The other-device check runs while the puzzle is fetched.
      setNoLocalSave(true);
      BANK.day(today).then((p) => {
        if (p) { const s = createScrambleState(p, seed, Date.now()); setState(s); setRow(0); }
        resetTimer(0);
        restoredRef.current = false;
      }).catch(() => setLoadFailed(true));
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

  // Never write the untouched fresh puzzle while the other-device check is
  // pending or positive: that save would hide the completed card on reload.
  useThrottledSave(!state || (mode === 'daily' && holdPlay) ? null : (sec) => {
    if (mode === 'daily') saveDaily(state.seed, state, sec);
    else savePractice(state.seed, state, sec);
  }, getElapsed, [state, mode, holdPlay]);

  // Played elsewhere today (founder, 2026-09-28: "make it exact everywhere"):
  // the matches row holds what daily_results does not — rows solved before the
  // thirteenth check and hints_used — so a loss scores the same partial
  // credit the phone recorded instead of assuming zero rows.
  useEffect(() => {
    if (!completion || !profile || mode !== 'daily') return;
    const today = getTodayLocal();
    const seed = generateDailySeed(today, 'SCRAMBLE');
    let cancelled = false;
    Promise.all([fetchSolvedDailyRow(profile.id, 'SCRAMBLE', seed), BANK.day(today)]).then(([row, puzzle]) => {
      if (cancelled || !row) return;
      setElsewhere({ result: scrambleElsewhere(row, { seed, won: completion.won, guessCount: completion.guesses }, puzzle), puzzle });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [completion, profile, mode]);

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
    const elapsedSeconds = getElapsed();
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
  }, [profile, state, getElapsed, mode]);

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

  // The bank entry behind this session (fresh or restored): its cartoon and holiday.
  const puzzle = useSessionPuzzle(BANK, state?.id, state?.seed);

  if (!state) return <GameLoading failed={loadFailed} />;

  const finished = state.status !== 'playing';
  const holiday = holidayTitle(puzzle?.holiday ?? null);
  const checksLabel = `${state.checks} check${state.checks === 1 ? '' : 's'}`;
  const captionParts = state.caption.split('____');
  // The other-device puzzle, when the matches row rebuilt it (rendered above the completed card).
  const es = elsewhere?.result.state ?? null;
  const esCaption = es ? es.caption.split('____') : null;
  const noop = () => {};
  // FINISH_SPEC R2: the finished board — the cartoon, the completed caption and
  // the punchline on the tray (purple once won, slate once lost), with the four
  // word rows collapsed to a summary (all of them under "See all words").
  const muddleFinishedBoard = (s: ScrambleState, caption: string[], cartoon: string | null, alt: string, isWon: boolean) => {
    const solvedWords = s.solved.slice(0, SCRAMBLE_FINAL).filter(Boolean).length;
    return (
      <div className="flex flex-col items-center px-1 pb-1">
        <CartoonPanel src={cartoon} alt={alt} fixed />
        <p className="shrink-0 text-center font-extrabold max-w-sm px-1 mt-1.5 line-clamp-2" style={{ fontSize: 14, lineHeight: 1.25, color: 'var(--color-text)' }}>
          {caption[0]}
          <span className="inline-block min-w-[3em] border-b-2 mx-1 align-baseline" style={{ borderColor: MUDDLE_ACCENT, color: '#5b21b6' }}>{s.final.answer.toLowerCase()}</span>
          {caption[1] ?? ''}
        </p>
        <GameTray accent={MUDDLE_ACCENT} state={isWon ? 'won' : 'lost'} padding={6} className={`${COLUMN_CLASS} flex flex-col shrink-0 mt-1.5`}>
          <FinalRow state={s} active={false} shaking={false} finished onSelect={noop} onTapTile={noop} onRevealLetter={noop} />
        </GameTray>
        <div className="mt-1.5 text-[11px] font-extrabold" style={{ color: 'var(--color-text-muted)' }}>
          {solvedWords} of {SCRAMBLE_FINAL} words solved{s.hintsUsed ? ` · ${s.hintsUsed} hint${s.hintsUsed === 1 ? '' : 's'}` : ''}
        </div>
      </div>
    );
  };
  const muddleWordRows = (s: ScrambleState, isWon: boolean) => (
    <GameTray accent={MUDDLE_ACCENT} state={isWon ? 'won' : 'lost'} padding={6} className={`${COLUMN_CLASS} flex flex-col shrink-0`}>
      {s.words.map((_, i) => (
        <WordRow key={i} state={s} row={i} active={false} shaking={false} finished onSelect={noop} onTapTile={noop} onRevealLetter={noop} onSolveWord={noop} />
      ))}
    </GameTray>
  );
  // Compact rule (§5, founder 2026-09-23): 30px capsules; the ::before pseudo stretches the hit target to 44px without adding height.
  // FINISH_SPEC A8: the action capsules are small glossy candy buttons (components/ui/candy-button.tsx).
  const capsule = (dim: boolean) => candyClass({ dim });
  const capsuleStyle = (_dim: boolean) => undefined;

  return (
    <GameBackground mode="SCRAMBLE" className="h-screen-stable flex flex-col relative" style={finished || completion ? FINISHED_SHELL_PAD : undefined}>
      {showVictory && <VictoryAnimation mode="SCRAMBLE" onComplete={() => setShowVictory(false)} guesses={state.checks} guessLabel="Checks" timeSeconds={elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={state.checks} guessLabel="Checks" timeSeconds={elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} flawlessStreak={xpResult.flawlessStreak} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      <div className="game-art-header text-center px-2 shrink-0 relative" style={gameHeaderStyle('SCRAMBLE', 36)}>
        <GameHomeButton accentColor={MUDDLE_ACCENT}  href={MORE_HOME_HREF} />
        <GameGuideButton slug="muddle" accentColor={MUDDLE_ACCENT} />
        <SoundToggle accentColor={MUDDLE_ACCENT} />
        <GameHostTitle mode="SCRAMBLE" label="Muddle">
          <h1 className="text-xl font-black leading-7" style={{ color: MUDDLE_ACCENT }}>MUDDLE</h1>
        </GameHostTitle>
        <div className="flex justify-center items-center gap-2 mt-0.5 text-[11px] leading-none font-bold" style={{ color: 'var(--color-text-muted)' }}>
          {mode === 'daily' && <span>#{scrambleDailyNumber(getTodayLocal())}</span>}
          {holiday && <span style={{ color: MUDDLE_ACCENT }}>{holiday}</span>}
          <span>{scrambleBoardsSolved(state)}/{SCRAMBLE_TOTAL_BOARDS} solved</span>
          <span>{checksLabel} · {SCRAMBLE_MAX_CHECKS - state.checks} left</span>
          <span><Clock className="w-3 h-3 inline mr-0.5" /><PlayClock timer={timer}>{formatTime}</PlayClock></span>
        </div>
        {message && (
          <div className="absolute left-0 right-0 z-20 text-center" style={{ top: gameToastTop(60) }}>
            <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-lg">{message}</span>
          </div>
        )}
      </div>

      {completion ? (
        // Today's daily was finished on another device (founder, 2026-09-28): the
        // cartoon, caption and the rows solved from the matches row, then the card.
        <PuzzleElsewhere dbKey="SCRAMBLE" completion={completion}
          boardsSolved={elsewhere?.result.progress.boardsSolved} totalBoards={elsewhere?.result.progress.totalBoards} hintsUsed={elsewhere?.result.progress.hintsUsed}
          moreExtra={es ? muddleWordRows(es, completion.won) : undefined}>
          {es && esCaption && muddleFinishedBoard(es, esCaption, elsewhere?.puzzle?.cartoon ?? null, elsewhere?.puzzle?.altText ?? 'Cartoon', completion.won)}
        </PuzzleElsewhere>
      ) : checking ? (
        // Header only while daily_results is read: no fresh-puzzle flash, no clock.
        <div className="flex-1 min-h-0" aria-busy="true" />
      ) : finished ? (
        // FINISH_SPEC R2: one screen — the result strip, the cartoon + caption +
        // punchline scaled to the room left, then the dock. The four word rows
        // collapse to a "N of 4 words" summary; "See all words" (More) holds
        // them with the score breakdown.
        <>
          <PuzzleFinished
            strip={
              <ResultStrip won={won} guesses={state.checks} guessLabel={state.checks === 1 ? 'check' : 'checks'} time={formatTime(elapsedSeconds)} points={points}
                srText={`${won ? (state.checks === 5 && state.hintsUsed === 0 ? 'Muddle solved clean' : 'Muddle solved') : 'Out of checks'}. ${scrambleBoardsSolved(state)}/${SCRAMBLE_TOTAL_BOARDS} solved · ${checksLabel} · ${formatTime(elapsedSeconds)}${state.hintsUsed ? ` · ${state.hintsUsed} hint${state.hintsUsed === 1 ? '' : 's'}` : ''}`} />
            }
            board={muddleFinishedBoard(state, captionParts, puzzle?.cartoon ?? null, puzzle?.altText ?? 'Cartoon', won)}
            dock={
              <FinishedDock currentMode="SCRAMBLE" isDaily={mode === 'daily'} onShare={handleShare} copied={copied}
                onNewPuzzle={mode !== 'daily' ? startPractice : undefined}
                extra={mode === 'daily' ? <DailyRankBadge gameMode="SCRAMBLE" /> : undefined} />
            }
            more={
              <MoreDisclosure label="See all words" accent={MUDDLE_ACCENT}>
                <div className="flex flex-col items-center gap-3">
                  {muddleWordRows(state, won)}
                  <ScoreBreakdownCard gameMode="SCRAMBLE" completed={won} guessCount={gc} timeSeconds={elapsedSeconds}
                    boardsSolved={scrambleBoardsSolved(state)} totalBoards={SCRAMBLE_TOTAL_BOARDS} hintsUsed={state.hintsUsed} day={mode === 'daily' ? getTodayLocal() : undefined} />
                </div>
              </MoreDisclosure>
            }
          />
          <BottomNav />
        </>
      ) : (
      <>
      {/* Compact rule (§5, founder 2026-09-23): one flex column — the cartoon
          flexes to the height left over (96px floor, 26vh cap), caption and
          words never shrink, and only this region scrolls on a short screen;
          the keyboard below is a fixed footer that never scrolls away. */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center px-3 pt-1">
        <CartoonPanel src={puzzle?.cartoon ?? null} alt={puzzle?.altText ?? 'Cartoon'} />
        <p className="shrink-0 text-center font-extrabold max-w-sm px-1 mt-1.5 line-clamp-2" style={{ fontSize: 14, lineHeight: 1.25, color: 'var(--color-text)' }}>
          {captionParts[0]}
          <span className="inline-block min-w-[3em] border-b-2 mx-1 align-baseline" style={{ borderColor: MUDDLE_ACCENT, color: '#5b21b6' }}>{state.solved[SCRAMBLE_FINAL] ? state.final.answer.toLowerCase() : ' '}</span>
          {captionParts[1] ?? ''}
        </p>
        {/* FINISH_SPEC L: the word rows sit on the shared game tray. */}
        <GameTray accent={MUDDLE_ACCENT} state="playing" padding={6} className={`${COLUMN_CLASS} flex flex-col shrink-0 mt-1.5`}>
          {state.words.map((_, i) => (
            <WordRow key={i} state={state} row={i} active={row === i} shaking={shakeRow === i} finished={false}
              onSelect={(r) => setRow(r)} onTapTile={(r, ch) => { setRow(r); dispatch({ type: 'TYPE', row: r, letter: ch }); playKeyTap(); }}
              onRevealLetter={(r) => { dispatch({ type: 'REVEAL_LETTER', row: r }); haptic('light'); }} onSolveWord={(r) => { dispatch({ type: 'SOLVE_WORD', row: r }); haptic('light'); }} />
          ))}
          <FinalRow state={state} active={row === SCRAMBLE_FINAL} shaking={shakeRow === SCRAMBLE_FINAL} finished={false}
            onSelect={() => setRow(SCRAMBLE_FINAL)} onTapTile={(ch) => { setRow(SCRAMBLE_FINAL); dispatch({ type: 'TYPE', row: SCRAMBLE_FINAL, letter: ch }); playKeyTap(); }}
            onRevealLetter={() => { dispatch({ type: 'REVEAL_LETTER', row: SCRAMBLE_FINAL }); haptic('light'); }} />
        </GameTray>
      </div>

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
      {void scrambleFinalLetters}
      </>
      )}
    </GameBackground>
  );
}
