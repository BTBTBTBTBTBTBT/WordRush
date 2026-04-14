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
  LogOut,
  Trash2,
  AlertTriangle,
  Shield,
  Skull,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ProBadge } from '@/components/ui/pro-badge';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';
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
  PROPERNOUNDLE: 'ProperNoundle',
  TOURNAMENT: 'Tournament',
};

const gameModeIcons: Record<string, { icon: React.ComponentType<any> | null; romanNumeral?: string; color: string }> = {
  DUEL:          { icon: WordleGridIcon, color: '#7c3aed' },
  QUORDLE:       { icon: null, romanNumeral: 'IV', color: '#ec4899' },
  OCTORDLE:      { icon: null, romanNumeral: 'VIII', color: '#7e22ce' },
  SEQUENCE:      { icon: TrendingUp, color: '#2563eb' },
  RESCUE:        { icon: Shield, color: '#059669' },
  GAUNTLET:      { icon: Skull, color: '#d97706' },
  PROPERNOUNDLE: { icon: Crown, color: '#dc2626' },
};

// Display order matching the home page
const gameModeOrder: string[] = [
  'DUEL',
  'MULTI_DUEL',
  'QUORDLE',
  'OCTORDLE',
  'SEQUENCE',
  'RESCUE',
  'GAUNTLET',
  'PROPERNOUNDLE',
];

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export default function ProfilePage() {
  const { profile, loading, refreshProfile, signOut } = useAuth();
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const usernameInputRef = useRef<HTMLInputElement>(null);

  const handleDeleteAccount = async () => {
    if (!profile) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No session');

      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error('Delete failed');

      await signOut();
      window.location.href = '/';
    } catch (err) {
      console.error('Delete account error:', err);
      alert('Failed to delete account. Please try again or contact support@spellstrike.com.');
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchStats();
      fetchMatches();
      fetchMedals();
      loadAchievements();
      setUsernameValue(profile.username);
    } else if (!loading) {
      setLoadingStats(false);
    }
  }, [profile, loading]);

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

  const filteredStats = stats
    .filter((s) => s.play_type === activeTab)
    .sort((a, b) => {
      const ai = gameModeOrder.indexOf(a.game_mode);
      const bi = gameModeOrder.indexOf(b.game_mode);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

  if (loading || loadingStats) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8f7ff' }}>
        <div className="text-lg font-black" style={{ color: '#1a1a2e' }}>Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#f8f7ff' }}>
        <div className="text-center">
          <h1 className="text-2xl font-black mb-4" style={{ color: '#1a1a2e' }}>Sign in to view your profile</h1>
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
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#f8f7ff' }}>
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
                className="text-2xl font-black text-center px-4 py-2 outline-none w-56"
                style={{
                  color: '#1a1a2e',
                  background: '#f3f0ff',
                  border: '1.5px solid #c4b5fd',
                  borderRadius: '12px',
                }}
              />
              {usernameError && <p className="text-red-500 text-xs font-bold">{usernameError}</p>}
            </div>
          ) : (
            <button onClick={() => setEditingUsername(true)} className="group flex items-center gap-2">
              <h1 className="text-3xl font-black" style={{ color: '#1a1a2e' }}>{profile.username}</h1>
              {(profile as any).is_pro && <ProBadge size="md" />}
              <Pencil className="w-4 h-4 opacity-30 group-hover:opacity-60 transition-opacity" style={{ color: '#9ca3af' }} />
            </button>
          )}

          {/* Level */}
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold"
              style={{ background: '#fef9ec', border: '1.5px solid #fde68a', color: '#92400e' }}
            >
              <Star className="w-3.5 h-3.5" fill="currentColor" />
              Level {profile.level}
            </div>
            <div className="w-40">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#ede9f6' }}>
                <div className="h-full" style={{ width: `${levelProgress}%`, background: 'linear-gradient(90deg, #fbbf24, #f97316)' }} />
              </div>
              <p className="text-[10px] font-bold text-center mt-0.5" style={{ color: '#9ca3af' }}>
                {xpToNextLevel} XP to next
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
            {/* Dev: Simulate Pro toggle */}
            <button
              onClick={async () => {
                const newValue = !(profile as any).is_pro;
                await (supabase as any).from('profiles').update({ is_pro: newValue }).eq('id', profile.id);
                await refreshProfile();
              }}
              className="px-3 py-1.5 rounded-lg font-extrabold text-xs border"
              style={{
                background: (profile as any).is_pro ? '#fef2f2' : '#f0fdf4',
                border: (profile as any).is_pro ? '1.5px solid #fca5a5' : '1.5px solid #86efac',
                color: (profile as any).is_pro ? '#dc2626' : '#16a34a',
              }}
            >
              {(profile as any).is_pro ? 'Disable Pro' : 'Simulate Pro'}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="section-header mb-2">OVERVIEW</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Star, label: 'Level', value: profile.level, color: '#d97706', fill: true },
            { icon: Trophy, label: 'Wins', value: profile.total_wins, color: '#16a34a', sub: `${winRate}% rate` },
            { icon: Flame, label: 'Daily Streak', value: profile.daily_login_streak, color: '#ea580c', fill: true, sub: `Best: ${(profile as any).best_daily_login_streak ?? 0}` },
            { icon: Zap, label: 'Win Streak', value: (profile as any).current_streak ?? 0, color: '#7c3aed', sub: `Best: ${(profile as any).best_streak ?? 0}` },
            { icon: Target, label: 'Games', value: profile.total_wins + profile.total_losses, color: '#2563eb' },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={i}
                className="p-4"
                style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-5 h-5" style={{ color: s.color }} fill={s.fill ? 'currentColor' : 'none'} />
                  <span className="text-[10px] font-extrabold uppercase" style={{ color: '#9ca3af' }}>{s.label}</span>
                </div>
                <div className="text-2xl font-black" style={{ color: '#1a1a2e' }}>{s.value}</div>
                {s.sub && <div className="text-[10px] font-bold" style={{ color: '#9ca3af' }}>{s.sub}</div>}
              </div>
            );
          })}
        </div>

        {/* Medals */}
        <div className="section-header mb-2">DAILY MEDALS</div>
        <div
          className="p-4"
          style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }}
        >
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              { icon: Crown, count: (profile as any).gold_medals || 0, label: 'Gold', color: '#d97706' },
              { icon: Medal, count: (profile as any).silver_medals || 0, label: 'Silver', color: '#9ca3af' },
              { icon: Medal, count: (profile as any).bronze_medals || 0, label: 'Bronze', color: '#b45309' },
            ].map((m, i) => {
              const Icon = m.icon;
              return (
                <div key={i} className="text-center p-3" style={{ background: '#f8f7ff', borderRadius: '12px' }}>
                  <Icon className="w-6 h-6 mx-auto mb-1" style={{ color: m.color }} />
                  <div className="text-xl font-black" style={{ color: m.color }}>{m.count}</div>
                  <div className="text-[10px] font-extrabold" style={{ color: '#9ca3af' }}>{m.label}</div>
                </div>
              );
            })}
          </div>

          {medals.length > 0 ? (
            <div className="space-y-1.5">
              {medals.slice(0, 5).map((medal) => {
                const medalConfig: Record<string, { icon: typeof Crown; color: string; label: string }> = {
                  gold: { icon: Crown, color: '#d97706', label: '1st' },
                  silver: { icon: Medal, color: '#9ca3af', label: '2nd' },
                  bronze: { icon: Medal, color: '#b45309', label: '3rd' },
                  streak_7: { icon: Flame, color: '#ea580c', label: '7-Day Streak' },
                  streak_30: { icon: Flame, color: '#dc2626', label: '30-Day Streak' },
                  streak_100: { icon: Flame, color: '#7c3aed', label: '100-Day Streak' },
                  perfect: { icon: Star, color: '#16a34a', label: 'Perfect' },
                };
                const cfg = medalConfig[medal.medal_type] || { icon: Medal, color: '#9ca3af', label: medal.medal_type };
                const MedalIcon = cfg.icon;
                return (
                  <div
                    key={medal.id}
                    className="flex items-center gap-2.5 p-2.5"
                    style={{ background: '#f8f7ff', borderRadius: '10px' }}
                  >
                    <MedalIcon className="w-4 h-4" style={{ color: cfg.color }} fill={cfg.icon === Flame || cfg.icon === Star ? 'currentColor' : 'none'} />
                    <span className="text-xs font-extrabold flex-1" style={{ color: '#1a1a2e' }}>
                      {medal.medal_type.startsWith('streak') ? cfg.label : (gameModeTitles[medal.game_mode] || medal.game_mode)}
                      {medal.medal_type === 'perfect' && <span className="text-[10px] font-bold ml-1" style={{ color: '#16a34a' }}>Perfect!</span>}
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: '#9ca3af' }}>
                      {new Date(medal.day + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-xs font-bold py-3" style={{ color: '#9ca3af' }}>
              Play daily challenges to earn medals!
            </p>
          )}
        </div>

        {/* Achievements */}
        <div className="section-header mb-2 flex items-center justify-between">
          <span>ACHIEVEMENTS</span>
          <span style={{ color: '#9ca3af' }}>{userAchievements.size}/{ACHIEVEMENTS.length}</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {ACHIEVEMENTS.map((achievement) => {
            const isUnlocked = userAchievements.has(achievement.key);
            return (
              <div
                key={achievement.key}
                className="text-center p-2.5 transition-all"
                style={{
                  background: isUnlocked ? '#f3f0ff' : '#fafafa',
                  border: isUnlocked ? '1.5px solid #c4b5fd' : '1.5px solid #ede9f6',
                  borderRadius: '12px',
                  opacity: isUnlocked ? 1 : 0.4,
                }}
              >
                <div className="text-lg mb-0.5">{isUnlocked ? '✓' : '?'}</div>
                <div className="text-[10px] font-extrabold truncate" style={{ color: '#1a1a2e' }}>{achievement.name}</div>
                <div className="text-[9px] font-bold" style={{ color: '#9ca3af' }}>{achievement.description}</div>
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
                background: activeTab === type ? '#ffffff' : '#f3f0ff',
                border: activeTab === type ? '1.5px solid #7c3aed' : '1.5px solid #ede9f6',
                color: activeTab === type ? '#7c3aed' : '#9ca3af',
              }}
            >
              {type === 'solo' ? <User className="w-3.5 h-3.5" /> : <Swords className="w-3.5 h-3.5" />}
              {type === 'solo' ? 'Solo' : 'VS'}
            </button>
          ))}
        </div>

        {filteredStats.length === 0 ? (
          <div className="text-center py-8 text-xs font-bold" style={{ color: '#9ca3af' }}>
            {activeTab === 'solo' ? 'Play some solo games to see stats!' : 'Play VS matches to see stats!'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredStats.map((stat) => (
              <div
                key={stat.id}
                className="p-4"
                style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }}
              >
                <h3 className="text-sm font-extrabold mb-2 flex items-center gap-1.5" style={{ color: '#1a1a2e' }}>
                  {(() => {
                    const cfg = gameModeIcons[stat.game_mode];
                    if (!cfg) return <Zap className="w-4 h-4" style={{ color: '#d97706' }} />;
                    if (cfg.romanNumeral) {
                      return <span className="text-xs font-black" style={{ color: cfg.color }}>{cfg.romanNumeral}</span>;
                    }
                    if (cfg.icon) {
                      const Icon = cfg.icon;
                      return <Icon className="w-4 h-4" style={{ color: cfg.color }} />;
                    }
                    return <Zap className="w-4 h-4" style={{ color: cfg.color }} />;
                  })()}
                  {gameModeTitles[stat.game_mode] || stat.game_mode}
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div style={{ color: '#9ca3af' }} className="font-bold">Wins</div>
                    <div className="font-black text-base" style={{ color: '#16a34a' }}>{stat.wins}</div>
                  </div>
                  <div>
                    <div style={{ color: '#9ca3af' }} className="font-bold">Losses</div>
                    <div className="font-black text-base" style={{ color: '#dc2626' }}>{stat.losses}</div>
                  </div>
                  <div>
                    <div style={{ color: '#9ca3af' }} className="font-bold">Best</div>
                    <div className="font-black text-base" style={{ color: '#d97706' }}>{stat.best_score}</div>
                  </div>
                  <div>
                    <div style={{ color: '#9ca3af' }} className="font-bold">Fastest</div>
                    <div className="font-black text-base" style={{ color: '#2563eb' }}>
                      {stat.fastest_time > 0 ? formatDuration(stat.fastest_time) : '-'}
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
          <div className="text-center py-8 text-xs font-bold" style={{ color: '#9ca3af' }}>
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
                  style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '12px' }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: isWinner ? '#f0fdf4' : '#fef2f2' }}
                  >
                    {isWinner ? (
                      <Check className="w-4 h-4" style={{ color: '#16a34a' }} />
                    ) : (
                      <X className="w-4 h-4" style={{ color: '#dc2626' }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-extrabold truncate" style={{ color: '#1a1a2e' }}>
                      {gameModeTitles[match.game_mode] || match.game_mode}
                    </div>
                    <div className="text-[10px] font-bold" style={{ color: '#9ca3af' }}>
                      {!match.player2_id ? 'Solo' : 'VS'}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-extrabold" style={{ color: isWinner ? '#16a34a' : '#dc2626' }}>
                      {isWinner ? 'Win' : 'Loss'}
                    </div>
                    <div className="text-[10px] font-bold" style={{ color: '#9ca3af' }}>
                      {matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* Account Actions */}
        <div className="section-header mb-2 mt-4">ACCOUNT</div>
        <div className="space-y-2">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 p-4 transition-colors active:scale-[0.98]"
            style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }}
          >
            <LogOut className="w-5 h-5" style={{ color: '#9ca3af' }} />
            <span className="text-sm font-extrabold" style={{ color: '#1a1a2e' }}>Sign Out</span>
          </button>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center gap-3 p-4 transition-colors active:scale-[0.98]"
              style={{ background: '#ffffff', border: '1.5px solid #fecaca', borderRadius: '16px' }}
            >
              <Trash2 className="w-5 h-5" style={{ color: '#dc2626' }} />
              <span className="text-sm font-extrabold" style={{ color: '#dc2626' }}>Delete Account</span>
            </button>
          ) : (
            <div
              className="p-5"
              style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '16px' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5" style={{ color: '#dc2626' }} />
                <span className="text-sm font-black" style={{ color: '#dc2626' }}>Delete your account?</span>
              </div>
              <p className="text-xs leading-relaxed mb-4" style={{ color: '#6b7280' }}>
                This will permanently delete your profile, stats, streak, medals, achievements, and all game data. This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-black"
                  style={{ background: '#ffffff', border: '1.5px solid #ede9f6', color: '#1a1a2e' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-black disabled:opacity-50"
                  style={{ background: '#dc2626' }}
                >
                  {deleting ? 'Deleting...' : 'Delete Forever'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
