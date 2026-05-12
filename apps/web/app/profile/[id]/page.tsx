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
import { SocialLinksDisplay, type SocialLinks } from '@/components/profile/social-links';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ModePicker, PROFILE_MODES } from '@/components/profile/mode-picker';
import { TopWordsCard } from '@/components/profile/top-words-card';
import { fetchTopWords } from '@/lib/stats-service';
import type { Database } from '@/lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type UserStats = Database['public']['Tables']['user_stats']['Row'];
type Match = Database['public']['Tables']['matches']['Row'];

const getMode = (dbKey: string) => PROFILE_MODES.find((m) => m.dbKey === dbKey);

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export default function PublicProfilePage() {
  const params = useParams();
  const profileId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<UserStats[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<'solo' | 'vs'>('solo');
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [topWords, setTopWords] = useState<Array<{ word: string; count: number; wins: number }>>([]);

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
        .select('id, game_mode, player1_id, player2_id, winner_id, player1_score, player2_score, player1_time, player2_time, created_at')
        .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    if (statsRes.data) setStats(statsRes.data);
    if (matchesRes.data) setMatches(matchesRes.data);

    setLoading(false);
  };

  useEffect(() => {
    if (selectedMode && profileId) {
      fetchTopWords(profileId, selectedMode, 5).then(setTopWords);
    } else {
      setTopWords([]);
    }
  }, [selectedMode, profileId]);

  const filteredStats = stats.filter((s) => s.play_type === activeTab);
  const selectedModeStat = selectedMode ? filteredStats.find((s) => s.game_mode === selectedMode) : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="text-lg font-black" style={{ color: 'var(--color-text)' }}>Loading...</div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg)' }}>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl font-black" style={{ color: 'var(--color-text)' }}>Player not found</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>This profile doesn't exist or may have been removed.</p>
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
    <div className="min-h-screen p-4 pb-24" style={{ backgroundColor: 'var(--color-bg)' }}>
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
                style={{ background: 'var(--color-highlight-gold)', border: '1.5px solid var(--color-gold-border)' }}>
                <Star className="w-4 h-4" style={{ color: '#d97706' }} fill="currentColor" />
                <span className="font-bold text-sm" style={{ color: '#92400e' }}>Level {profile.level}</span>
              </div>
              <div className="w-48">
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${levelProgress}%` }}
                    transition={{ duration: 1, delay: 0.3 }}
                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
                  />
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{xpToNextLevel} XP to next level</p>
              </div>
            </div>
          </div>

          <SocialLinksDisplay links={(profile as any).social_links as SocialLinks | null} />

          <Link href="/">
            <Button variant="outline" style={{ background: 'var(--color-surface-hover)', border: '1.5px solid var(--color-border)', color: '#7c3aed' }}>
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
            style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-gold-border)' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <Star className="w-8 h-8" style={{ color: '#d97706' }} fill="currentColor" />
              <div>
                <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Level</div>
                <div className="text-3xl font-black" style={{ color: 'var(--color-text)' }}>{profile.level}</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <span>Progress</span>
                <span>{xpToNextLevel} XP to next level</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
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
            style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-win-bg)' }}
          >
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8" style={{ color: '#16a34a' }} />
              <div>
                <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Total Wins</div>
                <div className="text-3xl font-black" style={{ color: 'var(--color-text)' }}>{profile.total_wins}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{winRate}% win rate</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl p-6"
            style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-gold-border-light)' }}
          >
            <div className="flex items-center gap-3">
              <Flame className="w-8 h-8" style={{ color: '#ea580c' }} fill="currentColor" />
              <div>
                <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Win Streak</div>
                <div className="text-3xl font-black" style={{ color: 'var(--color-text)' }}>{profile.current_streak}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Best: {profile.best_streak}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--color-gold-border-light)' }}>
              <Zap className="w-6 h-6" style={{ color: '#7c3aed' }} />
              <div>
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Daily Login Streak</div>
                <div className="text-xl font-black" style={{ color: 'var(--color-text)' }}>{(profile as any).daily_login_streak ?? 0}</div>
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Best: {(profile as any).best_daily_login_streak ?? 0}</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="rounded-2xl p-6"
            style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-3">
              <Target className="w-8 h-8" style={{ color: '#2563eb' }} />
              <div>
                <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Total Games</div>
                <div className="text-3xl font-black" style={{ color: 'var(--color-text)' }}>
                  {profile.total_wins + profile.total_losses}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{profile.total_losses} losses</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Stats Tabs */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="space-y-3"
        >
          <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Game Mode Statistics
          </div>

          {/* Solo / VS toggle */}
          <div className="flex gap-2">
            {(['solo', 'vs'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all"
                style={{
                  background: activeTab === t ? 'var(--color-surface)' : 'var(--color-surface-hover)',
                  border: activeTab === t ? '1.5px solid #7c3aed' : '1.5px solid var(--color-border)',
                  color: activeTab === t ? '#7c3aed' : 'var(--color-text-muted)',
                }}
              >
                {t === 'solo' ? <User className="w-3.5 h-3.5" /> : <Swords className="w-3.5 h-3.5" />}
                {t === 'solo' ? 'Solo' : 'VS'}
              </button>
            ))}
          </div>

          {/* Mode Picker */}
          <ModePicker
            showAll={false}
            selectedMode={selectedMode || (filteredStats[0]?.game_mode ?? 'DUEL')}
            onSelectMode={(m) => setSelectedMode(m || 'DUEL')}
          />

          {/* Selected mode stats card */}
          {(() => {
            const modeKey = selectedMode || filteredStats[0]?.game_mode || 'DUEL';
            const stat = filteredStats.find((s) => s.game_mode === modeKey);
            const mode = getMode(modeKey);
            const color = mode?.accentColor || '#7c3aed';
            const Icon = mode?.icon;

            return (
              <div
                className="overflow-hidden"
                style={{
                  background: 'var(--color-surface)',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: '16px',
                }}
              >
                <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
                <div className="px-4 pt-3 pb-2 flex items-center gap-2.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}15` }}
                  >
                    {mode?.romanNumeral ? (
                      <span className="text-[11px] font-black leading-none" style={{ color }}>{mode.romanNumeral}</span>
                    ) : Icon ? (
                      <Icon className="w-4 h-4" style={{ color }} />
                    ) : null}
                  </div>
                  <div className="font-black text-sm" style={{ color: 'var(--color-text)' }}>
                    {mode?.title || modeKey}
                  </div>
                </div>

                {stat ? (
                  <div className="p-4">
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: 'Wins', value: stat.wins, color: '#16a34a' },
                        { label: 'Losses', value: stat.losses, color: '#dc2626' },
                        { label: 'Best', value: stat.best_score > 0 ? stat.best_score : '-', color: '#d97706' },
                        { label: 'Fastest', value: stat.fastest_time > 0 ? formatDuration(stat.fastest_time) : '-', color: '#2563eb' },
                      ].map((s) => (
                        <div key={s.label} className="text-center">
                          <div className="text-lg font-black leading-tight" style={{ color: 'var(--color-text)' }}>{s.value}</div>
                          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
                      No {activeTab} games played in this mode yet
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Top Words for selected mode */}
          {topWords.length > 0 && (
            <TopWordsCard
              words={topWords}
              accentColor={getMode(selectedMode || filteredStats[0]?.game_mode || 'DUEL')?.accentColor || '#7c3aed'}
            />
          )}
        </motion.div>

        {/* Recent Matches Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="rounded-2xl p-6"
          style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
        >
          <h2 className="text-2xl font-black mb-6 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
            <Clock className="w-6 h-6" style={{ color: '#2563eb' }} />
            Recent Matches
          </h2>

          {matches.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
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
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isWinner ? 'var(--color-win-bg)' : 'var(--color-loss-bg)',
                          border: isWinner ? '1px solid var(--color-win-text)' : '1px solid var(--color-loss-text)',
                          opacity: 0.9,
                        }}
                      >
                        {isWinner ? (
                          <Check className="w-5 h-5" style={{ color: '#16a34a' }} />
                        ) : (
                          <X className="w-5 h-5" style={{ color: '#dc2626' }} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold truncate" style={{ color: 'var(--color-text)' }}>
                          {getMode(match.game_mode)?.title || match.game_mode}
                        </div>
                        <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                          {isSolo ? 'Solo' : 'VS Match'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0 text-right">
                      <div>
                        <div className="font-bold text-sm" style={{ color: isWinner ? 'var(--color-win-text)' : 'var(--color-loss-text)' }}>
                          {isWinner ? 'Win' : 'Loss'}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {playerTime > 0 ? `${playerTime}s` : '-'}
                        </div>
                      </div>
                      <div className="text-xs text-right" style={{ color: 'var(--color-text-muted)' }}>
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

      <BottomNav />
    </div>
  );
}
