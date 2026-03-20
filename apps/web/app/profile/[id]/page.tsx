'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { motion } from 'framer-motion';
import {
  Trophy,
  Target,
  Flame,
  Clock,
  TrendingUp,
  Star,
  Zap,
  Swords,
  User,
  Check,
  X,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AvatarUpload } from '@/components/profile/avatar-upload';
import type { Database } from '@/lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type UserStats = Database['public']['Tables']['user_stats']['Row'];
type Match = Database['public']['Tables']['matches']['Row'];

const gameModeTitles: Record<string, string> = {
  DUEL: 'Classic',
  MULTI_DUEL: 'Multi Duel',
  GAUNTLET: 'Gauntlet',
  QUORDLE: 'QuadWord',
  OCTORDLE: 'OctoWord',
  SEQUENCE: 'Succession',
  RESCUE: 'Deliverance',
  TOURNAMENT: 'Tournament',
};

export default function PublicProfilePage() {
  const params = useParams();
  const profileId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<UserStats[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<'solo' | 'vs'>('solo');

  useEffect(() => {
    if (profileId) {
      fetchAll();
    }
  }, [profileId]);

  const fetchAll = async () => {
    setLoading(true);

    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .maybeSingle();

    if (!profileData || error) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setProfile(profileData);

    const [statsRes, matchesRes] = await Promise.all([
      supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', profileId),
      supabase
        .from('matches')
        .select('*')
        .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    if (statsRes.data) setStats(statsRes.data);
    if (matchesRes.data) setMatches(matchesRes.data);

    setLoading(false);
  };

  const filteredStats = stats.filter((s) => s.play_type === activeTab);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-orange-700 flex items-center justify-center">
        <div className="text-white text-2xl font-bold">Loading...</div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-orange-700 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl font-black text-white">Player not found</h1>
          <p className="text-white/70">This profile doesn't exist or may have been removed.</p>
          <Link href="/">
            <Button className="bg-gradient-to-r from-yellow-400 to-pink-500">
              Go Home
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  const levelProgress = (profile.xp % 1000) / 10;
  const xpToNextLevel = 1000 - (profile.xp % 1000);

  const winRate = profile.total_wins + profile.total_losses > 0
    ? ((profile.total_wins / (profile.total_wins + profile.total_losses)) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-orange-700 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Section */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <AvatarUpload
            size={112}
            editable={false}
            avatarUrl={profile.avatar_url}
            username={profile.username}
          />

          <div className="text-center">
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 drop-shadow-lg">
              {profile.username}
            </h1>

            {/* Level Badge & XP Bar */}
            <div className="mt-3 flex flex-col items-center gap-2">
              <div className="inline-flex items-center gap-2 bg-yellow-500/20 border border-yellow-400/30 rounded-full px-4 py-1">
                <Star className="w-4 h-4 text-yellow-400" fill="currentColor" />
                <span className="text-yellow-300 font-bold text-sm">Level {profile.level}</span>
              </div>
              <div className="w-48">
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${levelProgress}%` }}
                    transition={{ duration: 1, delay: 0.3 }}
                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
                  />
                </div>
                <p className="text-white/50 text-xs mt-1">{xpToNextLevel} XP to next level</p>
              </div>
            </div>
          </div>

          <Link href="/">
            <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
        </motion.div>

        {/* Overall Stats Row */}
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

        {/* Stats Tabs */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-white/20"
        >
          <h2 className="text-2xl font-black text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-pink-400" />
            Game Mode Statistics
          </h2>

          {/* Tab Buttons */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('solo')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                activeTab === 'solo'
                  ? 'bg-white/20 border-2 border-white/30 text-white shadow-lg'
                  : 'bg-white/5 border-2 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
              }`}
            >
              <User className="w-4 h-4" />
              Solo
            </button>
            <button
              onClick={() => setActiveTab('vs')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                activeTab === 'vs'
                  ? 'bg-white/20 border-2 border-white/30 text-white shadow-lg'
                  : 'bg-white/5 border-2 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
              }`}
            >
              <Swords className="w-4 h-4" />
              VS
            </button>
          </div>

          {filteredStats.length === 0 ? (
            <div className="text-center text-white/70 py-8">
              {activeTab === 'solo'
                ? 'No solo stats yet.'
                : 'No VS stats yet.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredStats.map((stat, index) => (
                <motion.div
                  key={stat.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 + index * 0.1 }}
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

        {/* Recent Matches Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-white/20"
        >
          <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-2">
            <Clock className="w-6 h-6 text-blue-400" />
            Recent Matches
          </h2>

          {matches.length === 0 ? (
            <div className="text-center text-white/70 py-8">
              No matches played yet.
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((match, index) => {
                const isSolo = !match.player2_id;
                const isWinner = match.winner_id === profile.id;
                const isPlayer1 = match.player1_id === profile.id;
                const playerTime = isPlayer1 ? match.player1_time : (match.player2_time ?? 0);
                const matchDate = new Date(match.created_at);

                return (
                  <motion.div
                    key={match.id}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.7 + index * 0.05 }}
                    className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isWinner
                            ? 'bg-green-500/20 border border-green-400/30'
                            : 'bg-red-500/20 border border-red-400/30'
                        }`}
                      >
                        {isWinner ? (
                          <Check className="w-5 h-5 text-green-400" />
                        ) : (
                          <X className="w-5 h-5 text-red-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-white font-bold truncate">
                          {gameModeTitles[match.game_mode] || match.game_mode}
                        </div>
                        <div className="text-white/50 text-sm">
                          {isSolo ? 'Solo' : 'VS Match'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0 text-right">
                      <div>
                        <div className={`font-bold text-sm ${isWinner ? 'text-green-400' : 'text-red-400'}`}>
                          {isWinner ? 'Win' : 'Loss'}
                        </div>
                        <div className="text-white/50 text-xs">
                          {playerTime > 0 ? `${playerTime}s` : '-'}
                        </div>
                      </div>
                      <div className="text-white/40 text-xs text-right">
                        <div>{matchDate.toLocaleDateString()}</div>
                        <div>{matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
