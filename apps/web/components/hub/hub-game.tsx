'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from 'react';
import { MORE_HOME_HREF } from '@/lib/more-games';
import dynamic from 'next/dynamic';
const VictoryAnimation = dynamic(() => import('@/components/effects/victory-animation').then(m => m.VictoryAnimation), { ssr: false });
const GameOverAnimation = dynamic(() => import('@/components/effects/game-over-animation').then(m => m.GameOverAnimation), { ssr: false });
import { Clock, Delete, Shuffle, CornerDownLeft, Lightbulb, Eye, Flag } from 'lucide-react';
import {
  hubPuzzleForDay, hubPuzzleForSeed, hubDailyNumber, createHubState, hubReduce, hubMatchRow, hubRank, hubGuessCount, hubBoardsSolved,
  hubIsPangram, hubWordScore, HUB_RANKS, HUB_SOLVED_RANK, HUB_TOTAL_BOARDS, generateDailySeed,
  hubWordCount, hubWordsLabel, hubIsBonus, HUB_FOUND_LABEL,
  type HubState, type HubAction, type HubBank, type HubPuzzle, type HubReject,
} from '@wordle-duel/core';
import { bankSession } from '@/lib/bank-loader';
import { GameLoading } from '@/components/game/game-loading';
import { PlayClock } from '@/components/game/play-clock';
import { useThrottledSave } from '@/hooks/use-throttled-save';
import { GameHomeButton } from '@/components/game/game-home-button';
import { GameGuideButton } from '@/components/game/game-guide-button';
import { GameHostTitle } from '@/components/ui/mascot';
import { SoundToggle } from '@/components/game/sound-toggle';
import { HubRankBar, HubAllWordChips, HubHive, HubRareGem, hubRareLabel, HUB_ACCENT } from './hub-finished';
import { GameTray } from '@/components/ui/game-tray';
import { pieceSrc } from '@/lib/art';
import { hiveBox, hiveOffsets } from '@/lib/hive-layout';
import { prefersReducedMotion } from '@/lib/motion';

/** J1: the honeycomb's six outer positions and its box, in tile units. */
const HIVE_OFFSETS = hiveOffsets();
const HIVE_BOX = hiveBox();
import { loadDailySave, saveDaily, loadPracticeSave, savePractice } from './persistence';
import { recordModePlayed } from '@/lib/play-limit-service';
import { shareResult } from '@/lib/share-utils';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult, noteGuestDailyFinish, recordSoloMatch, type XpResult } from '@/lib/stats-service';
import { improveDailyRun } from '@/lib/daily-service';
import { XpToast } from '@/components/effects/xp-toast';
import { DailyRankBadge } from '@/components/game/daily-rank-badge';
import { getTodayLocal, fetchSolvedDailyRow } from '@/lib/daily-service';
import { useActivePlayTimer } from '@/hooks/use-active-play-timer';
import { useCompletedElsewhere } from '@/hooks/use-completed-elsewhere';
import { PuzzleElsewhere, PuzzleFinished, FINISHED_SHELL_PAD } from '@/components/puzzles/finished-screen';
import { hubElsewhere } from '@/lib/elsewhere-progress';
import { isTypingTarget } from '@/lib/keyboard';
import { playDelete, playInvalid, playKeyTap, playPangram, playSuccess } from '@/lib/sounds';
import { haptic } from '@/lib/haptics';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { computeScoreBreakdown } from '@/lib/composite-scoring';
import { GameBackground } from '@/components/ui/page-background';
import { gameHeaderStyle } from '@/lib/art';
import { FeedbackToast } from '@/components/game/feedback-toast';
import { FinishedDock, MoreDisclosure, ResultStrip } from '@/components/game/finished-kit';
import { CandyButton, candyClass } from '@/components/ui/candy-button';
import { hubTileSize } from '@/lib/hint-layout';
import { softPill } from '@/lib/soft-surface';

// Hubbub (More Games §12): seven letters, one required center, words of 4+
// letters. The game finalizes ONCE — reaching Hubbub (50% of max) is the win,
// "End puzzle" below it is the loss — and play continues after the win: each
// later rank-up goes through the improve path, which raises the leaderboard
// score and the matches row without paying XP twice.

// Puzzles are fetched one at a time from /banks (lib/bank-loader.ts; founder, 2026-09-29).
const BANK = bankSession<HubBank, HubPuzzle>('hub', (b, d) => hubPuzzleForDay(b, d), hubPuzzleForSeed);
export { HUB_ACCENT };
const REJECT_COPY: Record<HubReject, string> = {
  ended: 'This puzzle is finished',
  short: 'Four letters or more',
  centre: 'Must use the center letter',
  letters: 'Only the seven letters',
  found: 'Already found',
  notword: 'Not a word we know',
};

interface HubGameProps { isDaily?: boolean }

export function HubGame({ isDaily = false }: HubGameProps) {
  const { profile, isProActive } = useAuth();
  const isPro = isProActive;
  const mode: 'daily' | 'practice' = isDaily ? 'daily' : 'practice';

  const [state, setState] = useState<HubState | null>(null);
  const [typing, setTyping] = useState('');
  const [outer, setOuter] = useState<string[]>([]);
  const [view, setView] = useState<'board' | 'results'>('board');
  const [showVictory, setShowVictory] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const [shake, setShake] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const recordedRankRef = useRef(-1);   // -1 = never finalized
  const restoredRef = useRef(false);
  // Elapsed seconds when the current rank was recorded (finalize / improve).
  // After a win the clock keeps running while the player hunts on, but the
  // time results, the share and the leaderboard carry is THIS one (founder,
  // 2026-09-28; the same contract as iOS/Android). 0 = not recorded yet.
  const [recordedSeconds, setRecordedSeconds] = useState(0);

  // Daily with no local save for today's seed → ask daily_results whether it
  // was finished on another device before showing a fresh hive (founder, 2026-09-28).
  const [noLocalSave, setNoLocalSave] = useState(false);
  const { checking, completion } = useCompletedElsewhere('HUB', mode === 'daily' && noLocalSave);
  const holdPlay = checking || !!completion;
  // The finished hive (rank, points, words) and exact breakdown inputs from the matches row when today's daily was played elsewhere.
  const [elsewhere, setElsewhere] = useState<ReturnType<typeof hubElsewhere> | null>(null);

  const status = state?.status ?? 'playing';
  // The clock runs only while the board itself is in front: not under the
  // victory/game-over card, not on results, never once the puzzle has ended,
  // and not while the other-device check holds the board back.
  const running = !!state && !state.ended && view === 'board' && !showVictory && !showGameOver && !holdPlay;
  // The header clock ticks on its own (PlayClock); the board re-renders only on play (founder, 2026-09-29).
  const timer = useActivePlayTimer(running, 0, { tick: false });
  const { elapsedSeconds, reset: resetTimer, getElapsed } = timer;

  const startPractice = useCallback(() => {
    const seed = `unlimited-HUB-${Date.now()}`;
    BANK.seed(seed).then((p) => {
      if (!p) return;
      setState(createHubState(p, seed, Date.now()));
      setOuter(p.letters.slice(1).split(''));
      setTyping(''); setView('board'); setShowVictory(false); setShowGameOver(false); setXpResult(null); setMessage('');
      resetTimer(0); setRecordedSeconds(0);
      recordedRankRef.current = -1; restoredRef.current = false;
    }).catch(() => setLoadFailed(true));
  }, [resetTimer]);

  // Old saves (before recordedSeconds) that had already recorded a rank fall back to their elapsed time.
  const restoreRecordedSeconds = (saved: { recordedSeconds?: number; elapsedSeconds: number; recordedRank: number }) =>
    setRecordedSeconds(saved.recordedSeconds || (saved.recordedRank >= 0 ? saved.elapsedSeconds : 0));

  useEffect(() => {
    if (mode === 'daily') {
      const today = getTodayLocal();
      const seed = generateDailySeed(today, 'HUB');
      const saved = loadDailySave(seed);
      if (saved) {
        setState(saved.state); setOuter(saved.state.letters.slice(1).split('')); resetTimer(saved.elapsedSeconds); restoreRecordedSeconds(saved);
        recordedRankRef.current = saved.recordedRank; restoredRef.current = saved.state.status !== 'playing';
        // A won-but-unfinished daily reopens on results (clock paused), never mid-hunt with the clock moving.
        if (saved.state.ended || saved.state.status !== 'playing') setView('results');
        return;
      }
      // The other-device check runs while the puzzle is fetched.
      setNoLocalSave(true);
      BANK.day(today).then((p) => {
        if (p) { setState(createHubState(p, seed, Date.now())); setOuter(p.letters.slice(1).split('')); }
        resetTimer(0);
      }).catch(() => setLoadFailed(true));
    } else {
      const saved = loadPracticeSave();
      if (saved) {
        setState(saved.state); setOuter(saved.state.letters.slice(1).split('')); resetTimer(saved.elapsedSeconds); restoreRecordedSeconds(saved);
        recordedRankRef.current = saved.recordedRank; restoredRef.current = saved.state.status !== 'playing';
        if (saved.state.ended || saved.state.status !== 'playing') setView('results');
        return;
      }
      startPractice();
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Never write the untouched fresh hive while the other-device check is
  // pending or positive: that save would hide the completed card on reload.
  useThrottledSave(!state || (mode === 'daily' && holdPlay) ? null : (sec) => {
    if (mode === 'daily') saveDaily(state.seed, state, sec, recordedRankRef.current, recordedSeconds);
    else savePractice(state.seed, state, sec, recordedRankRef.current, recordedSeconds);
  }, getElapsed, [state, recordedSeconds, mode, holdPlay]);

  // Played elsewhere today (founder, 2026-09-28: "make it exact everywhere"):
  // the matches row holds what daily_results does not — the points behind the
  // 20 score-fraction boards and hints_used (both raised by every later
  // rank-up through improveDailyRun) — so the card scores what the phone did.
  useEffect(() => {
    if (!completion || !profile || mode !== 'daily') return;
    const today = getTodayLocal();
    const seed = generateDailySeed(today, 'HUB');
    let cancelled = false;
    Promise.all([fetchSolvedDailyRow(profile.id, 'HUB', seed), BANK.day(today)]).then(([row, p]) => {
      if (cancelled || !row) return;
      setElsewhere(hubElsewhere(row, { seed, won: completion.won, guessCount: completion.guesses }, p));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [completion, profile, mode]);

  // A repeated "+5" replays the popup (seq re-keys it); a new flash restarts the 1.4 s clear.
  const [flashSeq, setFlashSeq] = useState(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback((m: string) => {
    setMessage(m); setFlashSeq((n) => n + 1);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setMessage(''), 1400);
  }, []);

  // The time a won run is scored, shown and shared with: the recorded time,
  // never the still-moving clock (falls back to elapsed for pre-field saves).
  const isWon = state?.status === 'won';
  const scoredSeconds = isWon ? (recordedSeconds || elapsedSeconds) : elapsedSeconds;

  // ── Recording: finalize once, then improve on every later rank-up ─────────
  const points = state ? computeScoreBreakdown('HUB', isWon, hubGuessCount(hubRank(state)), scoredSeconds, hubBoardsSolved(state.points, state.max), HUB_TOTAL_BOARDS, state.hintsUsed).total : 0;

  const finalise = useCallback((s: HubState) => {
    if (recordedRankRef.current >= 0) return;
    const elapsedSeconds = getElapsed();
    const rank = hubRank(s);
    recordedRankRef.current = rank;
    setRecordedSeconds(elapsedSeconds);
    const won = s.status === 'won';
    const gc = hubGuessCount(rank);
    const seed = mode === 'daily' ? s.seed : undefined;
    // Guest: today's daily still flips Home (the optimistic path, no server).
    if (!profile) { noteGuestDailyFinish('HUB', won, gc, elapsedSeconds * 1000, seed, hubBoardsSolved(s.points, s.max), HUB_TOTAL_BOARDS, s.hintsUsed); return; }
    recordGameResult(profile.id, 'HUB', 'solo', won, gc, elapsedSeconds * 1000, seed, hubBoardsSolved(s.points, s.max), HUB_TOTAL_BOARDS, s.hintsUsed)
      .then((xp) => { if (xp) setXpResult(xp); });
    const row = hubMatchRow(s);
    recordSoloMatch({
      userId: profile.id, gameMode: 'HUB', won, score: gc, timeSeconds: elapsedSeconds, seed: s.seed,
      solutions: row.solutions, guesses: row.guesses,
      startedAtIso: new Date(Date.now() - elapsedSeconds * 1000).toISOString(), hintsUsed: s.hintsUsed,
    });
  }, [profile, mode, getElapsed]);

  const improve = useCallback((s: HubState) => {
    if (!profile || recordedRankRef.current < 0) return;
    const elapsedSeconds = getElapsed();
    const rank = hubRank(s);
    if (rank <= recordedRankRef.current) return;
    recordedRankRef.current = rank;
    setRecordedSeconds(elapsedSeconds);   // the time for the rank now on the board
    if (mode !== 'daily') return;   // Unlimited has no leaderboard row to raise
    const row = hubMatchRow(s);
    improveDailyRun({
      userId: profile.id, gameMode: 'HUB', seed: s.seed, completed: s.status === 'won',
      guessCount: hubGuessCount(rank), timeSeconds: elapsedSeconds,
      boardsSolved: hubBoardsSolved(s.points, s.max), totalBoards: HUB_TOTAL_BOARDS, hintsUsed: s.hintsUsed, guesses: row.guesses,
    });
  }, [profile, mode, getElapsed]);

  const dispatch = useCallback((a: HubAction) => {
    setState((s) => {
      if (!s) return s;
      const next = hubReduce(s, a, Date.now());
      if (a.type === 'SUBMIT') {
        if (next.reject) { flash(REJECT_COPY[next.reject]); haptic('medium'); playInvalid(); setShake(true); setTimeout(() => { setShake(false); setTyping(''); }, 450); }
        else {
          setTyping('');
          const word = a.word.toUpperCase();
          // Every accepted word scores (founder, 2026-09-25) — one message for all of them.
          if (hubIsPangram(word, s.letters)) playPangram(); else { haptic('light'); playSuccess(); } flash(hubIsPangram(word, s.letters) ? `Pangram! +${hubWordScore(word, s.letters)}` : `+${hubWordScore(word, s.letters)}`);
        }
      } else if (a.type === 'HINT_START' || a.type === 'HINT_REVEAL') { if (next.hintsUsed > s.hintsUsed) playKeyTap(); }
      return next;
    });
  }, [flash]);

  // Terminal transitions: first finalization → overlay + record; later rank-ups → improve.
  const lastRankRef = useRef(-1);
  useEffect(() => {
    if (!state) return;
    const rank = hubRank(state);
    if (state.status !== 'playing' && recordedRankRef.current < 0) {
      // Freeze the win time here too, so a signed-out player's card and results agree.
      if (!restoredRef.current) { setRecordedSeconds(getElapsed()); if (state.status === 'won') setShowVictory(true); else setShowGameOver(true); }
      recordModePlayed('hubbub');
      finalise(state);
      restoredRef.current = false;
    } else if (state.status === 'won' && rank > lastRankRef.current && lastRankRef.current >= 0) {
      improve(state);
      if (rank > recordedRankRef.current - 1 && !state.ended) flash(`Rank up: ${HUB_RANKS[rank].name}`);
    }
    lastRankRef.current = rank;
    if (state.ended) setView('results');
  }, [state?.status, state?.points, state?.ended]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (profile && state && state.status !== 'playing' && recordedRankRef.current < 0) finalise(state); }, [profile, state, finalise]);

  // ── Input ────────────────────────────────────────────────────────────────
  const type = useCallback((ch: string) => { if (state && !state.ended && typing.length < 19) setTyping((t) => t + ch); }, [state, typing.length]);
  const del = useCallback(() => setTyping((t) => t.slice(0, -1)), []);
  const submit = useCallback(() => { if (!state || state.ended) return; if (typing.length < 4) { flash('Four letters or more'); return; } dispatch({ type: 'SUBMIT', word: typing }); }, [state, typing, dispatch, flash]);
  // 2.8 item 32: the shuffle is a tile flip — the six outer hexes turn over in a quick ripple and land on
  // their new letters (rotateY on the GPU, 220 ms each, 36 ms apart: about 400 ms in all, center stays).
  // `shown` holds the OLD letters until each hex is edge-on, then swaps it. Reduce Motion: an instant swap.
  const [shown, setShown] = useState<string[] | null>(null);
  const hiveRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<string[]>([]);
  outerRef.current = outer;
  const shuffle = useCallback(() => {
    const before = outerRef.current;
    const next = [...before];
    for (let i = next.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [next[i], next[j]] = [next[j], next[i]]; }
    setOuter(next);
    playKeyTap();
    const hexes = hiveRef.current?.querySelectorAll<HTMLElement>('[data-outer]');
    if (prefersReducedMotion() || !hexes || hexes.length === 0 || typeof hexes[0].animate !== 'function') return;
    setShown(before);
    hexes.forEach((hex, i) => {
      const inner = hex.querySelector<HTMLElement>('.hive-hex-in');
      inner?.animate(
        [{ transform: 'perspective(500px) rotateY(0deg)' }, { transform: 'perspective(500px) rotateY(90deg)', offset: 0.5 }, { transform: 'perspective(500px) rotateY(0deg)' }],
        { duration: 220, delay: i * 36, easing: 'ease-in-out' },
      );
      window.setTimeout(() => setShown((cur) => (cur ? cur.map((c, j) => (j === i ? next[j] : c)) : cur)), 110 + i * 36);
    });
    window.setTimeout(() => setShown(null), 220 + hexes.length * 36 + 40);
  }, []);
  const hintStart = useCallback(() => dispatch({ type: 'HINT_START' }), [dispatch]);
  const hintReveal = useCallback(() => dispatch({ type: 'HINT_REVEAL' }), [dispatch]);
  const endPuzzle = useCallback(() => { dispatch({ type: 'END' }); setView('results'); }, [dispatch]);
  // "I'm done" / Finish after a win: same END as before, results show the recorded time.
  const finish = useCallback(() => { setShowVictory(false); endPuzzle(); }, [endPuzzle]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e) || !state || state.ended || view !== 'board') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') { submit(); return; }
      if (e.key === 'Backspace' || e.key === 'Delete') { del(); return; }
      if (e.key === ' ') { e.preventDefault(); shuffle(); return; }
      const k = e.key.toUpperCase();
      if (/^[A-Z]$/.test(k) && state.letters.includes(k)) type(k);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, view, submit, del, shuffle, type]);

  const handleShare = useCallback(async () => {
    if (!state) return;
    const rank = hubRank(state);
    const out = await shareResult({
      layout: 'hub', mode: 'Hubbub', won: rank >= HUB_SOLVED_RANK,
      guesses: hubGuessCount(rank), maxGuesses: 10, timeSeconds: scoredSeconds,
      rankName: HUB_RANKS[rank].name, pct: Math.floor((state.points * 100) / Math.max(1, state.max)), wordsFound: state.found.length, wordCount: state.words.length,
      pangramsFound: state.found.filter((w) => state.pangrams.includes(w)).length,
      puzzleNumber: mode === 'daily' ? hubDailyNumber(getTodayLocal()) : undefined, points,
    });
    if (out.via !== 'failed') { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }, [state, scoredSeconds, mode, points]);

  const formatTime = (s: number) => { const m = Math.floor(s / 60), sec = s % 60; return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`; };

  const sortedFound = useMemo(() => state ? [...state.found, ...state.bonusFound].sort() : [], [state]);
  // Board flow shows found words newest first (plan §12 layout rule); results keep the alphabetical list.
  // Every accepted word is one list in the order it was found (the event log keeps that order
  // across the core list and the rarer words); nothing is labeled "bonus" any more.
  const newestFound = useMemo(() => state ? state.events.filter((e) => /^[+=!]/.test(e)).map((e) => e.slice(1)).reverse() : [], [state]);

  // Layout rule (plan §12, founder 2026-09-24): the 2-3-2 cluster is the hero and scales to the
  // screen. Tile side = clamp((board column height − rank bar − entry line − control rows − found
  // header − End link) / 3.3, 72px, 100px), measured with a ResizeObserver on the column and its
  // fixed rows; a width guard (column width / 3.6) keeps three tiles inside a narrow column.
  // Until the first measurement a CSS clamp with an estimated fixed height stands in.
  const colRef = useRef<HTMLDivElement>(null);
  const fixedRefs = useRef<(HTMLElement | null)[]>([]);
  const setFixed = (i: number) => (el: HTMLElement | null) => { fixedRefs.current[i] = el; };
  const [tile, setTile] = useState<number | null>(null);
  const hasState = !!state;
  useEffect(() => {
    const col = colRef.current;
    if (!col || view !== 'board' || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      setTile(hubTileSize(col.clientHeight, col.clientWidth, fixedRefs.current.map((el) => el?.offsetHeight ?? 0)));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(col);
    fixedRefs.current.forEach((el) => { if (el) ro.observe(el); });
    measure();
    return () => ro.disconnect();
  }, [view, hasState]);
  const tileCss = tile != null ? `${tile}px` : 'clamp(72px, calc((100dvh - 340px) / 3.3), 100px)';

  if (!state) return <GameLoading failed={loadFailed} />;

  const centre = state.letters[0];
  const rank = hubRank(state);
  const rankName = HUB_RANKS[rank].name;
  const won = state.status === 'won';
  // FINISH_SPEC A8: the action capsules are small glossy candy buttons (components/ui/candy-button.tsx).
  const capsule = (dim: boolean, filled = false) => candyClass({ dim, color: filled ? 'amber' : 'purple' });
  const capsuleStyle = (_dim: boolean, _filled = false) => undefined;

  // FINISH_SPEC J1: the hive letters are glossy HEXAGONS — art-piece-hex
  // (lilac) for the six outer letters, art-piece-hex-center (gold) for the
  // required center letter — laid out as a honeycomb; the letter is drawn on
  // top (white, dark amber on the gold center). Tap = squish + type pop.
  const popHex = (el: HTMLElement) => {
    if (prefersReducedMotion()) return;
    const inner = el.querySelector<HTMLElement>('.hive-hex-in');
    if (!inner) return;
    inner.classList.remove('gt-pop');
    void inner.offsetWidth;
    inner.classList.add('gt-pop');
  };
  const letterTile = (ch: string, isCentre: boolean, at?: [number, number]) => (
    <button key={isCentre ? `${ch}-c` : `o${at ? at.join('_') : ''}`} data-outer={isCentre ? undefined : ''} type="button" onClick={(e) => { haptic('light'); playKeyTap(); type(ch); popHex(e.currentTarget); }} disabled={state.ended}
      className="hive-hex absolute shrink-0 p-0 border-0 bg-transparent"
      style={{
        width: 'var(--tile)', height: 'var(--tile)',
        left: `calc(50% - var(--tile) / 2 + var(--tile) * ${at ? at[0].toFixed(4) : 0})`,
        top: `calc(50% - var(--tile) / 2 + var(--tile) * ${at ? at[1].toFixed(4) : 0})`,
      } as React.CSSProperties}
      aria-label={isCentre ? `${ch}, center letter` : ch}>
      <span className="hive-hex-in absolute inset-0 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pieceSrc(isCentre ? 'hex-center' : 'hex')} alt="" aria-hidden="true" draggable={false} width={256} height={256}
          className="absolute inset-0 w-full h-full pointer-events-none select-none" style={{ filter: 'drop-shadow(0 3px 5px rgba(60, 30, 110, 0.22))' }} />
        <b className="absolute inset-0 flex items-center justify-center font-black uppercase"
          style={{ fontSize: 'calc(var(--tile) * 0.42)', lineHeight: 1, paddingBottom: 'calc(var(--tile) * 0.04)', color: isCentre ? '#7a3d00' : '#ffffff',
            textShadow: isCentre ? '0 1px 0 rgba(255, 255, 255, 0.55)' : '0 1px 1px rgba(0, 0, 0, 0.25), 0 2px 3px rgba(40, 10, 80, 0.3)' }}>
          {ch}
        </b>
      </span>
    </button>
  );

  // A function of the state it draws so the other-device hive (rebuilt from the
  // matches row) shares the live board's rank bar (founder, 2026-09-28).
  const renderRankBar = (s: HubState, points = true) => <HubRankBar state={s} points={points} />;
  // On the board the header already says "N/M pts", so the rank bar keeps only "N to <next>".
  const rankBar = renderRankBar(state, false);

  // Every word of the puzzle once it has ended: found ones solid (pangrams in the accent), the rest muted.
  const allWordChips = (s: HubState) => <HubAllWordChips state={s} />;

  const wordChips = (words: string[], dim = false) => words.map((w) => {
    const pangram = state.pangrams.includes(w);
    const revealed = state.revealed.includes(w);
    // A rarer word scores but sits outside the N/M words count: the corner gem (button family, 10-05).
    const bonus = !pangram && hubIsBonus(state.bonusFound, w);
    return (
      <span key={w} className={`relative inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${dim ? 'opacity-60' : ''}`}
        aria-label={bonus ? hubRareLabel(w) : undefined}
        // A1: tinted chips — pangrams in the accent, revealed words violet, the rest brand lilac.
        style={pangram ? { ...softPill(HUB_ACCENT, { bar: false }), color: HUB_ACCENT } : revealed ? { ...softPill('#8b5cf6', { bar: false }), color: '#8b5cf6' } : { ...softPill('#7c3aed', { bar: false }), color: 'var(--color-text)' }}>
        {w}{pangram ? ' ★' : ''}{bonus && <HubRareGem />}
      </span>
    );
  });

  // Play screen (plan §12 layout rule): a flex column filling the shell — rank bar, entry line,
  // cluster band (flex: 1, cluster centered), two control rows, found-words header + wrapping chip
  // flow (flex: 1, scrolls, newest first), End link pinned at the bottom. The fixed rows carry
  // refs so the tile formula can subtract them from the column height.
  // Soft filled amber chips (no outline): "AB… · 6 letters" for each hinted word not yet found.
  const pendingHintChips = state.hinted.filter((w) => !state.found.includes(w)).map((w) => (
    <span key={`hint-${w}`} className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(245, 165, 36, 0.2)', color: '#92400e' }} aria-label={`Hint: starts with ${w.slice(0, 2)}, ${w.length} letters`}>
      <Lightbulb className="w-3 h-3" fill="#f5a524" color="#b45309" strokeWidth={2} aria-hidden="true" />
      {w.slice(0, 2)}… · {w.length} letters
    </span>
  ));
  const boardView = (
    <div ref={colRef} className="flex-1 min-h-0 flex flex-col px-3">
      <div ref={setFixed(0)} className="shrink-0 pt-1 pb-2">{rankBar}</div>
      {/* Entry line — 28px bold type, the centre letter in the accent; shakes and erases on a rejected word. */}
      {/* The feedback popup (+5, Rank up…) sits over this line, just above the hive — never on the title art. */}
      <div ref={setFixed(1)} className="shrink-0 pb-1 relative">
        <div className={`flex justify-center items-center min-h-[44px] ${shake ? 'animate-shake' : ''}`} aria-live="polite" aria-label={typing ? `Typing ${typing}` : 'Type a word'}>
          {typing
            ? <span className="font-black uppercase tracking-wider leading-none break-all text-center" style={{ fontSize: 28, color: 'var(--color-text)' }}>
                {typing.split('').map((ch, i) => <span key={i} style={ch === centre ? { color: HUB_ACCENT } : undefined}>{ch}</span>)}
              </span>
            : <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>Tap letters or type · Space shuffles</span>}
        </div>
        <FeedbackToast message={message} seq={flashSeq} />
      </div>
      {/* Cluster band — the hero. --tile drives the hexagons' side and type size together. */}
      <div className="flex-1 flex items-center justify-center">
        {/* FINISH_SPEC J1 + L: the honeycomb (center + six around) on the shared game tray. */}
        <GameTray accent={HUB_ACCENT} state={state.ended ? (won ? 'won' : 'lost') : 'playing'} padding={10}>
          <div ref={hiveRef} className="relative" role="group" aria-label="Hive letters"
            style={{ '--tile': tileCss, width: `calc(var(--tile) * ${HIVE_BOX[0].toFixed(3)})`, height: `calc(var(--tile) * ${HIVE_BOX[1].toFixed(3)})` } as CSSProperties}>
            {letterTile(centre, true)}
            {(shown ?? outer).slice(0, 6).map((ch, i) => letterTile(ch, false, HIVE_OFFSETS[i]))}
          </div>
        </GameTray>
      </div>
      <div ref={setFixed(2)} className="shrink-0 flex flex-col items-center gap-2 pt-3 pb-2">
        <div className="flex justify-center gap-2" role="group" aria-label="Entry controls">
          <button type="button" onClick={() => { haptic('light'); playDelete(); del(); }} className={capsule(false)} style={capsuleStyle(false)} aria-label="Delete"><Delete className="w-3.5 h-3.5" /> Delete</button>
          <button type="button" onClick={shuffle} className={capsule(false)} style={capsuleStyle(false)} aria-label="Shuffle"><Shuffle className="w-3.5 h-3.5" /> Shuffle</button>
          <button type="button" onClick={() => { haptic('light'); submit(); }} className={capsule(false, true)} style={capsuleStyle(false, true)} aria-label="Enter"><CornerDownLeft className="w-3.5 h-3.5" /> Enter</button>
        </div>
        <div className="flex justify-center gap-2" role="group" aria-label="Hints">
          <button type="button" onClick={hintStart} className={capsule(false)} style={capsuleStyle(false)} aria-label="Starts with"><Lightbulb className="w-3.5 h-3.5" /> Starts with…</button>
          <button type="button" onClick={hintReveal} className={capsule(false)} style={capsuleStyle(false)} aria-label="Reveal a word"><Eye className="w-3.5 h-3.5" /> Reveal a word</button>
        </div>
      </div>
      {/* Found words — header, then a wrapping chip flow that fills the lower area and scrolls once it overflows. */}
      <div className="flex-1 min-h-0 flex flex-col w-full max-w-md mx-auto">
        <div ref={setFixed(3)} className="shrink-0 text-[10px] font-black tracking-wider pb-1 text-center" style={{ color: 'var(--color-text-muted)' }}>
          {/* A label, never a second count: the header's hubWordsLabel is the one word count (Doug 10-05: 8 vs 18). */}
          {HUB_FOUND_LABEL}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Pending "Starts with…" hints lead the found-words flow (which already scrolls). As a row
              under the hint buttons they were a fixed row, so the honeycomb shrank on every hint. */}
          <div className="flex flex-wrap justify-center gap-x-1.5 gap-y-2.5 pt-2 pb-1">{pendingHintChips}{wordChips(newestFound)}</div>
        </div>
      </div>
      <div ref={setFixed(4)} className="shrink-0 pb-3 pt-2 flex justify-center gap-3 text-xs font-bold">
        {won
          ? <button type="button" onClick={finish} className={candyClass({ color: 'amber' })}><Flag className="w-3.5 h-3.5" /> Finish</button>
          : <button type="button" onClick={endPuzzle} className={candyClass({ color: 'peach' })}><Flag className="w-3.5 h-3.5" /> End puzzle and see answers</button>}
      </div>
    </div>
  );

  // FINISH_SPEC R2: the results on one screen — the strip (words · time ·
  // points), the rank bar + the hive + a words summary scaled to the room
  // left, Keep going (a won hunt that has not ended) right above the dock.
  // Every word (or the words found so far) and the breakdown sit under More.
  const pangramsFound = (s: HubState) => s.found.filter((w) => s.pangrams.includes(w)).length;
  // `words`: the other-device card has no strip, so it says the word count here; results don't (the strip does).
  const hubFinishedBoard = (s: HubState, words = true) => (
    <div className="flex flex-col items-center gap-2 px-1 pb-1">
      <div className="w-full">{renderRankBar(s)}</div>
      <HubHive state={s} />
      <div className="text-[11px] font-extrabold text-center" style={{ color: 'var(--color-text-muted)' }}>
        {words ? `${hubWordsLabel(s)} · ` : ''}{pangramsFound(s)}/{s.pangrams.length} pangram{s.pangrams.length === 1 ? '' : 's'} · {Math.floor((s.points * 100) / Math.max(1, s.max))}%
      </div>
    </div>
  );
  const allWordsBlock = (s: HubState, ended: boolean) => (
    <div className="w-full max-w-md mx-auto">
      <div className="text-[10px] font-black tracking-wider mb-1 text-center" style={{ color: 'var(--color-text-muted)' }}>
        {ended ? 'ALL WORDS' : `FOUND SO FAR · ${s.words.length - s.found.length} MORE TO FIND`}
      </div>
      <div className="flex flex-wrap justify-center gap-x-1.5 gap-y-2.5 pt-1.5">
        {ended ? allWordChips(s) : wordChips(sortedFound)}
      </div>
    </div>
  );

  const resultsView = (
    <>
      <PuzzleFinished
        strip={
          <ResultStrip won={won} guesses={`${hubWordCount(state).found}/${hubWordCount(state).total}`} guessLabel="words" time={formatTime(scoredSeconds)} points={points}
            srText={`${won ? `${rankName}${rank === 9 ? ' — every word' : ''}` : `${rankName} — below Hubbub`}. ${state.points}/${state.max} pts · ${state.found.length}/${state.words.length} words · ${pangramsFound(state)}/${state.pangrams.length} pangram${state.pangrams.length === 1 ? '' : 's'} · ${formatTime(scoredSeconds)}${state.hintsUsed ? ` · ${state.hintsUsed} hint${state.hintsUsed === 1 ? '' : 's'}` : ''}`} />
        }
        board={hubFinishedBoard(state, false)}
        beforeDock={!state.ended ? <CandyButton size="sm" color="purple" onClick={() => setView('board')}>Keep going</CandyButton> : undefined}
        dock={
          <FinishedDock currentMode="HUB" isDaily={mode === 'daily'} onShare={handleShare} copied={copied}
            onNewPuzzle={mode !== 'daily' ? startPractice : undefined}
            extra={mode === 'daily' ? <DailyRankBadge gameMode="HUB" /> : undefined} />
        }
        more={
          <MoreDisclosure label={state.ended ? 'See all words' : 'Words so far'} accent={HUB_ACCENT}>
            <div className="flex flex-col gap-3">
              {allWordsBlock(state, state.ended)}
              <ScoreBreakdownCard gameMode="HUB" completed={won} guessCount={hubGuessCount(rank)} timeSeconds={scoredSeconds}
                boardsSolved={hubBoardsSolved(state.points, state.max)} totalBoards={HUB_TOTAL_BOARDS} hintsUsed={state.hintsUsed} day={mode === 'daily' ? getTodayLocal() : undefined} />
            </div>
          </MoreDisclosure>
        }
      />
      <BottomNav />
    </>
  );

  return (
    <GameBackground mode="HUB" className="h-screen-stable flex flex-col relative" style={view === 'results' || completion ? FINISHED_SHELL_PAD : undefined}>
      {/* Victory card (founder, 2026-09-28): the clock is paused under it; the time is the
          moment of the win. "Keep playing" resumes the hunt, "I'm done" ends the puzzle. */}
      {showVictory && <VictoryAnimation mode="HUB" onComplete={() => setShowVictory(false)} guesses={state.found.length} guessLabel="Words" timeSeconds={recordedSeconds || elapsedSeconds} points={points}
        actions={[{ label: 'Keep playing', onClick: () => setShowVictory(false), primary: true }, { label: "I'm done", onClick: finish }]} />}
      {showGameOver && <GameOverAnimation onComplete={() => setShowGameOver(false)} guesses={state.found.length} guessLabel="Words" timeSeconds={recordedSeconds || elapsedSeconds} points={points} onPlayAgain={mode !== 'daily' && isPro ? startPractice : undefined} />}
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} flawlessStreak={xpResult.flawlessStreak} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}

      <div className="game-art-header text-center px-2 shrink-0 relative" style={gameHeaderStyle('HUB')}>
        <GameHomeButton accentColor={HUB_ACCENT}  href={MORE_HOME_HREF} />
        <GameGuideButton slug="hubbub" accentColor={HUB_ACCENT} />
        <SoundToggle accentColor={HUB_ACCENT} />
        <GameHostTitle mode="HUB" label="Hubbub">
          <h1 className="text-2xl font-black" style={{ color: HUB_ACCENT }}>HUBBUB</h1>
        </GameHostTitle>
        <div className="flex justify-center items-center gap-2 mt-1 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
          {mode === 'daily' && <span>#{hubDailyNumber(getTodayLocal())}</span>}
          {/* The one "N/M words · pts" line (hubWordsLabel), on the board only: results carry the
              count in their strip and the other-device card in its own summary — never twice. */}
          {view === 'board' && !completion && !checking && <>
            <span>{hubWordsLabel(state)}</span>
            <span>{state.points}/{state.max} pts</span>
          </>}
          {/* After a win the header clock keeps moving on the board ("· playing on" says why);
              once the puzzle ends it freezes on the recorded time. */}
          {won && (state.ended || view !== 'board')
            ? <span><Clock className="w-3 h-3 inline mr-0.5" />{formatTime(scoredSeconds)}</span>
            : <span><Clock className="w-3 h-3 inline mr-0.5" /><PlayClock timer={timer}>{formatTime}</PlayClock>{won && <span className="font-medium opacity-70"> · playing on</span>}</span>}
        </div>
      </div>

      {completion ? (
        // Today's daily was finished on another device (founder, 2026-09-28): the
        // rank reached and every word (found ones solid) from the matches row, then the card.
        <PuzzleElsewhere dbKey="HUB" completion={completion}
          boardsSolved={elsewhere?.progress?.boardsSolved} totalBoards={elsewhere?.progress?.totalBoards} hintsUsed={elsewhere?.progress?.hintsUsed}
          moreExtra={elsewhere?.state ? allWordsBlock(elsewhere.state, true) : undefined}>
          {elsewhere?.state && hubFinishedBoard(elsewhere.state)}
        </PuzzleElsewhere>
      ) : checking ? (
        // Header only while daily_results is read: no fresh-hive flash, no clock.
        <div className="flex-1 min-h-0" aria-busy="true" />
      ) : view === 'board' ? boardView : resultsView}
    </GameBackground>
  );
}
