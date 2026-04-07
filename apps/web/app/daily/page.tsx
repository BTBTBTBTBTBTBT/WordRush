'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, Medal, Crown, ArrowLeft, Users, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AuthModal } from '@/components/auth/auth-modal';
import {
  fetchDailyLeaderboard,
  getUserDailyRank,
  getDailyPlayerCount,
  getSecondsUntilMidnightUTC,
  getTodayUTC,
  type LeaderboardEntry,
} from '@/lib/daily-service';

const GAME_MODES = [
  { id: 'DUEL', label: 'Classic', href: '/practice' },
  { id: 'QUORDLE', label: 'QuadWord', href: '/quordle' },
  { id: 'OCTORDLE', label: 'OctoWord', href: '/octordle' },
  { id: 'SEQUENCE', label: 'Succession', href: '/sequence' },
  { id: 'RESCUE', label: 'Deliverance', href: '/rescue' },
  { id: 'GAUNTLET', label: 'Gauntlet', href: '/gauntlet' },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function CountdownTimer() {
  const [secondsLeft, setSecondsLeft] = useState(getSecondsUntilMidnightUTC());

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(getSecondsUntilMidnightUTC());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="flex items-center gap-1 text-white/60 text-sm font-mono">
      <Clock className="w-3.5 h-3.5" />
      <span>
        {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
      </span>
    </div>
  );
}

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-slate-300" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
  return <span className="text-white/40 text-sm font-bold w-5 text-center">{rank}</span>;
}

export default function DailyPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState('DUEL');
  const [playType, setPlayType] = useState<'solo' | 'vs'>('solo');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<{ rank: number; totalPlayers: number } | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showYesterday, setShowYesterday] = useState(false);
  const [yesterdayLeaderboard, setYesterdayLeaderboard] = useState<LeaderboardEntry[]>([]);

  const today = getTodayUTC();
  const yesterday = useMemo(() => {
    return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [lb, count] = await Promise.all([
        fetchDailyLeaderboard(selectedMode, playType, today, 50),
        getDailyPlayerCount(selectedMode, today),
      ]);
      setLeaderboard(lb);
      setPlayerCount(count);

      if (user) {
        const rank = await getUserDailyRank(user.id, selectedMode, playType, today);
        setUserRank(rank);
      }
      setLoading(false);
    }
    load();
  }, [selectedMode, playType, user, today]);

  useEffect(() => {
    if (showYesterday) {
      fetchDailyLeaderboard(selectedMode, playType, yesterday, 3).then(setYesterdayLeaderboard);
    }
  }, [showYesterday, selectedMode, playType, yesterday]);

  const modeConfig = GAME_MODES.find(m => m.id === selectedMode)!;

  const handlePlayDaily = () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    // Navigate to game with daily seed param
    router.push(`${modeConfig.href}?daily=true`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-orange-700 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-yellow-400 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-pink-500 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="text-center">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400">
              DAILY CHALLENGE
            </h1>
            <div className="flex items-center justify-center gap-3 mt-1">
              <div className="flex items-center gap-1 text-white/60 text-sm">
                <Calendar className="w-3.5 h-3.5" />
                <span>{new Date(today + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
              <CountdownTimer />
            </div>
          </div>
          <div className="w-6" />
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {GAME_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setSelectedMode(mode.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                selectedMode === mode.id
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Solo/VS Toggle */}
        <div className="flex gap-2 mb-4">
          {(['solo', 'vs'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setPlayType(type)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                playType === type
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
              }`}
            >
              {type === 'solo' ? 'Solo' : 'VS'}
            </button>
          ))}
        </div>

        {/* Player Count + Play CTA */}
        <div className="flex items-center justify-between bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 mb-4">
          <div className="flex items-center gap-2 text-white/70 text-sm">
            <Users className="w-4 h-4" />
            <span>{playerCount} player{playerCount !== 1 ? 's' : ''} today</span>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handlePlayDaily}
            className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-lg shadow-lg hover:shadow-amber-500/50 transition-shadow text-sm"
          >
            Play Today's {modeConfig.label}
          </motion.button>
        </div>

        {/* User Rank */}
        {userRank && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl p-3 mb-4 text-center"
          >
            <span className="text-white/80 text-sm">You're ranked </span>
            <span className="text-yellow-400 font-black text-lg">#{userRank.rank}</span>
            <span className="text-white/80 text-sm"> of {userRank.totalPlayers}</span>
          </motion.div>
        )}

        {/* Leaderboard */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          <div className="p-3 border-b border-white/10">
            <h2 className="text-white font-bold text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              Today's Leaderboard
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-white/40 text-sm">Loading...</div>
          ) : leaderboard.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-sm">No results yet. Be the first!</div>
          ) : (
            <div className="divide-y divide-white/5">
              {leaderboard.map((entry, index) => {
                const rank = index + 1;
                const isCurrentUser = user && entry.user_id === user.id;
                return (
                  <motion.div
                    key={entry.user_id}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                    className={`flex items-center gap-3 px-4 py-3 ${
                      isCurrentUser ? 'bg-yellow-500/10' : ''
                    } ${rank <= 3 ? 'bg-white/5' : ''}`}
                  >
                    <MedalIcon rank={rank} />

                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/profile/${entry.user_id}`}
                        className="text-white text-sm font-bold truncate hover:text-yellow-400 transition-colors block"
                      >
                        {entry.username}
                        {isCurrentUser && <span className="text-yellow-400 ml-1">(you)</span>}
                      </Link>
                    </div>

                    <div className="text-right space-y-0.5">
                      <div className="text-white font-bold text-sm">{entry.composite_score}</div>
                      <div className="text-white/40 text-xs">
                        {playType === 'solo' ? (
                          <>
                            {entry.guess_count}g · {formatTime(entry.time_seconds)}
                            {entry.total_boards > 1 && ` · ${entry.boards_solved}/${entry.total_boards}`}
                          </>
                        ) : (
                          <>{entry.vs_wins}W / {entry.vs_games}G</>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Yesterday's Winners */}
        <button
          onClick={() => setShowYesterday(!showYesterday)}
          className="w-full mt-4 flex items-center justify-center gap-2 text-white/40 hover:text-white/60 text-sm font-bold transition-colors py-2"
        >
          Yesterday's Winners
          {showYesterday ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <AnimatePresence>
          {showYesterday && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden mb-4">
                {yesterdayLeaderboard.length === 0 ? (
                  <div className="p-6 text-center text-white/40 text-sm">No results from yesterday</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {yesterdayLeaderboard.map((entry, index) => (
                      <div key={entry.user_id} className="flex items-center gap-3 px-4 py-3">
                        <MedalIcon rank={index + 1} />
                        <span className="text-white text-sm font-bold flex-1 truncate">{entry.username}</span>
                        <span className="text-white/60 text-sm font-bold">{entry.composite_score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </div>
  );
}
