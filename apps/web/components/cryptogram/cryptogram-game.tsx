'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const VictoryAnimation = dynamic(() => import('@/components/effects/victory-animation').then(m => m.VictoryAnimation), { ssr: false });
const GameOverAnimation = dynamic(() => import('@/components/effects/game-over-animation').then(m => m.GameOverAnimation), { ssr: false });
import { Clock, Delete, CheckCheck, Lightbulb, Eye } from 'lucide-react';
import {
  cryptogramPuzzleForDay, cryptogramPuzzleForSeed, cryptogramDailyNumber, createCryptogramState, cryptogramReduce, cryptogramMatchRow,
  cryptogramGuessCount, cryptogramCodeLetters, cryptogramConflicts, CRYPTOGRAM_ALPHABET, CRYPTOGRAM_REVEAL_AFTER_SECONDS, CRYPTOGRAM_TOTAL_BOARDS,
  generateDailySeed, type CryptogramState, type CryptogramAction, type CryptogramBank,
} from '@wordle-duel/core';
import cryptogramBankJson from '@/data/cryptogram-puzzles.json';
import { HOLIDAY_TABLE, holidayTitle } from '@/lib/holidays';
import { GameHomeButton } from '@/components/game/game-home-button';
import { GameGuideButton } from '@/components/game/game-guide-button';
import { SoundToggle } from '@/components/game/sound-toggle';
import { Keyboard } from '@/components/game/keyboard';
import { CipherBoard, FrequencyStrip, CRYPTOGRAM_ACCENT } from './cipher-board';
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

// Codebreaker (More Games §16): decode a saying written in a substitution
// cipher. Three letters are given. Letters are pencil — set, change and clear
// freely. Check (counts, guess_count = min(checks,3)+1) locks right letters and
// clears wrong ones; Hint (100) reveals the most frequent unresolved letter;
// Reveal (after 5:00) shows the answer and records a loss. The puzzle
// completes itself the moment every letter is right.

const BANK = cryptogramBankJson as unknown as CryptogramBank;

interface CryptogramGameProps { isDaily?: boolean }

export function CryptogramGame({ isDaily = false }: CryptogramGameProps) {
  const { profile, isProActive } = useAuth();
  const isPro = isProActive;
  const mode: 'daily' | 'practice' = isDaily ? 'daily' : 'practice';

  const [state, setState] = useState<CryptogramState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showVictory, setShowVictory] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const restoredRef = useRef(false);
  const hasRecordedRef = useRef(false);

  const status = state?.status ?? 'playing';
  const { elapsedSeconds, reset: resetTimer } = useActivePlayTimer(!!state && status === 'playing', 0);

  /** Reading-order code letters that are not yet resolved (unmapped, or mapped but not locked). */
  const nextOpen = useCallback((s: CryptogramState, after: string | null): string | null => {
    const order: string[] = [];
    for (const ch of s.cipher) if (CRYPTOGRAM_ALPHABET.includes(ch) && !order.includes(ch)) order.push(ch);
    const open = order.filter((c) => !s.locked.includes(c) && !s.mapping[c]);
    if (!open.length) { const any = order.filter((c) => !s.locked.includes(c)); return any.find((c) => c !== after) ?? any[0] ?? null; }
    const i = after ? order.indexOf(after) : -1;
    return open.find((c) => order.indexOf(c) > i) ?? open[0];
  }, []);

  const startPractice = useCallback(() => {
    const seed = `unlimited-CRYPTOGRAM-${Date.now()}`;
    const p = cryptogramPuzzleForSeed(BANK, seed);
    if (!p) return;
    const s = createCryptogramState(p, seed, Date.now());
    setState(s); setSelected(nextOpen(s, null));
    setShowVictory(false); setShowGameOver(false); setXpResult(null); setMessage('');
    resetTimer(0);
    restoredRef.current = false; hasRecordedRef.current = false;
  }, [resetTimer, nextOpen]);

  useEffect(() => {
    if (mode === 'daily') {
      const today = getTodayLocal();
      const seed = generateDailySeed(today, 'CRYPTOGRAM');
      const saved = loadDailySave(seed);
      if (saved) {
        setState(saved.state); setSelected(nextOpen(saved.state, null)); resetTimer(saved.elapsedSeconds);
        const done = saved.state.status !== 'playing';
        restoredRef.current = done; hasRecordedRef.current = done;
        return;
      }
      const p = cryptogramPuzzleForDay(BANK, today, HOLIDAY_TABLE);
      if (p) { const s = createCryptogramState(p, seed, Date.now()); setState(s); setSelected(nextOpen(s, null)); }
      resetTimer(0);
      restoredRef.current = false;
    } else {
      const saved = loadPracticeSave();
      if (saved) {
        setState(saved.state); setSelected(nextOpen(saved.state, null)); resetTimer(saved.elapsedSeconds);
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

  const dispatch = useCallback((a: CryptogramAction) => {
    setState((s) => {
      if (!s) return s;
      const next = cryptogramReduce(s, a, Date.now());
      if (a.type === 'CHECK') {
        if (next.lastWrong.length) { flash(`${next.lastWrong.length} wrong letter${next.lastWrong.length === 1 ? '' : 's'} cleared`); haptic('medium'); playInvalid(); }
        else { flash('Everything pencilled is right'); playSuccess(); }
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
    const gc = cryptogramGuessCount(state.checks);
    const seed = mode === 'daily' ? state.seed : undefined;
    recordGameResult(profile.id, 'CRYPTOGRAM', 'solo', won, gc, elapsedSeconds * 1000, seed, won ? 1 : 0, CRYPTOGRAM_TOTAL_BOARDS, state.hintsUsed)
      .then((xp) => { if (xp) setXpResult(xp); });
    const row = cryptogramMatchRow(state);
    recordSoloMatch({
      userId: profile.id, gameMode: 'CRYPTOGRAM', won, score: gc, timeSeconds: elapsedSeconds, seed: state.seed,
      solutions: row.solutions, guesses: row.guesses,
      startedAtIso: new Date(Date.now() - elapsedSeconds * 1000).toISOString(), hintsUsed: state.hintsUsed,
    });
  }, [profile, state, elapsedSeconds, mode]);

  useEffect(() => {
    if (!state || state.status === 'playing') return;
    if (!restoredRef.current) { if (state.status === 'won') { setShowVictory(true); playSuccess(); } else setShowGameOver(true); }
    recordModePlayed('codebreaker');
    recordResult();
    restoredRef.current = false;
  }, [state?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (profile && state && state.status !== 'playing') recordResult(); }, [profile, recordResult, state]);

  const setLetter = useCallback((plain: string) => {
    if (!state || state.status !== 'playing' || !selected) return;
    if (state.locked.includes(selected)) { flash('That letter is locked'); return; }
    dispatch({ type: 'SET', code: selected, plain });
    playKeyTap();
    setSelected(nextOpen({ ...state, mapping: { ...state.mapping, [selected]: plain } }, selected));
  }, [state, selected, dispatch, flash, nextOpen]);
  const clearLetter = useCallback(() => {
    if (!state || state.status !== 'playing' || !selected) return;
    if (state.locked.includes(selected)) { flash('That letter is locked'); return; }
    if (state.mapping[selected]) dispatch({ type: 'SET', code: selected, plain: null });
    playKeyTap();
  }, [state, selected, dispatch, flash]);
  const onKey = useCallback((key: string) => {
    if (!state || state.status !== 'playing') return;
    if (key === 'ENTER') { setSelected((sel) => nextOpen(state, sel)); return; }
    if (key === 'BACK') { clearLetter(); return; }
    if (/^[A-Z]$/.test(key)) setLetter(key);
  }, [state, setLetter, clearLetter, nextOpen]);
  const check = useCallback(() => { if (state && Object.keys(state.mapping).some((c) => !state.locked.includes(c))) dispatch({ type: 'CHECK' }); else flash('Pencil some letters first'); }, [state, dispatch, flash]);
  const hint = useCallback(() => { dispatch({ type: 'HINT' }); haptic('light'); }, [dispatch]);
  const reveal = useCallback(() => { if (elapsedSeconds >= CRYPTOGRAM_REVEAL_AFTER_SECONDS) dispatch({ type: 'REVEAL' }); }, [dispatch, elapsedSeconds]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;
      if (!state || state.status !== 'playing') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowRight') { e.preventDefault(); onKey('ENTER'); }
      else if (e.key === 'Backspace' || e.key === 'Delete') onKey('BACK');
      else if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key.toUpperCase());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state, onKey]);

  const won = state?.status === 'won';
  const gc = state ? cryptogramGuessCount(state.checks) : 1;
  const points = state ? computeScoreBreakdown('CRYPTOGRAM', won, gc, elapsedSeconds, won ? 1 : 0, CRYPTOGRAM_TOTAL_BOARDS, state.hintsUsed).total : 0;

  const handleShare = useCallback(async () => {
    if (!state) return;
    const out = await shareResult({
      layout: 'cryptogram', mode: 'Codebreaker', won, guesses: gc, maxGuesses: 4, timeSeconds: elapsedSeconds,
      cipher: state.cipher, checks: state.checks, puzzleNumber: mode === 'daily' ? cryptogramDailyNumber(getTodayLocal()) : undefined, points,
    });
    if (out.via !== 'failed') { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }, [state, elapsedSeconds, mode, points, won, gc]);

  const formatTime = (s: number) => { const m = Math.floor(s / 60), sec = s % 60; return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`; };

  if (!state) return null;

  const finished = state.status !== 'playing';
  const codes = cryptogramCodeLetters(state.cipher);
  const resolved = codes.filter((c) => state.locked.includes(c) || state.mapping[c]).length;
  const conflicts = cryptogramConflicts(state.mapping);
  const revealIn = Math.max(0, CRYPTOGRAM_REVEAL_AFTER_SECONDS - elapsedSeconds);
  const holiday = holidayTitle((BANK.holiday && Object.keys(BANK.holiday).find((k) => BANK.holiday![k].some((q) => q.id === state.id))) ?? null);
  const checksLabel = state.checks === 0 ? 'No checks' : `${state.checks} check${state.checks === 1 ? '' : 's'}`;
  const capsule = (dim: boolean) => `flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${dim ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'hover:opacity-80'}`;
  const capsuleStyle = (dim: boolean) => dim ? undefined : { borderColor: `${CRYPTOGRAM_ACCENT}66`, color: CRYPTOGRAM_ACCENT, background: `${CRYPTOGRAM_ACCENT}0d` };

  return (
    <div className={`h-screen-stable flex flex-col relative ${finished ? 'pb-[calc(env(safe-area-inset-bottom)+64px)]' : ''}`} style={{ backgroundColor: 'var(--color-bg)' }}>
      {showVictory && <VictoryAnimation onComplete={() => setShowVictory(false)} guesses={state.checks} guessLabel="Checks" timeSeconds={elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={state.checks} guessLabel="Checks" timeSeconds={elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} flawlessStreak={xpResult.flawlessStreak} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      <div className="text-center py-2 px-2 shrink-0 relative">
        <GameHomeButton accentColor={CRYPTOGRAM_ACCENT} />
        <GameGuideButton slug="codebreaker" accentColor={CRYPTOGRAM_ACCENT} />
        <SoundToggle accentColor={CRYPTOGRAM_ACCENT} />
        <h1 className="text-2xl font-black" style={{ color: CRYPTOGRAM_ACCENT }}>CODEBREAKER</h1>
        <div className="flex justify-center items-center gap-2 mt-1 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
          {mode === 'daily' && <span>#{cryptogramDailyNumber(getTodayLocal())}</span>}
          {holiday && <span style={{ color: CRYPTOGRAM_ACCENT }}>{holiday}</span>}
          <span>{resolved}/{codes.length} letters</span>
          <span>{checksLabel}</span>
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
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-start gap-3 px-2 pb-1 pt-2">
            <CipherBoard state={state} selected={selected} onSelect={(c) => { setSelected(c); playKeyTap(); }} finished={false} />
            {conflicts.length > 0 && <div className="text-[11px] font-bold" style={{ color: '#dc2626' }}>{conflicts.join(', ')} used for two code letters</div>}
            <FrequencyStrip state={state} selected={selected} onSelect={(c) => setSelected(c)} />
          </div>
          <div className="shrink-0 pb-2 px-2 pt-1 flex flex-col gap-2">
            <div className="flex justify-center gap-2 px-1 flex-wrap" role="group" aria-label="Codebreaker controls">
              <button type="button" onClick={() => { haptic('light'); clearLetter(); }} className={capsule(false)} style={capsuleStyle(false)} aria-label="Delete the selected letter">
                <Delete className="w-3.5 h-3.5" /> Delete
              </button>
              <button type="button" onClick={() => { haptic('light'); playKeyTap(); check(); }} className={capsule(false)} style={capsuleStyle(false)} aria-label="Check the pencilled letters">
                <CheckCheck className="w-3.5 h-3.5" /> Check{state.checks > 0 ? ` · ${state.checks}` : ''}
              </button>
              <button type="button" onClick={() => { playKeyTap(); hint(); }} className={capsule(false)} style={capsuleStyle(false)} aria-label="Hint: reveal one letter">
                <Lightbulb className="w-3.5 h-3.5" /> Hint{state.hintsUsed > 0 ? ` · ${state.hintsUsed}` : ''}
              </button>
              <button type="button" onClick={() => { haptic('medium'); reveal(); }} disabled={revealIn > 0} className={capsule(revealIn > 0)} style={capsuleStyle(revealIn > 0)} aria-label={revealIn > 0 ? `Reveal available in ${formatTime(revealIn)}` : 'Reveal the answer (records a loss)'}>
                <Eye className="w-3.5 h-3.5" /> {revealIn > 0 ? `Reveal · ${formatTime(revealIn)}` : 'Reveal'}
              </button>
            </div>
            <Keyboard onKey={onKey} />
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-col items-center gap-3 px-3 py-3">
              <CipherBoard state={state} selected={null} onSelect={() => {}} finished />
              <p className="text-center text-base font-extrabold max-w-md" style={{ color: 'var(--color-text)' }}>“{state.text}”</p>
            </div>
            <div className="px-4 pb-4 animate-fade-in-up">
              <div className="flex items-center gap-3 rounded-xl p-3 bg-white border border-gray-100 shadow-sm">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-xl font-black"
                  style={{ backgroundColor: `${CRYPTOGRAM_ACCENT}15`, border: `2px solid ${CRYPTOGRAM_ACCENT}44`, color: CRYPTOGRAM_ACCENT }}>
                  {won ? (state.checks === 0 ? '✓' : state.checks) : '✗'}
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className={`text-sm font-bold ${won ? 'text-green-600' : 'text-red-500'}`}>
                    {won ? (state.checks === 0 ? 'Code cracked clean' : 'Code cracked') : 'Answer revealed'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {`${checksLabel} · ${formatTime(elapsedSeconds)}${state.hintsUsed ? ` · ${state.hintsUsed} hint${state.hintsUsed === 1 ? '' : 's'}` : ''}`}
                  </span>
                  <div className="flex items-center gap-3 mt-0.5">
                    <Link href="/" className="text-gray-400 text-xs font-bold underline">Home</Link>
                    <button onClick={handleShare} className="text-blue-500 text-xs font-bold underline">{copied ? 'Copied!' : 'Share'}</button>
                    {mode === 'daily' && <DailyRankBadge gameMode="CRYPTOGRAM" />}
                    {mode !== 'daily' && isPro && <button onClick={startPractice} className="text-xs font-bold underline" style={{ color: CRYPTOGRAM_ACCENT }}>Play Again</button>}
                  </div>
                </div>
              </div>
              <ScoreBreakdownCard gameMode="CRYPTOGRAM" completed={won} guessCount={gc} timeSeconds={elapsedSeconds}
                boardsSolved={won ? 1 : 0} totalBoards={CRYPTOGRAM_TOTAL_BOARDS} hintsUsed={state.hintsUsed} day={mode === 'daily' ? getTodayLocal() : undefined} />
              {mode === 'daily' && <NextDailyCta currentMode="CRYPTOGRAM" />}
            </div>
          </div>
          <BottomNav />
        </>
      )}
    </div>
  );
}
