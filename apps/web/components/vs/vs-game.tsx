'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GameMode } from '@wordle-duel/core';
import { SocketIOMatchService } from '@/lib/adapters/match-service';
import { useAuth } from '@/lib/auth-context';
import { recordGameResult } from '@/lib/stats-service';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Home, RotateCcw, Trophy, X } from 'lucide-react';

import { VsClassic } from './vs-classic';
import { VsQuadword } from './vs-quadword';
import { VsOctoword } from './vs-octoword';
import { VsSuccession } from './vs-succession';
import { VsDeliverance } from './vs-deliverance';
import { VsGauntlet } from './vs-gauntlet';

interface VsGameProps {
  mode: GameMode;
}

type VsScreen = 'queue' | 'warmup' | 'match' | 'result';

const MODE_LABELS: Record<string, string> = {
  [GameMode.DUEL]: 'CLASSIC',
  [GameMode.QUORDLE]: 'QUADWORD',
  [GameMode.OCTORDLE]: 'OCTOWORD',
  [GameMode.SEQUENCE]: 'SUCCESSION',
  [GameMode.RESCUE]: 'DELIVERANCE',
  [GameMode.GAUNTLET]: 'GAUNTLET',
};

const MODE_GRADIENTS: Record<string, string> = {
  [GameMode.DUEL]: 'from-blue-900 via-cyan-800 to-teal-700',
  [GameMode.QUORDLE]: 'from-purple-900 via-pink-800 to-orange-700',
  [GameMode.OCTORDLE]: 'from-indigo-900 via-purple-800 to-pink-700',
  [GameMode.SEQUENCE]: 'from-orange-900 via-red-800 to-pink-700',
  [GameMode.RESCUE]: 'from-indigo-900 via-purple-800 to-fuchsia-700',
  [GameMode.GAUNTLET]: 'from-purple-900 via-pink-800 to-orange-700',
};

const MODE_TITLE_GRADIENTS: Record<string, string> = {
  [GameMode.DUEL]: 'from-cyan-400 via-blue-400 to-teal-400',
  [GameMode.QUORDLE]: 'from-yellow-400 via-pink-400 to-purple-400',
  [GameMode.OCTORDLE]: 'from-cyan-400 via-purple-400 to-pink-400',
  [GameMode.SEQUENCE]: 'from-yellow-400 via-orange-400 to-red-400',
  [GameMode.RESCUE]: 'from-indigo-400 via-purple-400 to-fuchsia-400',
  [GameMode.GAUNTLET]: 'from-yellow-400 via-pink-400 to-purple-400',
};

export function VsGame({ mode }: VsGameProps) {
  ensureDictionaryInitialized();

  const { profile } = useAuth();
  const [screen, setScreen] = useState<VsScreen>('queue');
  const [matchService] = useState(() => new SocketIOMatchService(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001'));
  const [seed, setSeed] = useState('');
  const [startTime, setStartTime] = useState(0);
  const [queuePosition, setQueuePosition] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [showCountdown, setShowCountdown] = useState(false);
  const [opponentProgress, setOpponentProgress] = useState({ attempts: 0, boardsSolved: 0, totalBoards: 0 });
  const [matchResult, setMatchResult] = useState<any>(null);
  const [message, setMessage] = useState('');
  const resultRecordedRef = useRef(false);

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
      setScreen('match');
      setOpponentProgress({ attempts: 0, boardsSolved: 0, totalBoards: 0 });
      resultRecordedRef.current = false;
    });

    matchService.onOpponentProgress((data) => {
      setOpponentProgress(data);
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
    });

    matchService.onRematchStart((data) => {
      setSeed(data.seed);
      setStartTime(Date.now());
      setScreen('match');
      setOpponentProgress({ attempts: 0, boardsSolved: 0, totalBoards: 0 });
      setMatchResult(null);
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

    matchService.joinQueue(mode);

    return () => {
      matchService.disconnect();
    };
  }, [mode, matchService, profile]);

  const handleBoardSolved = useCallback((boardIndex: number) => {
    matchService.reportBoardSolved(boardIndex);
  }, [matchService]);

  const handleCompleted = useCallback((status: 'won' | 'lost', totalGuesses: number, timeMs: number) => {
    matchService.reportCompletion(status, totalGuesses, timeMs);
  }, [matchService]);

  const handleStageCompleted = useCallback((stageIndex: number) => {
    matchService.reportStageCompleted(stageIndex);
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
    matchService.offerRematch();
  }, [matchService]);

  const handleForfeit = useCallback(() => {
    matchService.abandonMatch();
    matchService.disconnect();
    window.location.href = '/';
  }, [matchService]);

  // Queue screen
  if (screen === 'queue') {
    return (
      <div className={`h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-br ${gradient} relative`}>
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
                  className="text-white/50 text-lg font-bold uppercase tracking-widest"
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
            <Loader2 className="h-16 w-16 text-white/40 mx-auto" />
          </motion.div>

          <div className="space-y-2">
            <p className="text-white/70 text-lg font-bold">Finding Opponent...</p>
            <p className="text-white/40 text-sm">Position in queue: {queuePosition + 1}</p>
          </div>

          <button
            onClick={handleCancel}
            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white/70 hover:text-white font-bold px-6 py-2 rounded-xl transition-all flex items-center gap-2 mx-auto"
          >
            <X className="w-4 h-4" /> Cancel
          </button>
        </div>

        {message && (
          <div className="absolute bottom-8 left-0 right-0 text-center">
            <span className="bg-black/70 text-white text-sm font-bold px-4 py-2 rounded-lg">{message}</span>
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
      <div className={`h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-br ${gradient} relative`}>
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
            className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-3"
          >
            <div className="flex justify-between text-white/70 text-sm font-bold">
              <span>Your Guesses</span>
              <span className="text-white">{matchResult?.playerGuesses}</span>
            </div>
            <div className="flex justify-between text-white/70 text-sm font-bold">
              <span>Opponent Guesses</span>
              <span className="text-white">{matchResult?.opponentGuesses}</span>
            </div>
            <div className="h-px bg-white/10" />
            <div className="flex justify-between text-white/70 text-sm font-bold">
              <span>Your Time</span>
              <span className="text-white">{Math.round((matchResult?.playerTime || 0) / 1000)}s</span>
            </div>
            <div className="flex justify-between text-white/70 text-sm font-bold">
              <span>Opponent Time</span>
              <span className="text-white">{Math.round((matchResult?.opponentTime || 0) / 1000)}s</span>
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex gap-3"
          >
            <button
              onClick={handleHome}
              className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" /> Home
            </button>
            <button
              onClick={handleRematch}
              className={`flex-1 bg-gradient-to-r ${titleGradient} text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg`}
            >
              <RotateCcw className="w-4 h-4" /> Rematch
            </button>
          </motion.div>
        </div>
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
      opponentProgress,
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
      default:
        return <VsClassic {...commonProps} />;
    }
  };

  return (
    <div className={`h-[100dvh] flex flex-col bg-gradient-to-br ${gradient} relative`}>
      {/* Match Header */}
      <div className="text-center py-1 shrink-0">
        <div className="flex items-center justify-between px-4">
          <button
            onClick={handleForfeit}
            className="text-white/40 hover:text-white/70 text-xs font-bold transition-colors"
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
          <span className="bg-black/70 text-white text-sm font-bold px-4 py-2 rounded-lg">{message}</span>
        </div>
      )}
    </div>
  );
}
