'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  GameMode,
  generateDailySeed,
  generateSolutionsFromSeed,
  generateSolutionsFromSeedForLength,
  evaluateGuess,
} from '@wordle-duel/core';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SocketIOMatchService, type OpponentGuessLogEntry } from '@/lib/adapters/match-service';
import { SwappableMatchService, LocalBotMatchService, CPU_OPPONENT_PREFIX, tierFromCpuId } from '@/lib/adapters/bot-match-service';
import { BOT_PERSONAS, tierLabel, botLine, type BotDifficulty, type BotTier } from '@/lib/bot/bot-personas';
import { recordCpuGame, loadCpuProgression } from '@/lib/bot/cpu-progression';
import { PhotoFinish, type PhotoFinishKind } from '@/components/effects/photo-finish';
import { usePresenceId } from '@/lib/presence-id';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult, recordMatch, recordCpuResult, type XpResult } from '@/lib/stats-service';
import { fetchHeadToHead, fetchVsProfile, type HeadToHeadRecord, type VsProfile } from '@/lib/head-to-head';
import { XpToast } from '@/components/effects/xp-toast';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';
import { markInviteAcceptedByCode } from '@/lib/invite-service';
import { playOpponentThunk } from '@/lib/sounds';
import { Crown, Loader2, Home, RotateCcw, Share2, Trophy, X, Swords, Bot, Lock } from 'lucide-react';
import { GameHomeButton } from '@/components/game/game-home-button';
import { Confetti } from '@/components/effects/confetti';
import { MatchIntro, headToHeadLine } from './match-intro';
import { VsMatchHeader } from './vs-match-header';
import { FinalBoards, ComparisonBars } from './vs-result-detail';
import { OpponentMiniBoard, OpponentMultiMiniBoard } from './opponent-mini-board';
import {
  hasPlayedModeToday,
  recordModePlayed,
  getSecondsUntilMidnightLocal,
  formatCountdown,
} from '@/lib/play-limit-service';
import { VsLimitModal } from '@/components/modals/vs-limit-modal';
import { getTodayUTC } from '@/lib/daily-service';

import { VsClassic } from './vs-classic';
import { VsQuadword } from './vs-quadword';
import { VsOctoword } from './vs-octoword';
import { VsSuccession } from './vs-succession';
import { VsDeliverance } from './vs-deliverance';
import { VsGauntlet } from './vs-gauntlet';
import { VsProperNoundle } from './vs-propernoundle';

const WAITING_PHRASES = [
  'Searching',
  'Scanning',
  'Seeking',
  'Matching',
  'Pairing',
  'Connecting',
  'Locating',
  'Scouting',
  'Hunting',
  'Queuing',
  'Polling',
  'Awaiting',
  'Preparing',
  'Loading',
  'Syncing',
  'Summoning',
  'Fetching',
  'Probing',
  'Browsing',
  'Rallying',
];

function CyclingStatus() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % WAITING_PHRASES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <p
      key={index}
      className="text-gray-500 text-lg font-bold animate-fade-in-up"
    >
      {WAITING_PHRASES[index]}...
    </p>
  );
}

interface VsGameProps {
  mode: GameMode;
  /**
   * Private-match invite code. When present, joinQueue routes through
   * the server's private-lobby map so the two invitees pair directly,
   * skipping the public queue.
   */
  inviteCode?: string;
  /**
   * When true, this is the freemium "daily VS" flow:
   * - The client joins the matchmaking queue with a deterministic daily
   *   seed so everyone who plays their free daily VS that day shares
   *   the same puzzle word.
   * - On match end, the VS tile is locked for the rest of the day via
   *   `recordModePlayed('vs')`.
   * - Rematch is hidden (freemium only gets one VS match/day).
   * - If the player has already used their daily, a read-only
   *   "already played" screen is shown with the answer and a pro
   *   upsell instead of queueing.
   *
   * Pro users do not need this flag — they get unlimited random-seed
   * matches and rematches as before.
   */
  isDaily?: boolean;
}

type VsScreen = 'queue' | 'warmup' | 'match' | 'waiting' | 'result';

const MODE_LABELS: Record<string, string> = {
  [GameMode.DUEL]: 'CLASSIC',
  [GameMode.QUORDLE]: 'QUADWORD',
  [GameMode.OCTORDLE]: 'OCTOWORD',
  [GameMode.SEQUENCE]: 'SUCCESSION',
  [GameMode.RESCUE]: 'DELIVERANCE',
  [GameMode.GAUNTLET]: 'GAUNTLET',
  [GameMode.PROPERNOUNDLE]: 'PROPERNOUNDLE',
  [GameMode.DUEL_6]: 'SIX',
  [GameMode.DUEL_7]: 'SEVEN',
};

const MODE_GRADIENTS: Record<string, string> = {
  [GameMode.DUEL]: 'from-blue-900 via-cyan-800 to-teal-700',
  [GameMode.QUORDLE]: 'from-purple-900 via-pink-800 to-orange-700',
  [GameMode.OCTORDLE]: 'from-indigo-900 via-purple-800 to-pink-700',
  [GameMode.SEQUENCE]: 'from-orange-900 via-red-800 to-pink-700',
  [GameMode.RESCUE]: 'from-indigo-900 via-purple-800 to-fuchsia-700',
  [GameMode.GAUNTLET]: 'from-purple-900 via-pink-800 to-orange-700',
  [GameMode.PROPERNOUNDLE]: 'from-red-900 via-rose-800 to-orange-700',
  [GameMode.DUEL_6]: 'from-cyan-900 via-teal-800 to-sky-700',
  [GameMode.DUEL_7]: 'from-lime-900 via-green-800 to-emerald-700',
};

const MODE_TITLE_GRADIENTS: Record<string, string> = {
  [GameMode.DUEL]: 'from-cyan-400 via-blue-400 to-teal-400',
  [GameMode.QUORDLE]: 'from-yellow-400 via-pink-400 to-purple-400',
  [GameMode.OCTORDLE]: 'from-cyan-400 via-purple-400 to-pink-400',
  [GameMode.SEQUENCE]: 'from-yellow-400 via-orange-400 to-red-400',
  [GameMode.RESCUE]: 'from-indigo-400 via-purple-400 to-fuchsia-400',
  [GameMode.GAUNTLET]: 'from-yellow-400 via-pink-400 to-purple-400',
  [GameMode.PROPERNOUNDLE]: 'from-red-400 via-rose-400 to-orange-400',
  [GameMode.DUEL_6]: 'from-cyan-400 via-teal-400 to-sky-400',
  [GameMode.DUEL_7]: 'from-lime-400 via-green-400 to-emerald-400',
};

// Per-mode accent used for the corner Home button during a VS match.
// Matches the solid accent each mode uses on the home-screen mode cards
// so tapping into VS keeps the visual identity consistent.
const MODE_ACCENT_COLORS: Record<string, string> = {
  [GameMode.DUEL]: '#7c3aed',
  [GameMode.QUORDLE]: '#ec4899',
  [GameMode.OCTORDLE]: '#7e22ce',
  [GameMode.SEQUENCE]: '#2563eb',
  [GameMode.RESCUE]: '#059669',
  [GameMode.GAUNTLET]: '#d97706',
  [GameMode.PROPERNOUNDLE]: '#dc2626',
  [GameMode.DUEL_6]: '#06b6d4',
  [GameMode.DUEL_7]: '#84cc16',
};

// Board count / max guesses / word length per mode — mirrors the server's
// MODE_BOARD_COUNT + the core reducer's per-mode maxGuesses.
const MODE_TOTAL_BOARDS: Record<string, number> = {
  [GameMode.DUEL]: 1,
  [GameMode.QUORDLE]: 4,
  [GameMode.OCTORDLE]: 8,
  [GameMode.SEQUENCE]: 4,
  [GameMode.RESCUE]: 4,
  [GameMode.GAUNTLET]: 21,
  [GameMode.PROPERNOUNDLE]: 1,
  [GameMode.DUEL_6]: 1,
  [GameMode.DUEL_7]: 1,
};

const VS_MODE_MAX_GUESSES: Record<string, number> = {
  [GameMode.DUEL]: 6,
  [GameMode.QUORDLE]: 9,
  [GameMode.OCTORDLE]: 13,
  [GameMode.SEQUENCE]: 10,
  [GameMode.RESCUE]: 6,
  [GameMode.GAUNTLET]: 50,
  [GameMode.PROPERNOUNDLE]: 6,
  [GameMode.DUEL_6]: 7,
  [GameMode.DUEL_7]: 8,
};

const MODE_WORD_LEN: Record<string, number> = {
  [GameMode.DUEL_6]: 6,
  [GameMode.DUEL_7]: 7,
};

/**
 * Tug-of-war lead metric: boards solved dominate (weight 0.7); best-row
 * greens add the within-board signal (weight 0.3). For single-board modes
 * this reduces to greens-in-best-row until the solve flips boardsSolved.
 */
function computeVsProgress(
  boardsSolved: number,
  totalBoards: number,
  bestGreens: number,
  wordLen: number,
): number {
  return Math.min(
    1,
    (boardsSolved / Math.max(1, totalBoards)) * 0.7 + (bestGreens / Math.max(1, wordLen)) * 0.3,
  );
}

/** Max count of CORRECT tiles in any single row across all boards. */
function bestRowGreens(tiles: Record<number, string[][]>): number {
  let best = 0;
  for (const rows of Object.values(tiles)) {
    for (const row of rows) {
      const greens = row.filter((t) => t === 'CORRECT').length;
      if (greens > best) best = greens;
    }
  }
  return best;
}

export function VsGame({ mode, isDaily = false, inviteCode }: VsGameProps) {
  ensureDictionaryInitialized();

  const { profile, isProActive } = useAuth();
  const isPro = isProActive;

  // Daily VS uses the shared daily seed for EVERYONE (incl. Pro) so all players
  // play the same puzzle and pair together. The once-per-day limit + already-
  // played screen apply to all; Pro gets an "Unlimited VS" escape there.
  // Other modes' VS buttons are pro-only and never reach this branch.
  const dailyVsActive = isDaily && mode === GameMode.DUEL;

  // The deterministic seed for today's free daily VS puzzle. Intentionally
  // uses a different mode slug ("DUEL_VS") from Classic's daily
  // ("DUEL"), so the daily VS word is always different from the daily
  // Classic word even though both are derived from the same solution
  // list via generateSolutionsFromSeed.
  const todayDailySeed = useMemo(
    () => (dailyVsActive ? generateDailySeed(getTodayUTC(), 'DUEL_VS') : undefined),
    [dailyVsActive],
  );

  // Pre-compute the answer for today's daily VS so the "already played"
  // screen can show it without needing to re-connect to the server.
  const todayDailyAnswer = useMemo(
    () => (todayDailySeed ? generateSolutionsFromSeed(todayDailySeed, 1)[0] : ''),
    [todayDailySeed],
  );

  // Has this freemium user already used their daily VS today? If so we
  // short-circuit past the matchmaking queue entirely.
  const [alreadyPlayedDaily, setAlreadyPlayedDaily] = useState(
    () => dailyVsActive && hasPlayedModeToday('vs'),
  );
  // Shown if a freemium user tries to rematch after their daily game.
  const [vsLimitOpen, setVsLimitOpen] = useState(false);
  const [screen, setScreen] = useState<VsScreen>('queue');
  // Stable facade over the transport: starts on the socket, can hot-swap to a
  // client-side CPU bot (Pro-only practice) without re-wiring any handlers.
  const [matchService] = useState(() => new SwappableMatchService(new SocketIOMatchService(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001')));
  // CPU-vs state. cpuDifficulty !== null once the player picks a bot opponent.
  const [cpuDifficulty, setCpuDifficulty] = useState<BotDifficulty | null>(null);
  const isCpu = cpuDifficulty !== null;
  const isCpuRef = useRef(isCpu);
  isCpuRef.current = isCpu;
  const [cpuPersona, setCpuPersona] = useState<{ tier: BotTier; name: string; avatar: string; color: string } | null>(null);
  const cpuPersonaRef = useRef(cpuPersona);
  cpuPersonaRef.current = cpuPersona;
  const [showCpuChooser, setShowCpuChooser] = useState(false);
  const [cpuAutoOffer, setCpuAutoOffer] = useState(false);
  // Fun layer: photo-finish flourish, streak milestone, cosmetic unlock, and a
  // per-session run-it-back tally — all CPU-only.
  const [photoFinish, setPhotoFinish] = useState<PhotoFinishKind | null>(null);
  const [cpuMilestone, setCpuMilestone] = useState<number | null>(null);
  const [cpuUnlock, setCpuUnlock] = useState<string | null>(null);
  const [cpuStreak, setCpuStreak] = useState(0);
  const [cpuSession, setCpuSession] = useState({ wins: 0, losses: 0 });
  const presenceId = usePresenceId();
  const router = useRouter();
  const [seed, setSeed] = useState('');
  const [startTime, setStartTime] = useState(0);
  // Live refs so the socket connect effect can run ONCE per mount and read the
  // latest profile/seed without listing them as deps. Listing `profile` as a
  // dep caused the effect to re-run (and its cleanup to disconnect the socket)
  // mid-match whenever auth refreshed the profile object — e.g. right after a
  // win wrote XP — which the opponent's client saw as "opponent left" and got
  // booted to home. Refs keep the connection stable for the whole match.
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const seedRef = useRef(seed);
  seedRef.current = seed;
  // Ref so the once-wired socket handlers can read the live screen.
  const screenRef = useRef(screen);
  screenRef.current = screen;
  // Countdown seconds parked here in onMatchFound, started by the intro's onDone
  // (after the splash) so it no longer ticks underneath the intro overlay.
  const pendingCountdownRef = useRef(3);
  const [queuePosition, setQueuePosition] = useState(0);
  const [queueSize, setQueueSize] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [showCountdown, setShowCountdown] = useState(false);
  const [opponentProgress, setOpponentProgress] = useState({ attempts: 0, boardsSolved: 0, totalBoards: 0 });
  const [opponentTiles, setOpponentTiles] = useState<Record<number, string[][]>>({});
  const [puzzleMetadata, setPuzzleMetadata] = useState<{ display: string; category: string; answerLength: number; themeCategory?: string } | undefined>();
  const [matchResult, setMatchResult] = useState<any>(null);
  const [playerStats, setPlayerStats] = useState<{ guesses: number; timeMs: number } | null>(null);
  const [message, setMessage] = useState('');
  const [rematchState, setRematchState] = useState<'idle' | 'offered' | 'received' | 'declined'>('idle');
  const resultRecordedRef = useRef(false);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);

  // ── VS experience upgrade state ──
  const [showIntro, setShowIntro] = useState(false);

  // Run the on-board countdown overlay. Called after the match-intro splash
  // finishes (see MatchIntro onDone) so the two no longer overlap.
  const startCountdown = useCallback((secs: number) => {
    setShowCountdown(true);
    setCountdown(secs);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    setTimeout(() => setShowCountdown(false), secs * 1000);
  }, []);
  const [opponentUserId, setOpponentUserId] = useState<string | null>(null);
  const [opponentInfo, setOpponentInfo] = useState<VsProfile | null>(null);
  const opponentNameRef = useRef('Opponent');
  const [headToHead, setHeadToHead] = useState<HeadToHeadRecord | null>(null);
  // My own play, mirrored locally so the header/result can render it:
  // tiles are evaluated client-side from the seed-derived solutions.
  const [myTiles, setMyTiles] = useState<Record<number, string[][]>>({});
  const [myGuessLog, setMyGuessLog] = useState<OpponentGuessLogEntry[]>([]);
  const myGuessLogRef = useRef<OpponentGuessLogEntry[]>([]);
  const [myBoardsSolved, setMyBoardsSolved] = useState(0);
  const [myStatus, setMyStatus] = useState<'won' | 'lost' | null>(null);
  const [callout, setCallout] = useState<{ id: number; text: string } | null>(null);
  const lastCalloutRef = useRef('');
  const calloutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [opponentTyping, setOpponentTyping] = useState(false);
  const typingHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const prevOppBoardsSolvedRef = useRef(0);
  const [waitingClock, setWaitingClock] = useState(0);

  const totalBoards = MODE_TOTAL_BOARDS[mode] || 1;
  const modeMaxGuesses = VS_MODE_MAX_GUESSES[mode] || 6;
  const wordLen = MODE_WORD_LEN[mode] || 5;

  // Solutions derived from the match seed so my own guess rows can be
  // evaluated locally for the tug-of-war bar and the result boards.
  // ProperNoundle's answer is server-side until match end, so it stays
  // empty (the result screen uses match_ended.solutions instead).
  const mySolutions = useMemo(() => {
    if (!seed || mode === GameMode.PROPERNOUNDLE) return [] as string[];
    if (mode === GameMode.DUEL_6) return generateSolutionsFromSeedForLength(seed, 1, 6);
    if (mode === GameMode.DUEL_7) return generateSolutionsFromSeedForLength(seed, 1, 7);
    return generateSolutionsFromSeed(seed, totalBoards);
  }, [seed, mode, totalBoards]);
  const mySolutionsRef = useRef<string[]>([]);
  mySolutionsRef.current = mySolutions;

  const showCallout = useCallback((text: string) => {
    // Dedupe consecutive identical callouts while one is still visible.
    if (text === lastCalloutRef.current && calloutTimerRef.current) return;
    lastCalloutRef.current = text;
    setCallout({ id: Date.now(), text });
    if (calloutTimerRef.current) clearTimeout(calloutTimerRef.current);
    calloutTimerRef.current = setTimeout(() => {
      setCallout(null);
      calloutTimerRef.current = null;
      lastCalloutRef.current = '';
    }, 2500);
  }, []);

  const resetPerMatchState = useCallback(() => {
    setMyTiles({});
    setMyGuessLog([]);
    myGuessLogRef.current = [];
    setMyBoardsSolved(0);
    setMyStatus(null);
    setCallout(null);
    setOpponentTyping(false);
    prevOppBoardsSolvedRef.current = 0;
    lastCalloutRef.current = '';
    // CPU fun-layer overlays don't carry into the next match.
    setPhotoFinish(null);
    setCpuMilestone(null);
    setCpuUnlock(null);
  }, []);

  const formatTime = (ms: number) => {
    const totalSec = Math.round(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const gradient = MODE_GRADIENTS[mode] || MODE_GRADIENTS[GameMode.DUEL];
  const titleGradient = MODE_TITLE_GRADIENTS[mode] || MODE_TITLE_GRADIENTS[GameMode.DUEL];
  const accentColor = MODE_ACCENT_COLORS[mode] || MODE_ACCENT_COLORS[GameMode.DUEL];
  const label = MODE_LABELS[mode] || 'VS';

  useEffect(() => {
    matchService.connect(presenceId);

    matchService.onQueueStatus((data) => {
      setQueuePosition(data.position);
      if (typeof data.queueSize === 'number') setQueueSize(data.queueSize);
    });

    matchService.onMatchFound((data) => {
      // Park the countdown length; it starts when the intro splash finishes.
      pendingCountdownRef.current = Math.max(1, data.countdownSeconds);

      // Match-intro splash: resolve the opponent's public profile and the
      // all-time head-to-head record while the 2.5s intro plays.
      setShowIntro(true);
      setHeadToHead(null);
      setOpponentInfo(null);
      opponentNameRef.current = 'Opponent';
      const oppId = data.opponentUserId ?? null;
      setOpponentUserId(oppId);
      if (oppId && oppId.startsWith(CPU_OPPONENT_PREFIX)) {
        // CPU opponent: use the persona identity locally — no profile / H2H fetch.
        const tier = tierFromCpuId(oppId);
        const persona = BOT_PERSONAS[tier];
        setOpponentInfo({ username: persona.name, avatarUrl: null, level: 0 });
        opponentNameRef.current = persona.name;
        setHeadToHead(null);
      } else if (oppId) {
        fetchVsProfile(oppId)
          .then((p) => {
            if (p) {
              setOpponentInfo(p);
              opponentNameRef.current = p.username;
            }
          })
          .catch(() => {});
        const me = profileRef.current;
        if (me) {
          fetchHeadToHead(me.id, oppId).then(setHeadToHead).catch(() => {});
        }
      }

      // Private-match invites: flip the match_invites row to 'accepted'
      // now that the matchmaking server paired both invitees. Keeps the
      // pending-invites banner from lingering and stops a stale click
      // from spawning a ghost lobby for the next 24 hours.
      if (inviteCode) {
        markInviteAcceptedByCode(inviteCode, data.matchId).catch(() => {});
      }

      // The countdown overlay is started by MatchIntro's onDone (below), after
      // the splash finishes — so it no longer ticks under the intro.
    });

    matchService.onMatchStart((data) => {
      setSeed(data.seed);
      setStartTime(data.startTime);
      setPuzzleMetadata(data.puzzleMetadata);
      setScreen('match');
      setOpponentProgress({ attempts: 0, boardsSolved: 0, totalBoards: 0 });
      setOpponentTiles({});
      resultRecordedRef.current = false;
      resetPerMatchState();
    });

    matchService.onOpponentProgress((data: any) => {
      setOpponentProgress(data);

      // Moment callouts (one per progress event, most dramatic first).
      const name = opponentNameRef.current;
      let calloutText: string | null = null;
      if (data.boardsSolved > prevOppBoardsSolvedRef.current && data.totalBoards > 1) {
        calloutText = `${name} solved board ${data.boardsSolved}!`;
      }
      prevOppBoardsSolvedRef.current = data.boardsSolved;

      // applyToAll modes (quordle/octordle/rescue) send `latestGuesses` — the
      // guess evaluated against every unsolved board — so all the opponent's
      // per-board mini-boards populate, not just board 0. Single-board / sequence
      // still send a single `latestGuess`.
      const perBoard: { boardIndex: number; tiles: string[] }[] =
        data.latestGuesses ?? (data.latestGuess ? [data.latestGuess] : []);
      if (perBoard.length > 0) {
        playOpponentThunk();
        setOpponentTiles(prev => {
          const next = { ...prev };
          for (const g of perBoard) {
            const idx = g.boardIndex ?? 0;
            next[idx] = [...(next[idx] || []), g.tiles];
          }
          return next;
        });
        // "N greens!" callout keys off the board the player is focused on (the
        // single latestGuess when present, else the first fanned-out board).
        const primary = data.latestGuess ?? perBoard[0];
        const greens = primary.tiles.filter((t: string) => t === 'CORRECT').length;
        const len = primary.tiles.length;
        if (!calloutText && len >= 2 && greens === len - 1) {
          calloutText = `${name} got ${greens} greens! 😱`;
        }
      }
      if (!calloutText && !data.solved && data.attempts === modeMaxGuesses - 1) {
        calloutText = `${name} is on their last guess!`;
      }
      if (calloutText) showCallout(calloutText);
    });

    matchService.onOpponentTyping(() => {
      setOpponentTyping(true);
      // Hide after 2s without fresh pings (the sender throttles to 1/1.5s).
      if (typingHideTimerRef.current) clearTimeout(typingHideTimerRef.current);
      typingHideTimerRef.current = setTimeout(() => setOpponentTyping(false), 2000);
    });

    matchService.onMatchEnded((data) => {
      setMatchResult(data);
      setScreen('result');

      // Record stats
      const me = profileRef.current;
      if (me && !resultRecordedRef.current) {
        resultRecordedRef.current = true;
        const won = data.winner === 'player';
        if (isCpuRef.current) {
          // Pure practice: record ONLY the separate vs_cpu bucket — no XP, no
          // matches row, no head-to-head, no achievements, no daily lock.
          recordCpuResult(me.id, mode, won, data.playerGuesses, Math.round(data.playerTime / 1000));
          // Fun layer: progression (streak / ladder / cosmetics / milestone),
          // session tally, and the photo-finish flourish on a close/last win.
          const tier: BotTier = cpuPersonaRef.current?.tier ?? 'medium';
          const outcome = recordCpuGame(won, tier, BOT_PERSONAS[tier].id);
          setCpuStreak(outcome.progression.streak);
          setCpuMilestone(outcome.milestone);
          setCpuUnlock(outcome.unlockedPersona);
          setCpuSession((s) => (won ? { ...s, wins: s.wins + 1 } : { ...s, losses: s.losses + 1 }));
          if (won) {
            const margin = Math.abs(data.playerTime - data.opponentTime);
            if (margin < 2000) setPhotoFinish('photo');
            else if (data.playerGuesses >= modeMaxGuesses) setPhotoFinish('clutch');
          }
          return;
        }
        recordGameResult(me.id, mode, 'vs', won, data.playerGuesses, data.playerTime, seedRef.current)
          .then(xp => { if (xp) setXpResult(xp); });
        // Persist a match-history row so this VS battle shows in Recent Matches.
        // Exactly one client writes it (server flags player1 via recordMatch),
        // so there's a single shared row visible to both players.
        if (data.recordMatch && data.opponentId) {
          recordMatch({
            gameMode: mode,
            player1Id: me.id,
            player2Id: data.opponentId,
            winnerId: data.winner === 'player' ? me.id
              : data.winner === 'opponent' ? data.opponentId : undefined,
            player1Score: data.playerGuesses,
            player2Score: data.opponentGuesses,
            player1Time: Math.round(data.playerTime / 1000),
            player2Time: Math.round(data.opponentTime / 1000),
            seed: seedRef.current,
            solutions: data.solutions ?? [],
            player1Guesses: myGuessLogRef.current.map((g) => g.guess),
            player2Guesses: (data.opponentGuessLog ?? []).map((g) => g.guess),
            startedAt: new Date(Date.now() - data.playerTime).toISOString(),
            completedAt: new Date().toISOString(),
            forfeit: (data as any).forfeit === true,
          });
        }
        // Refresh the head-to-head line so the result screen shows the
        // UPDATED record including this match. Small delay gives the
        // single-writer client's `matches` insert time to land.
        if (data.opponentId) {
          const oppId = data.opponentId;
          setTimeout(() => {
            fetchHeadToHead(me.id, oppId).then(setHeadToHead).catch(() => {});
          }, 1200);
        }
      }
      // Freemium daily VS: lock the home-page VS tile for the rest of
      // the day. This replaces the old 2-per-day VS counter — the
      // freemium flow is now strictly one daily VS match, gated the
      // same way Classic/Quordle/etc. are.
      if (dailyVsActive) {
        recordModePlayed('vs');
      }
    });

    matchService.onRematchOffered(() => {
      setRematchState('received');
    });

    matchService.onRematchDeclined(() => {
      setRematchState('declined');
    });

    matchService.onRematchStart((data) => {
      setSeed(data.seed);
      setStartTime(Date.now());
      setPuzzleMetadata((data as any).puzzleMetadata);
      setScreen('match');
      setOpponentProgress({ attempts: 0, boardsSolved: 0, totalBoards: 0 });
      setOpponentTiles({});
      setMatchResult(null);
      setRematchState('idle');
      setPlayerStats(null);
      resultRecordedRef.current = false;
      resetPerMatchState();
    });

    matchService.onOpponentLeft(() => {
      // Only treat as a forfeit while actually mid-match or spectating; ignore
      // stray disconnects on the queue/result screens (don't boot home).
      if (screenRef.current !== 'match' && screenRef.current !== 'waiting') return;
      setMessage('Opponent left the match');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    });

    matchService.onError((data) => {
      setMessage(data.message);
    });

    // Skip queueing when a freemium user has already used their daily
    // VS — we're rendering the "already played" screen instead. Pro
    // users (and freemium who haven't played yet) join the queue
    // normally, passing the daily seed only when this is the daily flow.
    if (!alreadyPlayedDaily) {
      // Re-derive at join time: the todayDailySeed memo only recomputes on
      // dailyVsActive, so a tab left open across midnight queued with
      // YESTERDAY'S seed and could only ever pair with other stale tabs.
      const queueSeed = dailyVsActive ? generateDailySeed(getTodayUTC(), 'DUEL_VS') : undefined;
      matchService.joinQueue(mode, queueSeed, inviteCode);
    }

    return () => {
      matchService.disconnect();
    };
    // Connect ONCE per mount. Volatile values (profile, seed, daily flags) are
    // read via refs/stable closures inside the handlers, so the socket is never
    // torn down mid-match. Only matchService/presenceId (stable) gate the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchService, presenceId]);

  // Live clock while spectating the opponent finish their game.
  useEffect(() => {
    if (screen !== 'waiting') return;
    const tick = () => setWaitingClock(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [screen, startTime]);

  const handleBoardSolved = useCallback((boardIndex: number) => {
    matchService.reportBoardSolved(boardIndex);
    setMyBoardsSolved((n) => n + 1);
  }, [matchService]);

  const handleCompleted = useCallback((status: 'won' | 'lost', totalGuesses: number, timeMs: number) => {
    matchService.reportCompletion(status, totalGuesses, timeMs);
    setPlayerStats({ guesses: totalGuesses, timeMs });
    setMyStatus(status);
    setScreen('waiting');
  }, [matchService]);

  const handleStageCompleted = useCallback((stageIndex: number) => {
    matchService.reportStageCompleted(stageIndex);
  }, [matchService]);

  const handleGuessSubmitted = useCallback((guess: string, boardIndex: number) => {
    matchService.submitGuess(guess, boardIndex);
    // Mirror my own guess locally: word log for the result boards, tile
    // colors (via the seed-derived solution) for the tug-of-war bar.
    const entry = { boardIndex, guess: guess.toUpperCase() };
    myGuessLogRef.current = [...myGuessLogRef.current, entry];
    setMyGuessLog(myGuessLogRef.current);
    const solution = mySolutionsRef.current[boardIndex];
    if (solution) {
      try {
        const states = evaluateGuess(solution.toUpperCase(), guess.toUpperCase()).tiles.map((t: any) => t.state as string);
        setMyTiles(prev => ({ ...prev, [boardIndex]: [...(prev[boardIndex] || []), states] }));
      } catch {
        // Length mismatch (shouldn't happen outside ProperNoundle) — skip greens.
      }
    }
  }, [matchService]);

  // Throttled typing relay: at most one ping per 1.5s while letters are
  // being entered in the current row.
  const handleTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    matchService.emitTyping();
  }, [matchService]);

  // Swap the live socket transport for a client-side CPU bot and start a match.
  // Pro-gated in the UI (non-Pro never reaches here).
  const startCpu = useCallback((difficulty: BotDifficulty) => {
    const tier: BotTier = difficulty === 'adaptive' ? 'medium' : difficulty;
    const persona = BOT_PERSONAS[tier];
    setCpuPersona({ tier, name: persona.name, avatar: persona.avatar, color: persona.color });
    setCpuDifficulty(difficulty);
    setShowCpuChooser(false);
    setCpuAutoOffer(false);
    setMessage('');
    // Adaptive: shadow the player's recent form — the higher their current CPU
    // streak, the tougher the bot (keeps games neck-and-neck).
    const adaptive = difficulty === 'adaptive'
      ? { winRate: Math.min(0.9, 0.4 + loadCpuProgression().streak * 0.05) }
      : undefined;
    matchService.swap(new LocalBotMatchService(difficulty, adaptive), { mode });
  }, [matchService, mode]);

  // Auto-offer the CPU after the queue sits empty for a bit (fallback path).
  useEffect(() => {
    if (screen !== 'queue' || isCpu || showIntro) {
      setCpuAutoOffer(false);
      return;
    }
    const t = setTimeout(() => setCpuAutoOffer(true), 15000);
    return () => clearTimeout(t);
  }, [screen, isCpu, showIntro]);

  const handleCancel = useCallback(() => {
    matchService.leaveQueue();
    matchService.disconnect();
    // Client-side nav (not window.location.href) so home — and its footer —
    // renders instantly. A hard reload re-downloads + re-hydrates the whole
    // app, which is why the footer used to take a few seconds to reappear.
    router.push('/');
  }, [matchService, router]);

  const handleHome = useCallback(() => {
    matchService.disconnect();
    router.push('/');
  }, [matchService, router]);

  const handleRematch = useCallback(() => {
    // Freemium: no rematch allowed after the daily VS game. Show the
    // pro upsell modal instead of firing the rematch event.
    if (!isPro) {
      setVsLimitOpen(true);
      return;
    }
    setRematchState('offered');
    matchService.offerRematch();
  }, [matchService, isPro]);

  const handleDeclineRematch = useCallback(() => {
    matchService.declineRematch();
    setRematchState('declined');
  }, [matchService]);

  const handleForfeit = useCallback(() => {
    matchService.abandonMatch();
    matchService.disconnect();
    window.location.href = '/';
  }, [matchService]);

  // "Already played today" screen — shown when a freemium user
  // revisits /practice/vs?daily=true after using their free daily VS
  // match. This mirrors how the home tile's "View Solved Puzzle" flow
  // works for Classic: instead of replaying, the user sees the answer
  // word plus a pro upsell and a reset countdown. Pro users never hit
  // this branch (dailyVsActive is false for them).
  if (alreadyPlayedDaily) {
    return (
      <DailyVsAlreadyPlayed
        answer={todayDailyAnswer}
        titleGradient={titleGradient}
        isPro={isPro}
      />
    );
  }

  // Queue screen
  if (screen === 'queue') {
    return (
      <div className="h-screen-stable flex flex-col items-center justify-center relative" style={{ backgroundColor: 'var(--color-bg)' }}>
        <VsLimitModal open={vsLimitOpen} onClose={() => { setVsLimitOpen(false); window.location.href = '/'; }} />
        {/* Match-intro splash — sits above the countdown for 2.5s (or until tapped). */}
        {showIntro && (
          <MatchIntro
            me={{
              username: profile?.username || 'You',
              avatarUrl: (profile as any)?.avatar_url ?? null,
              level: (profile as any)?.level ?? null,
            }}
            opponent={opponentUserId ? {
              username: isCpu ? `${opponentInfo?.username ?? 'CPU'} · ${cpuPersona ? tierLabel(cpuPersona.tier) : 'CPU'}` : (opponentInfo?.username ?? '…'),
              avatarUrl: opponentInfo?.avatarUrl ?? null,
              level: isCpu ? null : (opponentInfo?.level ?? null),
            } : null}
            headToHead={headToHead}
            onDone={() => { setShowIntro(false); startCountdown(pendingCountdownRef.current); }}
          />
        )}
        {/* Countdown overlay */}
        {showCountdown && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
          >
            <div className="text-center space-y-4">
              <div className="text-gray-400 text-lg font-bold uppercase tracking-widest animate-fade-in-scale">
                Match Found
              </div>
              <div
                key={countdown}
                className={`text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r ${titleGradient} animate-fade-in-scale`}
              >
                {countdown}
              </div>
            </div>
          </div>
        )}

        <div className="text-center space-y-6">
          <h1 className={`text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r ${titleGradient}`}>
            VS {label}
          </h1>

          <div>
            <Loader2 className="h-16 w-16 text-purple-300 mx-auto animate-spin" />
          </div>

          <div className="space-y-2">
            <CyclingStatus />
            <p className="text-gray-400 text-sm">Position in queue: {queuePosition + 1}</p>
            {queueSize > 1 && (
              <p className="text-gray-400 text-xs font-bold">{queueSize} players waiting</p>
            )}
          </div>

          {/* Play the CPU — explicit choice + auto-offer once the queue is quiet. */}
          {!showIntro && !showCountdown && !isCpu && (
            <div className="w-full max-w-xs mx-auto">
              {showCpuChooser || cpuAutoOffer ? (
                <div
                  className="rounded-2xl border p-4 space-y-3"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                >
                  <div className="flex items-center justify-center gap-2 text-sm font-extrabold" style={{ color: 'var(--color-text)' }}>
                    <Bot className="w-4 h-4" />
                    {cpuAutoOffer && !showCpuChooser ? 'No players right now — play the CPU?' : 'Play the CPU'}
                  </div>
                  {isPro ? (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        {(['easy', 'medium', 'hard'] as BotTier[]).map((tier) => {
                          const p = BOT_PERSONAS[tier];
                          return (
                            <button
                              key={tier}
                              onClick={() => startCpu(tier)}
                              className="flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-transform hover:-translate-y-0.5"
                              style={{ borderColor: p.color, background: 'var(--color-surface-hover)' }}
                            >
                              <span className="text-xl">{p.avatar}</span>
                              <span className="text-xs font-black" style={{ color: p.color }}>{tierLabel(tier)}</span>
                              <span className="text-[10px] font-bold text-gray-400">{p.name}</span>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => startCpu('adaptive')}
                        className="w-full rounded-xl border px-3 py-2 text-xs font-black transition-transform hover:-translate-y-0.5"
                        style={{ borderColor: '#7c3aed', background: 'var(--color-surface-hover)', color: '#7c3aed' }}
                      >
                        ⚖️ Adaptive — matched to your form
                      </button>
                      <p className="text-center text-[10px] font-bold text-gray-400">Practice only — doesn’t affect your ranked stats</p>
                    </>
                  ) : (
                    <div className="text-center space-y-2">
                      <div className="flex items-center justify-center gap-1 text-xs font-bold text-gray-400">
                        <Lock className="w-3.5 h-3.5" /> Practice vs CPU is a Pro feature
                      </div>
                      <button
                        onClick={() => router.push('/pro')}
                        className="w-full rounded-xl px-4 py-2 text-sm font-black text-white"
                        style={{ background: 'linear-gradient(135deg,#a78bfa,#ec4899)' }}
                      >
                        Unlock with Pro
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowCpuChooser(true)}
                  className="mx-auto flex items-center gap-1.5 text-sm font-bold text-purple-400 hover:text-purple-500"
                >
                  <Bot className="w-4 h-4" /> Play the CPU instead
                </button>
              )}
            </div>
          )}

          <button
            onClick={handleCancel}
            className="bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-400 hover:text-white font-bold px-6 py-2 rounded-xl transition-all flex items-center gap-2 mx-auto"
          >
            <X className="w-4 h-4" /> Cancel
          </button>
        </div>

        {message && (
          <div className="absolute bottom-8 left-0 right-0 text-center">
            <span className="bg-gray-800 text-white text-sm font-bold px-4 py-2 rounded-lg">{message}</span>
          </div>
        )}
      </div>
    );
  }

  // Result screen
  if (screen === 'result') {
    const winner = matchResult?.winner;
    const isWin = winner === 'player';
    const isDraw = winner === 'draw';
    const headlineText = isWin ? 'WINNER' : isDraw ? 'DRAW' : 'DEFEAT';
    const headlineColor = isWin ? 'from-green-400 to-emerald-300' : isDraw ? 'from-yellow-400 to-orange-300' : 'from-red-400 to-rose-300';
    const myName = profile?.username || 'You';
    const oppName = opponentInfo?.username || 'Opponent';

    const comparisonMetrics = [
      { label: 'Guesses', mine: matchResult?.playerGuesses ?? 0, theirs: matchResult?.opponentGuesses ?? 0, format: (v: number) => `${v}` },
      { label: 'Time', mine: matchResult?.playerTime ?? 0, theirs: matchResult?.opponentTime ?? 0, format: (v: number) => formatTime(v) },
      ...(matchResult?.playerScore != null
        ? [{ label: 'Score (guesses + time penalty)', mine: matchResult.playerScore, theirs: matchResult.opponentScore, format: (v: number) => v.toFixed(2) }]
        : []),
    ];

    const handleShare = () => {
      const text = isWin
        ? `I just beat ${oppName} in a Wordocious VS ${label} duel! ⚔️🏆`
        : isDraw
          ? `${oppName} and I battled to a draw in VS ${label} on Wordocious! ⚔️`
          : `Epic VS ${label} duel against ${oppName} on Wordocious! ⚔️`;
      const payload = `${text}\nhttps://wordocious.com`;
      if (typeof navigator !== 'undefined' && navigator.share) {
        navigator.share({ text: payload }).catch(() => {});
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(payload).then(() => {
          setMessage('Copied to clipboard!');
          setTimeout(() => setMessage(''), 2000);
        }).catch(() => {});
      }
    };

    return (
      <div className="min-h-screen overflow-y-auto relative" style={{ backgroundColor: 'var(--color-bg)' }}>
        {/* Photo-finish flourish (CPU close/last-guess win) — plays FIRST and is
            visually distinct from the win confetti; confetti follows once it
            dismisses so the two never overlap. */}
        {photoFinish && <PhotoFinish kind={photoFinish} onDone={() => setPhotoFinish(null)} />}
        {/* Confetti for wins only (held back while the photo-finish plays) */}
        {isWin && !photoFinish && <Confetti />}
        {/* Rematch upsell for freemium — handleRematch sets this open */}
        <VsLimitModal open={vsLimitOpen} onClose={() => setVsLimitOpen(false)} />
        <div className="max-w-md w-full mx-auto px-6 py-10 space-y-5">
          {/* Headline */}
          <div className="text-center animate-fade-in-scale">
            <h1 className={`text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r ${headlineColor}`}>
              {headlineText}
            </h1>
            {/* Updated all-time head-to-head (refetched after the match was recorded) */}
            {opponentUserId && headToHead && !isCpu && (
              <p className="text-sm font-extrabold mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                {headToHeadLine(oppName, headToHead)}
              </p>
            )}
            {/* CPU practice: streak + milestone + cosmetic unlock (no ranked H2H) */}
            {isCpu && (
              <div className="mt-2 space-y-1">
                {cpuMilestone ? (
                  <p className="text-sm font-black" style={{ color: '#f97316' }}>🔥 {cpuMilestone}-win CPU streak!</p>
                ) : cpuStreak > 0 ? (
                  <p className="text-xs font-extrabold text-gray-400">CPU win streak: {cpuStreak}</p>
                ) : null}
                {cpuUnlock && (
                  <p className="text-xs font-black" style={{ color: BOT_PERSONAS[cpuPersona?.tier ?? 'hard'].color }}>
                    🏅 Unlocked {BOT_PERSONAS[cpuPersona?.tier ?? 'hard'].name}’s badge!
                  </p>
                )}
                <p className="text-[10px] font-bold text-gray-400">Practice — not counted in ranked stats</p>
              </div>
            )}
          </div>

          {/* Comparison bars: you (purple) vs them (pink), lower is better */}
          <ComparisonBars myName={myName} opponentName={oppName} metrics={comparisonMetrics} />

          {/* Rematch Status */}
          {rematchState === 'received' && (
            <div
              className="bg-white border-2 border-purple-300 rounded-xl p-4 text-center animate-fade-in-up"
            >
              <p className="text-sm font-bold text-gray-700 mb-3">Opponent wants a rematch!</p>
              <div className="flex gap-3">
                <button
                  onClick={handleDeclineRematch}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 font-bold py-2.5 rounded-xl transition-all"
                >
                  Decline
                </button>
                <button
                  onClick={handleRematch}
                  className={`flex-1 bg-gradient-to-r ${titleGradient} text-white font-bold py-2.5 rounded-xl transition-all shadow-lg`}
                >
                  Accept
                </button>
              </div>
            </div>
          )}

          {/* Actions — prominent Rematch on top, Home/Share below */}
          <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            {/* Run-it-back session tally (CPU only) */}
            {isCpu && (cpuSession.wins + cpuSession.losses) > 0 && (
              <p className="text-center text-xs font-extrabold text-gray-400">
                This session — You {cpuSession.wins} · CPU {cpuSession.losses}
              </p>
            )}
            {rematchState === 'declined' ? (
              <div className="w-full bg-gray-100 border border-gray-200 text-gray-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                <X className="w-4 h-4" /> No Rematch
              </div>
            ) : rematchState === 'offered' ? (
              <div className={`w-full bg-gradient-to-r ${titleGradient} text-white/80 font-black py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg`}>
                <Loader2 className="w-4 h-4 animate-spin" /> Waiting...
              </div>
            ) : rematchState !== 'received' ? (
              <button
                onClick={handleRematch}
                className={`w-full bg-gradient-to-r ${titleGradient} text-white font-black py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg btn-3d`}
              >
                <RotateCcw className="w-4 h-4" /> {isCpu ? 'Run it back' : 'Rematch'}
              </button>
            ) : null}
            <div className="flex gap-3">
              <button
                onClick={handleHome}
                className="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" /> Home
              </button>
              <button
                onClick={handleShare}
                className="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>
          </div>

          {/* Final boards with letters — opponent's reconstructed from the
              match-end guess log + solutions */}
          {(matchResult?.solutions?.length ?? 0) > 0 && (
            <FinalBoards
              myName={myName}
              opponentName={oppName}
              myGuessLog={myGuessLog}
              opponentGuessLog={matchResult?.opponentGuessLog ?? []}
              solutions={matchResult?.solutions ?? []}
            />
          )}
        </div>

        {message && (
          <div className="fixed bottom-8 left-0 right-0 text-center z-50">
            <span className="bg-gray-800 text-white text-sm font-bold px-4 py-2 rounded-lg">{message}</span>
          </div>
        )}
      </div>
    );
  }

  // Spectator waiting screen — you finished; watch the opponent's live
  // board (colors only, letters stay hidden until match end).
  if (screen === 'waiting') {
    const oppName = opponentInfo?.username || 'Opponent';
    const liveTotalBoards = opponentProgress.totalBoards || totalBoards;
    const oppRowsUsed = Math.max(0, ...Object.values(opponentTiles).map((rows) => rows.length));
    // Cap rendered empty rows so Gauntlet's 50-guess budget doesn't blow up the layout.
    const spectatorRows = Math.min(modeMaxGuesses, Math.max(6, oppRowsUsed + 1));
    const clockStr = `${Math.floor(waitingClock / 60)}:${(waitingClock % 60).toString().padStart(2, '0')}`;

    // STAKES copy. The real win rule is: solve, then tie-break on
    // boardsSolved, then composite score = guesses + timeSeconds/45.
    // We approximate the composite by guess count: the opponent is still
    // playing, so they're almost always behind you on time and need
    // strictly FEWER guesses; if they're somehow still ahead of your
    // clock, matching your guess count could win on time.
    const stakes = (() => {
      if (!playerStats) return '';
      const boardsLeft = liveTotalBoards - opponentProgress.boardsSolved;
      if (myStatus === 'lost') {
        return liveTotalBoards > 1
          ? `${oppName} needs ${boardsLeft} more board${boardsLeft === 1 ? '' : 's'} to win`
          : `${oppName} just needs to solve to win`;
      }
      if (liveTotalBoards > 1 && boardsLeft > 1) {
        return `${oppName} needs ${boardsLeft} more boards to stay alive`;
      }
      const opponentTimeBehind = Date.now() - startTime > playerStats.timeMs;
      const target = opponentTimeBehind ? playerStats.guesses - 1 : playerStats.guesses;
      if (target <= 0 || opponentProgress.attempts >= target) {
        return `${oppName} can no longer beat your score!`;
      }
      return `${oppName} must solve in ${target} or fewer to beat you`;
    })();

    return (
      <div className="h-screen-stable flex flex-col items-center justify-center relative overflow-y-auto" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="text-center space-y-5 max-w-md w-full px-6 py-6">
          <h2 className={`text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r ${titleGradient}`}>
            {oppName} is still playing...
          </h2>

          {/* Opponent identity + live counters */}
          <div className="flex items-center justify-center gap-3">
            {opponentInfo?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={opponentInfo.avatarUrl} alt={oppName} className="w-10 h-10 rounded-full object-cover" style={{ border: '1.5px solid var(--color-border)' }} />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <span className="text-white font-black text-xs">{oppName.slice(0, 2).toUpperCase()}</span>
              </div>
            )}
            <div className="text-left">
              <div className="text-sm font-extrabold" style={{ color: 'var(--color-text)' }}>{oppName}</div>
              <div className="text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                {opponentProgress.attempts} {opponentProgress.attempts === 1 ? 'guess' : 'guesses'} · {clockStr}
                {liveTotalBoards > 1 && ` · ${opponentProgress.boardsSolved}/${liveTotalBoards} boards`}
              </div>
            </div>
            {opponentTyping && (
              <span className="flex gap-0.5 items-center">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#ec4899', animationDelay: `${i * 0.2}s` }} />
                ))}
              </span>
            )}
          </div>

          {/* Stakes copy */}
          {stakes && (
            <div
              className="inline-block px-4 py-2 rounded-xl text-xs font-extrabold animate-fade-in-up"
              style={{ background: 'var(--color-surface-hover)', border: '1.5px solid var(--color-border)', color: '#7c3aed' }}
            >
              {stakes}
            </div>
          )}

          {/* Opponent live board — scaled-up mini board, colors only */}
          <div
            className="rounded-2xl p-4 flex justify-center"
            style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
          >
            {liveTotalBoards <= 1 ? (
              <OpponentMiniBoard
                tiles={opponentTiles[0] || []}
                maxGuesses={spectatorRows}
                wordLength={wordLen}
                tileSize={16}
              />
            ) : (
              <OpponentMultiMiniBoard
                opponentTiles={opponentTiles}
                totalBoards={liveTotalBoards}
                maxGuesses={spectatorRows}
                wordLength={wordLen}
                tileSize={16}
              />
            )}
          </div>

          {/* Your stats */}
          {playerStats && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
              <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Your Result</div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-gray-500">Guesses</span>
                <span className="text-gray-800">{playerStats.guesses}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-gray-500">Time</span>
                <span className="text-gray-800">{formatTime(playerStats.timeMs)}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleForfeit}
            className="bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-400 hover:text-gray-600 font-bold px-6 py-2 rounded-xl transition-all flex items-center gap-2 mx-auto"
          >
            <X className="w-4 h-4" /> Leave
          </button>
        </div>

        {message && (
          <div className="absolute bottom-8 left-0 right-0 text-center">
            <span className="bg-gray-800 text-white text-sm font-bold px-4 py-2 rounded-lg">{message}</span>
          </div>
        )}
      </div>
    );
  }

  // Match screen
  const renderModeComponent = () => {
    const commonProps = {
      seed,
      mode,
      onBoardSolved: handleBoardSolved,
      onCompleted: handleCompleted,
      onGuessSubmitted: handleGuessSubmitted,
      opponentProgress,
      opponentTiles,
      startTime,
      onTyping: handleTyping,
    };

    switch (mode) {
      case GameMode.DUEL:
        return <VsClassic {...commonProps} />;
      case GameMode.QUORDLE:
        return <VsQuadword {...commonProps} />;
      case GameMode.OCTORDLE:
        return <VsOctoword {...commonProps} />;
      case GameMode.SEQUENCE:
        return <VsSuccession {...commonProps} />;
      case GameMode.RESCUE:
        return <VsDeliverance {...commonProps} />;
      case GameMode.GAUNTLET:
        return <VsGauntlet {...commonProps} onStageCompleted={handleStageCompleted} />;
      case GameMode.PROPERNOUNDLE:
        return <VsProperNoundle {...commonProps} puzzleMetadata={puzzleMetadata} />;
      case GameMode.DUEL_6:
        return <VsClassic {...commonProps} />;
      case GameMode.DUEL_7:
        return <VsClassic {...commonProps} />;
      default:
        return <VsClassic {...commonProps} />;
    }
  };

  return (
    <div className="h-screen-stable flex flex-col relative" style={{ backgroundColor: 'var(--color-bg)' }}>
      {xpResult && <XpToast xp={xpResult.xpGain} streakBonus={xpResult.streakBonus} dailyBonus={xpResult.dailyBonus} sweepBonus={xpResult.sweepBonus} flawlessBonus={xpResult.flawlessBonus} leveledUp={xpResult.leveledUp} newLevel={xpResult.newLevel} />}
      {/* Match Header. The Home button forfeits the match first so the
          server can end it cleanly and credit the opponent — just navigating
          away mid-VS leaves a dangling match. */}
      <div className="text-center py-2 shrink-0 relative">
        <GameHomeButton accentColor={accentColor} onClick={handleForfeit} />
        <h1 className={`text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r ${titleGradient}`}>
          VS {label}
        </h1>
      </div>

      {/* Persistent VS header: you vs opponent + tug-of-war lead bar */}
      <VsMatchHeader
        me={{
          username: profile?.username || 'You',
          avatarUrl: (profile as any)?.avatar_url ?? null,
          guesses: myGuessLog.length,
          progress: computeVsProgress(myBoardsSolved, totalBoards, bestRowGreens(myTiles), wordLen),
        }}
        opponent={{
          username: isCpu ? `${opponentInfo?.username || 'CPU'} 🤖` : (opponentInfo?.username || 'Opponent'),
          avatarUrl: opponentInfo?.avatarUrl ?? null,
          guesses: opponentProgress.attempts,
          progress: computeVsProgress(opponentProgress.boardsSolved, totalBoards, bestRowGreens(opponentTiles), wordLen),
        }}
        opponentTyping={opponentTyping}
      />

      {/* Moment callout — opponent milestones (greens / board solved / last guess) */}
      {callout && (
        <div className="absolute top-12 left-0 right-0 text-center z-40 pointer-events-none">
          <span
            key={callout.id}
            className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-extrabold px-4 py-2 rounded-full shadow-lg animate-fade-in-up"
          >
            {callout.text}
          </span>
        </div>
      )}

      {/* Game content fills remaining space */}
      <div className="flex-1 min-h-0">
        {renderModeComponent()}
      </div>

      {message && (
        <div className="absolute bottom-20 left-0 right-0 text-center z-30">
          <span className="bg-gray-800 text-white text-sm font-bold px-4 py-2 rounded-lg">{message}</span>
        </div>
      )}
    </div>
  );
}

/**
 * "Already played today" screen for freemium daily VS.
 *
 * Shown when a freemium user revisits /practice/vs?daily=true after
 * using their free daily VS match. Mirrors how the Classic mode's
 * "View Solved Puzzle" upsell works: the user can see today's answer
 * word, a countdown until tomorrow's puzzle, and a Go Pro CTA for
 * unlimited matches.
 */
function DailyVsAlreadyPlayed({
  answer,
  titleGradient,
  isPro,
}: {
  answer: string;
  titleGradient: string;
  isPro: boolean;
}) {
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const update = () => setCountdown(formatCountdown(getSecondsUntilMidnightLocal()));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const displayWord = answer ? answer.toUpperCase() : '';
  const letters = displayWord.split('');

  return (
    <div
      className="h-screen-stable flex flex-col items-center justify-center relative"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div className="text-center space-y-6 max-w-md w-full px-6">
        {/* Headline */}
        <div className="space-y-2 animate-fade-in-scale">
          <div
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Today&apos;s VS Puzzle
          </div>
          <h1
            className={`text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r ${titleGradient}`}
          >
            Already Played
          </h1>
        </div>

        {/* Answer tiles */}
        {letters.length > 0 && (
          <div
            className="flex items-center justify-center gap-1.5 animate-fade-in-up"
            style={{ animationDelay: '0.15s' }}
          >
            {letters.map((ch, i) => (
              <div
                key={i}
                className="w-11 h-11 rounded-md flex items-center justify-center text-lg font-black text-white"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  boxShadow: '0 3px 0 #5b21b6',
                }}
              >
                {ch}
              </div>
            ))}
          </div>
        )}

        {/* Countdown */}
        <div
          className="inline-block px-4 py-2 rounded-lg animate-fade-in-up"
          style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', animationDelay: '0.25s' }}
        >
          <span className="text-xs font-bold" style={{ color: '#7c3aed' }}>
            Next daily VS in {countdown}
          </span>
        </div>

        {/* Pro: prompt unlimited VS. Freemium: upsell to Pro. */}
        <p
          className="text-xs font-bold px-4 animate-fade-in"
          style={{ color: 'var(--color-text-secondary)', animationDelay: '0.35s' }}
        >
          {isPro
            ? 'Want more? Jump into unlimited VS battles with fresh puzzles.'
            : 'Upgrade to Pro for unlimited VS matches, rematches, and ad-free battles.'}
        </p>

        {/* Actions */}
        <div
          className="space-y-2 animate-fade-in-up"
          style={{ animationDelay: '0.45s' }}
        >
          {isPro ? (
            <Link href="/practice/vs" className="block">
              <button
                className="w-full py-3 rounded-xl text-white font-black text-sm btn-3d flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  boxShadow: '0 4px 0 #5b21b6',
                }}
              >
                <Swords className="w-4 h-4" />
                Play Unlimited VS
              </button>
            </Link>
          ) : (
            <Link href="/pro" className="block">
              <button
                className="w-full py-3 rounded-xl text-white font-black text-sm btn-3d flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  boxShadow: '0 4px 0 #92400e',
                }}
              >
                <Crown className="w-4 h-4" />
                Upgrade to Pro
              </button>
            </Link>
          )}
          <Link href="/" className="block">
            <button
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
              style={{
                background: 'var(--color-surface-alt)',
                border: '1px solid #e5e7eb',
                color: 'var(--color-text-secondary)',
              }}
            >
              <Home className="w-4 h-4" />
              Home
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
