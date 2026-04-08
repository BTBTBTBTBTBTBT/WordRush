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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8f7ff' }}>
        <div className="text-lg font-black" style={{ color: '#1a1a2e' }}>Loading...</div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#f8f7ff' }}>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl font-black" style={{ color: '#1a1a2e' }}>Player not found</h1>
          <p style={{ color: '#9ca3af' }}>This profile doesn't exist or may have been removed.</p>
          <Link href="/">
            <Button className="bg-gradient-to-r from-yellow-400 to-pink-500 text-white">
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
    <div className="min-h-screen p-4" style={{ backgroundColor: '#f8f7ff' }}>
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
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-1"
                style={{ background: '#fef9ec', border: '1.5px solid #fde68a' }}>
                <Star className="w-4 h-4" style={{ color: '#d97706' }} fill="currentColor" />
                <span className="font-bold text-sm" style={{ color: '#92400e' }}>Level {profile.level}</span>
              </div>
              <div className="w-48">
                <div className="h-2 rounded-full overflow-hidden" style={{ background: '#ede9f6' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${levelProgress}%` }}
                    transition={{ duration: 1, delay: 0.3 }}
                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
                  />
                </div>
                <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>{xpToNextLevel} XP to next level</p>
              </div>
            </div>
          </div>

          <Link href="/">
            <Button variant="outline" style={{ background: '#f3f0ff', border: '1.5px solid #ede9f6', color: '#7c3aed' }}>
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
            className="rounded-2xl p-6"
            style={{ background: '#ffffff', border: '1.5px solid #fde68a' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <Star className="w-8 h-8" style={{ color: '#d97706' }} fill="currentColor" />
              <div>
                <div className="text-sm" style={{ color: '#9ca3af' }}>Level</div>
                <div className="text-3xl font-black" style={{ color: '#1a1a2e' }}>{profile.level}</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm" style={{ color: '#9ca3af' }}>
                <span>Progress</span>
                <span>{xpToNextLevel} XP to next level</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#ede9f6' }}>
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
            className="rounded-2xl p-6"
            style={{ background: '#ffffff', border: '1.5px solid #bbf7d0' }}
          >
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8" style={{ color: '#16a34a' }} />
              <div>
                <div className="text-sm" style={{ color: '#9ca3af' }}>Total Wins</div>
                <div className="text-3xl font-black" style={{ color: '#1a1a2e' }}>{profile.total_wins}</div>
                <div className="text-xs mt-1" style={{ color: '#9ca3af' }}>{winRate}% win rate</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl p-6"
            style={{ background: '#ffffff', border: '1.5px solid #fed7aa' }}
          >
            <div className="flex items-center gap-3">
              <Flame className="w-8 h-8" style={{ color: '#ea580c' }} fill="currentColor" />
              <div>
                <div className="text-sm" style={{ color: '#9ca3af' }}>Current Streak</div>
                <div className="text-3xl font-black" style={{ color: '#1a1a2e' }}>{profile.current_streak}</div>
                <div className="text-xs mt-1" style={{ color: '#9ca3af' }}>Best: {profile.best_streak}</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="rounded-2xl p-6"
            style={{ background: '#ffffff', border: '1.5px solid #bfdbfe' }}
          >
            <div className="flex items-center gap-3">
              <Target className="w-8 h-8" style={{ color: '#2563eb' }} />
              <div>
                <div className="text-sm" style={{ color: '#9ca3af' }}>Total Games</div>
                <div className="text-3xl font-black" style={{ color: '#1a1a2e' }}>
                  {profile.total_wins + profile.total_losses}
                </div>
                <div className="text-xs mt-1" style={{ color: '#9ca3af' }}>{profile.total_losses} losses</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Stats Tabs */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="rounded-2xl p-6"
          style={{ background: '#ffffff', border: '1.5px solid #ede9f6' }}
        >
          <h2 className="text-2xl font-black mb-4 flex items-center gap-2" style={{ color: '#1a1a2e' }}>
            <TrendingUp className="w-6 h-6" style={{ color: '#ec4899' }} />
            Game Mode Statistics
          </h2>

          {/* Tab Buttons */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('solo')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all`}
              style={{
                background: activeTab === 'solo' ? '#f3f0ff' : '#fafafa',
                border: activeTab === 'solo' ? '1.5px solid #7c3aed' : '1.5px solid #ede9f6',
                color: activeTab === 'solo' ? '#7c3aed' : '#9ca3af',
              }}
            >
              <User className="w-4 h-4" />
              Solo
            </button>
            <button
              onClick={() => setActiveTab('vs')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all`}
              style={{
                background: activeTab === 'vs' ? '#f3f0ff' : '#fafafa',
                border: activeTab === 'vs' ? '1.5px solid #7c3aed' : '1.5px solid #ede9f6',
                color: activeTab === 'vs' ? '#7c3aed' : '#9ca3af',
              }}
            >
              <Swords className="w-4 h-4" />
              VS
            </button>
          </div>

          {filteredStats.length === 0 ? (
            <div className="text-center py-8" style={{ color: '#9ca3af' }}>
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
                  className="rounded-xl p-4"
                  style={{ background: '#f8f7ff', border: '1px solid #ede9f6' }}
                >
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: '#1a1a2e' }}>
                    <Zap className="w-5 h-5" style={{ color: '#d97706' }} />
                    {gameModeTitles[stat.game_mode] || stat.game_mode}
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div style={{ color: '#9ca3af' }}>Wins</div>
                      <div className="font-bold text-lg" style={{ color: '#16a34a' }}>{stat.wins}</div>
                    </div>
                    <div>
                      <div style={{ color: '#9ca3af' }}>Losses</div>
                      <div className="font-bold text-lg" style={{ color: '#dc2626' }}>{stat.losses}</div>
                    </div>
                    <div>
                      <div style={{ color: '#9ca3af' }}>Best Score</div>
                      <div className="font-bold text-lg" style={{ color: '#d97706' }}>{stat.best_score}</div>
                    </div>
                    <div>
                      <div style={{ color: '#9ca3af' }}>Fastest</div>
                      <div className="font-bold text-lg" style={{ color: '#2563eb' }}>
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
          className="rounded-2xl p-6"
          style={{ background: '#ffffff', border: '1.5px solid #ede9f6' }}
        >
          <h2 className="text-2xl font-black mb-6 flex items-center gap-2" style={{ color: '#1a1a2e' }}>
            <Clock className="w-6 h-6" style={{ color: '#2563eb' }} />
            Recent Matches
          </h2>

          {matches.length === 0 ? (
            <div className="text-center py-8" style={{ color: '#9ca3af' }}>
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
                    className="rounded-xl p-4 flex items-center justify-between gap-4"
                    style={{ background: '#f8f7ff', border: '1px solid #ede9f6' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isWinner ? '#f0fdf4' : '#fef2f2',
                          border: isWinner ? '1px solid #bbf7d0' : '1px solid #fecaca',
                        }}
                      >
                        {isWinner ? (
                          <Check className="w-5 h-5" style={{ color: '#16a34a' }} />
                        ) : (
                          <X className="w-5 h-5" style={{ color: '#dc2626' }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold truncate" style={{ color: '#1a1a2e' }}>
                          {gameModeTitles[match.game_mode] || match.game_mode}
                        </div>
                        <div className="text-sm" style={{ color: '#9ca3af' }}>
                          {isSolo ? 'Solo' : 'VS Match'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0 text-right">
                      <div>
                        <div className="font-bold text-sm" style={{ color: isWinner ? '#16a34a' : '#dc2626' }}>
                          {isWinner ? 'Win' : 'Loss'}
                        </div>
                        <div className="text-xs" style={{ color: '#9ca3af' }}>
                          {playerTime > 0 ? `${playerTime}s` : '-'}
                        </div>
                      </div>
                      <div className="text-xs text-right" style={{ color: '#9ca3af' }}>
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
