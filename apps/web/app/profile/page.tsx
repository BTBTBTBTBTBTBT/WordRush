'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';
import { motion } from 'framer-motion';
import { Trophy, Target, Flame, Clock, TrendingUp, Award, Star, Zap } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Database } from '@/lib/database.types';

type UserStats = Database['public']['Tables']['user_stats']['Row'];

export default function ProfilePage() {
  const { profile, loading } = useAuth();
  const [stats, setStats] = useState<UserStats[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchStats();
    }
  }, [profile]);

  const fetchStats = async () => {
    if (!profile) return;

    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', profile.id);

    if (data) {
      setStats(data);
    }

    setLoadingStats(false);
  };

  if (loading || loadingStats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-orange-700 flex items-center justify-center">
        <div className="text-white text-2xl font-bold">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-orange-700 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-black text-white">Please sign in to view your profile</h1>
          <Link href="/">
            <Button className="bg-gradient-to-r from-yellow-400 to-pink-500">
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const levelProgress = (profile.xp % 1000) / 10;
  const xpToNextLevel = 1000 - (profile.xp % 1000);

  const winRate = profile.total_wins + profile.total_losses > 0
    ? ((profile.total_wins / (profile.total_wins + profile.total_losses)) * 100).toFixed(1)
    : '0.0';

  const gameModeTitles: Record<string, string> = {
    DUEL: 'Classic Duel',
    MULTI_DUEL: 'Multi Duel',
    GAUNTLET: 'Gauntlet',
    QUORDLE: 'QuadWord',
    OCTORDLE: 'OctoWord',
    SEQUENCE: 'Succession',
    RESCUE: 'Deliverance',
    TOURNAMENT: 'Tournament',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-orange-700 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center"
        >
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 drop-shadow-lg mb-2">
            {profile.username}
          </h1>
          <Link href="/">
            <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              Back to Home
            </Button>
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-sm rounded-2xl p-6 border-2 border-yellow-400/30"
          >
            <div className="flex items-center gap-3 mb-3">
              <Star className="w-8 h-8 text-yellow-400" fill="currentColor" />
              <div>
                <div className="text-white/70 text-sm">Level</div>
                <div className="text-3xl font-black text-white">{profile.level}</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-white/70">
                <span>Progress</span>
                <span>{xpToNextLevel} XP to next level</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${levelProgress}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
                />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm rounded-2xl p-6 border-2 border-green-400/30"
          >
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-green-400" />
              <div>
                <div className="text-white/70 text-sm">Total Wins</div>
                <div className="text-3xl font-black text-white">{profile.total_wins}</div>
                <div className="text-white/70 text-xs mt-1">{winRate}% win rate</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-orange-500/20 to-red-500/20 backdrop-blur-sm rounded-2xl p-6 border-2 border-orange-400/30"
          >
            <div className="flex items-center gap-3">
              <Flame className="w-8 h-8 text-orange-400" fill="currentColor" />
              <div>
                <div className="text-white/70 text-sm">Current Streak</div>
                <div className="text-3xl font-black text-white">{profile.current_streak}</div>
                <div className="text-white/70 text-xs mt-1">Best: {profile.best_streak}</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-sm rounded-2xl p-6 border-2 border-blue-400/30"
          >
            <div className="flex items-center gap-3">
              <Target className="w-8 h-8 text-blue-400" />
              <div>
                <div className="text-white/70 text-sm">Total Games</div>
                <div className="text-3xl font-black text-white">
                  {profile.total_wins + profile.total_losses}
                </div>
                <div className="text-white/70 text-xs mt-1">{profile.total_losses} losses</div>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-white/20"
        >
          <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-pink-400" />
            Game Mode Statistics
          </h2>

          {stats.length === 0 ? (
            <div className="text-center text-white/70 py-8">
              Play some games to see your stats here!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className="bg-white/5 rounded-xl p-4 border border-white/10"
                >
                  <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    {gameModeTitles[stat.game_mode] || stat.game_mode}
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-white/70">Wins</div>
                      <div className="text-green-400 font-bold text-lg">{stat.wins}</div>
                    </div>
                    <div>
                      <div className="text-white/70">Losses</div>
                      <div className="text-red-400 font-bold text-lg">{stat.losses}</div>
                    </div>
                    <div>
                      <div className="text-white/70">Best Score</div>
                      <div className="text-yellow-400 font-bold text-lg">{stat.best_score}</div>
                    </div>
                    <div>
                      <div className="text-white/70">Fastest</div>
                      <div className="text-blue-400 font-bold text-lg">
                        {stat.fastest_time > 0 ? `${stat.fastest_time}s` : '-'}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
