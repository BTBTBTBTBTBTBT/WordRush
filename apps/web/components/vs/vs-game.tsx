'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GameMode } from '@wordle-duel/core';
import { SocketIOMatchService } from '@/lib/adapters/match-service';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult } from '@/lib/stats-service';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Home, RotateCcw, Trophy, X } from 'lucide-react';
import { hasReachedVsLimit, recordVsMatch } from '@/lib/play-limit-service';
import { VsLimitModal } from '@/components/modals/vs-limit-modal';

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

export function VsGame({ mode }: VsGameProps) {
  ensureDictionaryInitialized();

  const { profile } = useAuth();
  const isPro = (profile as any)?.is_pro ?? false;
  const [vsLimitOpen, setVsLimitOpen] = useState(() => !isPro && hasReachedVsLimit());
  const [screen, setScreen] = useState<VsScreen>('queue');
  const [matchService] = useState(() => new SocketIOMatchService(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001'));
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

  const formatTime = (ms: number) => {
    const totalSec = Math.round(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const gradient = MODE_GRADIENTS[mode] || MODE_GRADIENTS[GameMode.DUEL];
  const titleGradient = MODE_TITLE_GRADIENTS[mode] || MODE_TITLE_GRADIENTS[GameMode.DUEL];
  const label = MODE_LABELS[mode] || 'VS';

  useEffect(() => {
    matchService.connect();

    matchService.onQueueStatus((data) => {
      setQueuePosition(data.position);
    });

    matchService.onMatchFound((data) => {
      setShowCountdown(true);
      setCountdown(data.countdownSeconds);

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
        recordGameResult(profile.id, mode, 'vs', won, data.playerGuesses, data.playerTime, seed);
      }
      // Record VS match for daily limit tracking
      if (!isPro) {
        recordVsMatch();
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

    // Only join queue if not VS-limited
    if (!vsLimitOpen) {
      matchService.joinQueue(mode);
    }

    return () => {
      matchService.disconnect();
    };
  }, [mode, matchService, profile, vsLimitOpen]);

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
    if (!isPro && hasReachedVsLimit()) {
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
      {/* Match Header */}
      <div className="text-center py-1 shrink-0">
        <div className="flex items-center justify-between px-4">
          <button
            onClick={handleForfeit}
            className="text-white/40 hover:text-gray-400 text-xs font-bold transition-colors"
          >
            Forfeit
          </button>
          <h1 className={`text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r ${titleGradient}`}>
            VS {label}
          </h1>
          <div className="w-12" /> {/* spacer */}
        </div>
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
