'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';
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
  Pencil,
  Medal,
  Crown,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ProBadge } from '@/components/ui/pro-badge';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { AvatarUpload } from '@/components/profile/avatar-upload';
import { ProStats } from '@/components/profile/pro-stats';
import { fetchUserMedals, type Medal as MedalType } from '@/lib/daily-service';
import { fetchUserAchievements, ACHIEVEMENTS, type AchievementDef } from '@/lib/achievement-service';
import type { Database } from '@/lib/database.types';

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

export default function ProfilePage() {
  const { profile, loading, refreshProfile } = useAuth();
  const [stats, setStats] = useState<UserStats[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [medals, setMedals] = useState<MedalType[]>([]);
  const [userAchievements, setUserAchievements] = useState<Set<string>>(new Set());
  const [loadingStats, setLoadingStats] = useState(true);
  const [activeTab, setActiveTab] = useState<'solo' | 'vs'>('solo');
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameValue, setUsernameValue] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const usernameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      fetchStats();
      fetchMatches();
      fetchMedals();
      loadAchievements();
      setUsernameValue(profile.username);
    }
  }, [profile]);

  useEffect(() => {
    if (editingUsername && usernameInputRef.current) {
      usernameInputRef.current.focus();
      usernameInputRef.current.select();
    }
  }, [editingUsername]);

  const fetchStats = async () => {
    if (!profile) return;
    const { data } = await supabase.from('user_stats').select('*').eq('user_id', profile.id);
    if (data) setStats(data);
    setLoadingStats(false);
  };

  const fetchMedals = async () => {
    if (!profile) return;
    const data = await fetchUserMedals(profile.id, 10);
    setMedals(data);
  };

  const loadAchievements = async () => {
    if (!profile) return;
    const data = await fetchUserAchievements(profile.id);
    setUserAchievements(new Set(data.map(a => a.key)));
  };

  const fetchMatches = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('matches')
      .select('*')
      .or(`player1_id.eq.${profile.id},player2_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setMatches(data);
  };

  const saveUsername = async () => {
    if (!profile) return;
    const trimmed = usernameValue.trim();
    if (trimmed.length < 3 || trimmed.length > 20) {
      setUsernameError('Username must be 3-20 characters');
      return;
    }
    if (trimmed === profile.username) {
      setEditingUsername(false);
      setUsernameError('');
      return;
    }
    setSavingUsername(true);
    setUsernameError('');
    const { error } = await (supabase as any).from('profiles').update({ username: trimmed }).eq('id', profile.id);
    if (error) {
      if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('duplicate')) {
        setUsernameError('Username already taken');
      } else {
        setUsernameError('Failed to update username');
      }
      setSavingUsername(false);
      return;
    }
    await refreshProfile();
    setEditingUsername(false);
    setSavingUsername(false);
  };

  const handleUsernameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveUsername();
    else if (e.key === 'Escape') {
      setEditingUsername(false);
      setUsernameValue(profile?.username ?? '');
      setUsernameError('');
    }
  };

  const filteredStats = stats.filter((s) => s.play_type === activeTab);

  if (loading || loadingStats) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0d0a1a' }}>
        <div className="text-white text-lg font-black">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0d0a1a' }}>
        <div className="text-center">
          <h1 className="text-2xl font-black text-white mb-4">Sign in to view your profile</h1>
          <Link href="/">
            <button
              className="btn-3d px-6 py-2.5 rounded-xl text-white font-black text-sm"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 4px 0 #4c1d95' }}
            >
              Go Home
            </button>
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

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#0d0a1a' }}>
      <AppHeader />

      <div className="max-w-2xl mx-auto px-4 space-y-4">
        {/* Profile Header */}
        <div className="flex flex-col items-center gap-3">
          <AvatarUpload size={96} />

          {editingUsername ? (
            <div className="flex flex-col items-center gap-2">
              <input
                ref={usernameInputRef}
                type="text"
                value={usernameValue}
                onChange={(e) => setUsernameValue(e.target.value)}
                onBlur={saveUsername}
                onKeyDown={handleUsernameKeyDown}
                maxLength={20}
                disabled={savingUsername}
                className="text-2xl font-black text-center px-4 py-2 text-white outline-none w-56"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '12px',
                }}
              />
              {usernameError && <p className="text-red-400 text-xs font-bold">{usernameError}</p>}
            </div>
          ) : (
            <button onClick={() => setEditingUsername(true)} className="group flex items-center gap-2">
              <h1 className="text-3xl font-black text-white">{profile.username}</h1>
              {(profile as any).is_pro && <ProBadge size="md" />}
              <Pencil className="w-4 h-4 opacity-30 group-hover:opacity-60 transition-opacity" style={{ color: '#fff' }} />
            </button>
          )}

          {/* Level */}
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold"
              style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.25)', color: '#fde68a' }}
            >
              <Star className="w-3.5 h-3.5" fill="currentColor" />
              Level {profile.level}
            </div>
            <div className="w-40">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full" style={{ width: `${levelProgress}%`, background: 'linear-gradient(90deg, #fbbf24, #f97316)' }} />
              </div>
              <p className="text-[10px] font-bold text-center mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {xpToNextLevel} XP to next
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/shop">
              <button
                className="btn-3d px-4 py-1.5 rounded-lg text-white font-extrabold text-xs"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                Shop
              </button>
            </Link>
            {!(profile as any).is_pro && (
              <Link href="/pro">
                <button
                  className="btn-3d px-4 py-1.5 rounded-lg text-white font-extrabold text-xs"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 2px 0 #92400e' }}
                >
                  Go Pro
                </button>
              </Link>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="section-header mb-2">OVERVIEW</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Star, label: 'Level', value: profile.level, color: '#fbbf24', fill: true },
            { icon: Trophy, label: 'Wins', value: profile.total_wins, color: '#4ade80', sub: `${winRate}% rate` },
            { icon: Flame, label: 'Streak', value: profile.current_streak, color: '#f97316', fill: true, sub: `Best: ${profile.best_streak}` },
            { icon: Target, label: 'Games', value: profile.total_wins + profile.total_losses, color: '#60a5fa' },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={i}
                className="p-4"
                style={{ background: '#13102a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-5 h-5" style={{ color: s.color }} fill={s.fill ? 'currentColor' : 'none'} />
                  <span className="text-[10px] font-extrabold uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</span>
                </div>
                <div className="text-2xl font-black text-white">{s.value}</div>
                {s.sub && <div className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.sub}</div>}
              </div>
            );
          })}
        </div>

        {/* Medals */}
        <div className="section-header mb-2">DAILY MEDALS</div>
        <div
          className="p-4"
          style={{ background: '#13102a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}
        >
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              { icon: Crown, count: (profile as any).gold_medals || 0, label: 'Gold', color: '#fbbf24' },
              { icon: Medal, count: (profile as any).silver_medals || 0, label: 'Silver', color: '#cbd5e1' },
              { icon: Medal, count: (profile as any).bronze_medals || 0, label: 'Bronze', color: '#d97706' },
            ].map((m, i) => {
              const Icon = m.icon;
              return (
                <div key={i} className="text-center p-3" style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px' }}>
                  <Icon className="w-6 h-6 mx-auto mb-1" style={{ color: m.color }} />
                  <div className="text-xl font-black" style={{ color: m.color }}>{m.count}</div>
                  <div className="text-[10px] font-extrabold" style={{ color: 'rgba(255,255,255,0.4)' }}>{m.label}</div>
                </div>
              );
            })}
          </div>

          {medals.length > 0 ? (
            <div className="space-y-1.5">
              {medals.slice(0, 5).map((medal) => (
                <div
                  key={medal.id}
                  className="flex items-center gap-2.5 p-2.5"
                  style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}
                >
                  {medal.medal_type === 'gold' && <Crown className="w-4 h-4" style={{ color: '#fbbf24' }} />}
                  {medal.medal_type === 'silver' && <Medal className="w-4 h-4" style={{ color: '#cbd5e1' }} />}
                  {medal.medal_type === 'bronze' && <Medal className="w-4 h-4" style={{ color: '#d97706' }} />}
                  <span className="text-white text-xs font-extrabold flex-1">
                    {gameModeTitles[medal.game_mode] || medal.game_mode}
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {new Date(medal.day + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-xs font-bold py-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Play daily challenges to earn medals!
            </p>
          )}
        </div>

        {/* Achievements */}
        <div className="section-header mb-2 flex items-center justify-between">
          <span>ACHIEVEMENTS</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>{userAchievements.size}/{ACHIEVEMENTS.length}</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {ACHIEVEMENTS.map((achievement) => {
            const isUnlocked = userAchievements.has(achievement.key);
            return (
              <div
                key={achievement.key}
                className="text-center p-2.5 transition-all"
                style={{
                  background: isUnlocked ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.02)',
                  border: isUnlocked ? '1px solid rgba(167,139,250,0.25)' : '1px solid rgba(255,255,255,0.04)',
                  borderRadius: '12px',
                  opacity: isUnlocked ? 1 : 0.4,
                }}
              >
                <div className="text-lg mb-0.5">{isUnlocked ? '✓' : '?'}</div>
                <div className="text-[10px] font-extrabold text-white truncate">{achievement.name}</div>
                <div className="text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>{achievement.description}</div>
              </div>
            );
          })}
        </div>

        {/* Pro Stats */}
        <ProStats userId={profile.id} isPro={(profile as any).is_pro ?? false} />

        {/* Game Mode Stats */}
        <div className="section-header mb-2">GAME MODE STATS</div>
        <div className="flex gap-2 mb-3">
          {(['solo', 'vs'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setActiveTab(type)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all"
              style={{
                background: activeTab === type ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                border: activeTab === type ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.08)',
                color: activeTab === type ? '#fff' : 'rgba(255,255,255,0.3)',
              }}
            >
              {type === 'solo' ? <User className="w-3.5 h-3.5" /> : <Swords className="w-3.5 h-3.5" />}
              {type === 'solo' ? 'Solo' : 'VS'}
            </button>
          ))}
        </div>

        {filteredStats.length === 0 ? (
          <div className="text-center py-8 text-xs font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {activeTab === 'solo' ? 'Play some solo games to see stats!' : 'Play VS matches to see stats!'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredStats.map((stat) => (
              <div
                key={stat.id}
                className="p-4"
                style={{ background: '#13102a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}
              >
                <h3 className="text-sm font-extrabold text-white mb-2 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" style={{ color: '#fbbf24' }} />
                  {gameModeTitles[stat.game_mode] || stat.game_mode}
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.4)' }} className="font-bold">Wins</div>
                    <div className="font-black text-base" style={{ color: '#4ade80' }}>{stat.wins}</div>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.4)' }} className="font-bold">Losses</div>
                    <div className="font-black text-base" style={{ color: '#f87171' }}>{stat.losses}</div>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.4)' }} className="font-bold">Best</div>
                    <div className="font-black text-base" style={{ color: '#fbbf24' }}>{stat.best_score}</div>
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.4)' }} className="font-bold">Fastest</div>
                    <div className="font-black text-base" style={{ color: '#60a5fa' }}>
                      {stat.fastest_time > 0 ? `${stat.fastest_time}s` : '-'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recent Matches */}
        <div className="section-header mb-2">RECENT MATCHES</div>
        {matches.length === 0 ? (
          <div className="text-center py-8 text-xs font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>
            No matches played yet.
          </div>
        ) : (
          <div className="space-y-2">
            {matches.map((match) => {
              const isWinner = match.winner_id === profile.id;
              const isPlayer1 = match.player1_id === profile.id;
              const playerTime = isPlayer1 ? match.player1_time : (match.player2_time ?? 0);
              const matchDate = new Date(match.created_at);

              return (
                <div
                  key={match.id}
                  className="flex items-center gap-3 p-3"
                  style={{ background: '#13102a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: isWinner ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)' }}
                  >
                    {isWinner ? (
                      <Check className="w-4 h-4" style={{ color: '#4ade80' }} />
                    ) : (
                      <X className="w-4 h-4" style={{ color: '#f87171' }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-xs font-extrabold truncate">
                      {gameModeTitles[match.game_mode] || match.game_mode}
                    </div>
                    <div className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {!match.player2_id ? 'Solo' : 'VS'}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-extrabold" style={{ color: isWinner ? '#4ade80' : '#f87171' }}>
                      {isWinner ? 'Win' : 'Loss'}
                    </div>
                    <div className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
