'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GameMode, generateDailySeed, generateSolutionsFromSeed } from '@wordle-duel/core';
import Link from 'next/link';
import { SocketIOMatchService } from '@/lib/adapters/match-service';
import { usePresenceId } from '@/lib/presence-id';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult, type XpResult } from '@/lib/stats-service';
import { XpToast } from '@/components/effects/xp-toast';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';
import { markInviteAcceptedByCode } from '@/lib/invite-service';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Loader2, Home, RotateCcw, Trophy, X } from 'lucide-react';
import { GameHomeButton } from '@/components/game/game-home-button';
import {
  hasPlayedModeToday,
  recordModePlayed,
  getSecondsUntilMidnightUTC,
  formatCountdown,
} from '@/lib/play-limit-service';
import { VsLimitModal } from '@/components/modals/vs-limit-modal';
import { getTodayLocal } from '@/lib/daily-service';

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
    <AnimatePresence mode="wait">
      <motion.p
        key={index}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
        className="text-gray-500 text-lg font-bold"
      >
        {WAITING_PHRASES[index]}...
      </motion.p>
    </AnimatePresence>
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
};

const MODE_GRADIENTS: Record<string, string> = {
  [GameMode.DUEL]: 'from-blue-900 via-cyan-800 to-teal-700',
  [GameMode.QUORDLE]: 'from-purple-900 via-pink-800 to-orange-700',
  [GameMode.OCTORDLE]: 'from-indigo-900 via-purple-800 to-pink-700',
  [GameMode.SEQUENCE]: 'from-orange-900 via-red-800 to-pink-700',
  [GameMode.RESCUE]: 'from-indigo-900 via-purple-800 to-fuchsia-700',
  [GameMode.GAUNTLET]: 'from-purple-900 via-pink-800 to-orange-700',
  [GameMode.PROPERNOUNDLE]: 'from-red-900 via-rose-800 to-orange-700',
};

const MODE_TITLE_GRADIENTS: Record<string, string> = {
  [GameMode.DUEL]: 'from-cyan-400 via-blue-400 to-teal-400',
  [GameMode.QUORDLE]: 'from-yellow-400 via-pink-400 to-purple-400',
  [GameMode.OCTORDLE]: 'from-cyan-400 via-purple-400 to-pink-400',
  [GameMode.SEQUENCE]: 'from-yellow-400 via-orange-400 to-red-400',
  [GameMode.RESCUE]: 'from-indigo-400 via-purple-400 to-fuchsia-400',
  [GameMode.GAUNTLET]: 'from-yellow-400 via-pink-400 to-purple-400',
  [GameMode.PROPERNOUNDLE]: 'from-red-400 via-rose-400 to-orange-400',
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
};

export function VsGame({ mode, isDaily = false, inviteCode }: VsGameProps) {
  ensureDictionaryInitialized();

  const { profile, isProActive } = useAuth();
  const isPro = isProActive;

  // Freemium daily-VS gating is only active when (a) the caller asked
  // for the daily flow, (b) the user isn't pro, and (c) the mode is the
  // main Classic VS (DUEL). Other modes' VS buttons are pro-only so
  // they never reach this branch.
  const dailyVsActive = isDaily && !isPro && mode === GameMode.DUEL;

  // The deterministic seed for today's free daily VS puzzle. Intentionally
  // uses a different mode slug ("DUEL_VS") from Classic's daily
  // ("DUEL"), so the daily VS word is always different from the daily
  // Classic word even though both are derived from the same solution
  // list via generateSolutionsFromSeed.
  const todayDailySeed = useMemo(
    () => (dailyVsActive ? generateDailySeed(getTodayLocal(), 'DUEL_VS') : undefined),
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
  const [matchService] = useState(() => new SocketIOMatchService(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001'));
  const presenceId = usePresenceId();
  const [seed, setSeed] = useState('');
  const [startTime, setStartTime] = useState(0);
  const [queuePosition, setQueuePosition] = useState(0);
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
    });

    matchService.onMatchFound((data) => {
      setShowCountdown(true);
      setCountdown(data.countdownSeconds);

      // Private-match invites: flip the match_invites row to 'accepted'
      // now that the matchmaking server paired both invitees. Keeps the
      // pending-invites banner from lingering and stops a stale click
      // from spawning a ghost lobby for the next 24 hours.
      if (inviteCode) {
        markInviteAcceptedByCode(inviteCode, data.matchId).catch(() => {});
      }

      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      setTimeout(() => {
        setShowCountdown(false);
      }, data.countdownSeconds * 1000);
    });

    matchService.onMatchStart((data) => {
      setSeed(data.seed);
      setStartTime(data.startTime);
      setPuzzleMetadata(data.puzzleMetadata);
      setScreen('match');
      setOpponentProgress({ attempts: 0, boardsSolved: 0, totalBoards: 0 });
      setOpponentTiles({});
      resultRecordedRef.current = false;
    });

    matchService.onOpponentProgress((data: any) => {
      setOpponentProgress(data);
      if (data.latestGuess) {
        setOpponentTiles(prev => {
          const boardIdx = data.latestGuess.boardIndex ?? 0;
          const boardTiles = prev[boardIdx] || [];
          return { ...prev, [boardIdx]: [...boardTiles, data.latestGuess.tiles] };
        });
      }
    });

    matchService.onMatchEnded((data) => {
      setMatchResult(data);
      setScreen('result');

      // Record stats
      if (profile && !resultRecordedRef.current) {
        resultRecordedRef.current = true;
        const won = data.winner === 'player';
        recordGameResult(profile.id, mode, 'vs', won, data.playerGuesses, data.playerTime, seed)
          .then(xp => { if (xp) setXpResult(xp); });
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
    });

    matchService.onOpponentLeft(() => {
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
      matchService.joinQueue(mode, todayDailySeed, inviteCode);
    }

    return () => {
      matchService.disconnect();
    };
  }, [mode, matchService, profile, alreadyPlayedDaily, todayDailySeed, dailyVsActive]);

  const handleBoardSolved = useCallback((boardIndex: number) => {
    matchService.reportBoardSolved(boardIndex);
  }, [matchService]);

  const handleCompleted = useCallback((status: 'won' | 'lost', totalGuesses: number, timeMs: number) => {
    matchService.reportCompletion(status, totalGuesses, timeMs);
    setPlayerStats({ guesses: totalGuesses, timeMs });
    setScreen('waiting');
  }, [matchService]);

  const handleStageCompleted = useCallback((stageIndex: number) => {
    matchService.reportStageCompleted(stageIndex);
  }, [matchService]);

  const handleGuessSubmitted = useCallback((guess: string, boardIndex: number) => {
    matchService.submitGuess(guess, boardIndex);
  }, [matchService]);

  const handleCancel = useCallback(() => {
    matchService.leaveQueue();
    matchService.disconnect();
    window.location.href = '/';
  }, [matchService]);

  const handleHome = useCallback(() => {
    matchService.disconnect();
    window.location.href = '/';
  }, [matchService]);

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
      />
    );
  }

  // Queue screen
  if (screen === 'queue') {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center relative" style={{ backgroundColor: '#f8f7ff' }}>
        <VsLimitModal open={vsLimitOpen} onClose={() => { setVsLimitOpen(false); window.location.href = '/'; }} />
        {/* Countdown overlay */}
        <AnimatePresence>
          {showCountdown && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            >
              <div className="text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-gray-400 text-lg font-bold uppercase tracking-widest"
                >
                  Match Found
                </motion.div>
                <motion.div
                  key={countdown}
                  initial={{ scale: 2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className={`text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r ${titleGradient}`}
                >
                  {countdown}
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center space-y-6">
          <h1 className={`text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r ${titleGradient}`}>
            VS {label}
          </h1>

          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="h-16 w-16 text-purple-300 mx-auto" />
          </motion.div>

          <div className="space-y-2">
            <CyclingStatus />
            <p className="text-gray-400 text-sm">Position in queue: {queuePosition + 1}</p>
          </div>

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
    const headlineText = isWin ? 'VICTORY' : isDraw ? 'DRAW' : 'DEFEAT';
    const headlineColor = isWin ? 'from-green-400 to-emerald-300' : isDraw ? 'from-yellow-400 to-orange-300' : 'from-red-400 to-rose-300';

    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center relative" style={{ backgroundColor: '#f8f7ff' }}>
        {/* Rematch upsell for freemium — handleRematch sets this open */}
        <VsLimitModal open={vsLimitOpen} onClose={() => setVsLimitOpen(false)} />
        <div className="text-center space-y-8 max-w-md w-full px-6">
          {/* Headline */}
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 10, stiffness: 200 }}
          >
            <h1 className={`text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r ${headlineColor}`}>
              {headlineText}
            </h1>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-100 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 space-y-3"
          >
            <div className="flex justify-between text-gray-400 text-sm font-bold">
              <span>Your Guesses</span>
              <span className="text-gray-800">{matchResult?.playerGuesses}</span>
            </div>
            <div className="flex justify-between text-gray-400 text-sm font-bold">
              <span>Opponent Guesses</span>
              <span className="text-gray-800">{matchResult?.opponentGuesses}</span>
            </div>
            <div className="h-px bg-gray-200" />
            <div className="flex justify-between text-gray-400 text-sm font-bold">
              <span>Your Time</span>
              <span className="text-gray-800">{formatTime(matchResult?.playerTime || 0)}</span>
            </div>
            <div className="flex justify-between text-gray-400 text-sm font-bold">
              <span>Opponent Time</span>
              <span className="text-gray-800">{formatTime(matchResult?.opponentTime || 0)}</span>
            </div>
            {matchResult?.playerScore != null && (
              <>
                <div className="h-px bg-gray-200" />
                <div className="flex justify-between text-gray-400 text-sm font-bold">
                  <span>Your Score</span>
                  <span className="text-gray-800">{matchResult.playerScore.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-400 text-sm font-bold">
                  <span>Opponent Score</span>
                  <span className="text-gray-800">{matchResult.opponentScore.toFixed(2)}</span>
                </div>
                <p className="text-gray-400 text-[10px] text-center mt-1">Score = guesses + time penalty (lower is better)</p>
              </>
            )}
          </motion.div>

          {/* Rematch Status */}
          {rematchState === 'received' && (
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-white border-2 border-purple-300 rounded-xl p-4 text-center"
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
            </motion.div>
          )}

          {/* Actions */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex gap-3"
          >
            <button
              onClick={handleHome}
              className="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" /> Home
            </button>
            {rematchState === 'declined' ? (
              <div className="flex-1 bg-gray-100 border border-gray-200 text-gray-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                <X className="w-4 h-4" /> No Rematch
              </div>
            ) : rematchState === 'offered' ? (
              <div className={`flex-1 bg-gradient-to-r ${titleGradient} text-white/80 font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg`}>
                <Loader2 className="w-4 h-4 animate-spin" /> Waiting...
              </div>
            ) : rematchState !== 'received' ? (
              <button
                onClick={handleRematch}
                className={`flex-1 bg-gradient-to-r ${titleGradient} text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg`}
              >
                <RotateCcw className="w-4 h-4" /> Rematch
              </button>
            ) : null}
          </motion.div>
        </div>
      </div>
    );
  }

  // Waiting screen — shown after player completes, waiting for opponent
  if (screen === 'waiting') {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center relative" style={{ backgroundColor: '#f8f7ff' }}>
        <div className="text-center space-y-6 max-w-md w-full px-6">
          <h2 className={`text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r ${titleGradient}`}>
            Waiting for opponent...
          </h2>

          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="h-12 w-12 text-purple-300 mx-auto" />
          </motion.div>

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

          {/* Opponent progress */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">Opponent Progress</div>
            <div className="flex justify-between text-sm font-bold">
              <span className="text-gray-500">Guesses</span>
              <span className="text-gray-800">{opponentProgress.attempts}</span>
            </div>
            {opponentProgress.totalBoards > 1 && (
              <div className="flex justify-between text-sm font-bold">
                <span className="text-gray-500">Boards Solved</span>
                <span className="text-gray-800">{opponentProgress.boardsSolved}/{opponentProgress.totalBoards}</span>
              </div>
            )}
          </div>

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
      default:
        return <VsClassic {...commonProps} />;
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col relative" style={{ backgroundColor: '#f8f7ff' }}>
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
}: {
  answer: string;
  titleGradient: string;
}) {
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const update = () => setCountdown(formatCountdown(getSecondsUntilMidnightUTC()));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const displayWord = answer ? answer.toUpperCase() : '';
  const letters = displayWord.split('');

  return (
    <div
      className="h-[100dvh] flex flex-col items-center justify-center relative"
      style={{ backgroundColor: '#f8f7ff' }}
    >
      <div className="text-center space-y-6 max-w-md w-full px-6">
        {/* Headline */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 12, stiffness: 200 }}
          className="space-y-2"
        >
          <div
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: '#9ca3af' }}
          >
            Today&apos;s VS Puzzle
          </div>
          <h1
            className={`text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r ${titleGradient}`}
          >
            Already Played
          </h1>
        </motion.div>

        {/* Answer tiles */}
        {letters.length > 0 && (
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex items-center justify-center gap-1.5"
          >
            {letters.map((ch, i) => (
              <div
                key={i}
                className="w-11 h-11 rounded-md flex items-center justify-center text-lg font-black text-white"
                style={{
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  boxShadow: '0 3px 0 #15803d',
                }}
              >
                {ch}
              </div>
            ))}
          </motion.div>
        )}

        {/* Countdown */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="inline-block px-4 py-2 rounded-lg"
          style={{ background: '#f3f0ff', border: '1px solid #ede9f6' }}
        >
          <span className="text-xs font-bold" style={{ color: '#7c3aed' }}>
            Next daily VS in {countdown}
          </span>
        </motion.div>

        {/* Pro upsell copy */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-xs font-bold px-4"
          style={{ color: '#6b7280' }}
        >
          Upgrade to Pro for unlimited VS matches, rematches, and ad-free battles.
        </motion.p>

        {/* Actions */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="space-y-2"
        >
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
          <Link href="/" className="block">
            <button
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
              style={{
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                color: '#6b7280',
              }}
            >
              <Home className="w-4 h-4" />
              Home
            </button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
