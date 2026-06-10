'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';
import {
  Trophy,
  Flame,
  Star,
  Zap,
  Swords,
  User,
  Medal,
  Crown,
  LogOut,
  Trash2,
  AlertTriangle,
  Shield,
  Skull,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from '@/hooks/use-toast';
import { handleSupabaseError } from '@/lib/supabase-error-handler';
import { ProBadge } from '@/components/ui/pro-badge';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';
import { SixIcon } from '@/components/ui/six-icon';
import { SevenIcon } from '@/components/ui/seven-icon';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { AvatarUpload } from '@/components/profile/avatar-upload';
import dynamic from 'next/dynamic';
const ProStats = dynamic(() => import('@/components/profile/pro-stats').then(m => m.ProStats), { ssr: false });
import { SocialLinksDisplay, type SocialLinks } from '@/components/profile/social-links';
import { ProfileEditModal, EditProfileButton } from '@/components/profile/profile-edit-modal';
import { fetchUserMedals, fetchTodayDailyCompletions, type Medal as MedalType, type DailyCompletion } from '@/lib/daily-service';
import { fetchActivityByDay, fetchGuessDistribution, fetchSolveTimeHistory, fetchDailyCalendar, fetchTopWordsAllTime } from '@/lib/stats-service';
import { GuessDistribution } from '@/components/profile/guess-distribution';
import { SolveTimeChart } from '@/components/profile/solve-time-chart';
import { DailyCalendar } from '@/components/profile/daily-calendar';
import { TopWordsCard } from '@/components/profile/top-words-card';
import { fetchUserAchievements, ACHIEVEMENTS } from '@/lib/achievement-service';
import { GlobalSummaryRow } from '@/components/profile/global-summary-row';
import { ModePicker, PROFILE_MODES } from '@/components/profile/mode-picker';
import { ModeDetailPanel } from '@/components/profile/mode-detail-panel';
import { CollapsibleSection } from '@/components/profile/collapsible-section';
import { NotificationToggle } from '@/components/profile/notification-toggle';
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
  DUEL_6: 'Six',
  DUEL_7: 'Seven',
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
  DUEL_6:        { icon: SixIcon, color: '#06b6d4' },
  DUEL_7:        { icon: SevenIcon, color: '#84cc16' },
};

const DAILY_MODES: Array<{ id: string; href: string }> = [
  { id: 'DUEL',          href: '/practice?daily=true' },
  { id: 'QUORDLE',       href: '/quordle?daily=true' },
  { id: 'OCTORDLE',      href: '/octordle?daily=true' },
  { id: 'SEQUENCE',      href: '/sequence?daily=true' },
  { id: 'RESCUE',        href: '/rescue?daily=true' },
  { id: 'DUEL_6',        href: '/six?daily=true' },
  { id: 'DUEL_7',        href: '/seven?daily=true' },
  { id: 'GAUNTLET',      href: '/gauntlet?daily=true' },
  { id: 'PROPERNOUNDLE', href: '/propernoundle?daily=true' },
];

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export default function ProfilePage() {
  const { profile, loading, refreshProfile, signOut, isProActive } = useAuth();
  const { data: profileData, isLoading: loadingStats } = useSWR(
    profile ? ['profile-data', profile.id] : null,
    async () => {
      const [statsRes, matchesRes, medalsRes, achievementsRes, dailiesRes, activityRes, guessDistRes, solveRes, calendarRes, topWordsRes] = await Promise.all([
        supabase.from('user_stats').select('*').eq('user_id', profile!.id).then(r => r.data || []),
        supabase.from('matches')
          .select('id, game_mode, player1_id, player2_id, winner_id, player1_score, player2_score, player1_time, player2_time, created_at')
          .or(`player1_id.eq.${profile!.id},player2_id.eq.${profile!.id}`)
          .order('created_at', { ascending: false })
          .limit(5)
          .then(r => r.data || []),
        fetchUserMedals(profile!.id, 10),
        fetchUserAchievements(profile!.id),
        fetchTodayDailyCompletions(profile!.id),
        fetchActivityByDay(profile!.id, 7),
        fetchGuessDistribution(profile!.id),
        fetchSolveTimeHistory(profile!.id, 30),
        fetchDailyCalendar(profile!.id, 90),
        fetchTopWordsAllTime(profile!.id, 5),
      ]);
      // Resolve opponent usernames for VS rows in Recent Matches.
      const matchRows = matchesRes as Match[];
      const oppIds = Array.from(new Set(
        matchRows
          .filter((m) => m.player2_id)
          .map((m) => (m.player1_id === profile!.id ? m.player2_id! : m.player1_id)),
      ));
      const opponentNames: Record<string, string> = {};
      if (oppIds.length > 0) {
        const { data: oppProfiles } = await (supabase as any)
          .from('profiles')
          .select('id, username')
          .in('id', oppIds);
        for (const p of (oppProfiles as Array<{ id: string; username: string }> | null) || []) {
          opponentNames[p.id] = p.username;
        }
      }
      return {
        stats: statsRes as UserStats[],
        matches: matchRows,
        opponentNames,
        medals: medalsRes,
        userAchievements: new Set(achievementsRes.map(a => a.key)),
        todayDailies: dailiesRes,
        activity: activityRes,
        guessDist: guessDistRes,
        solveHistory: solveRes,
        calendar: calendarRes,
        topWordsAllTime: topWordsRes,
      };
    },
    { revalidateOnFocus: true, onError: (err: any) => handleSupabaseError(err, 'profile-data') },
  );

  const stats = profileData?.stats ?? [];
  const matches = profileData?.matches ?? [];
  const opponentNames = profileData?.opponentNames ?? {};
  const medals = profileData?.medals ?? [];
  const userAchievements = profileData?.userAchievements ?? new Set<string>();
  const todayDailies = profileData?.todayDailies ?? new Map<string, DailyCompletion>();
  const activity = profileData?.activity ?? [];
  const guessDist = profileData?.guessDist ?? [];
  const solveHistory = profileData?.solveHistory ?? [];
  const calendar = profileData?.calendar ?? [];
  const topWordsAllTime = profileData?.topWordsAllTime ?? [];

  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  // Solo/VS toggle (mirrors the public profile) — filters user_stats by play_type.
  const [activeTab, setActiveTab] = useState<'solo' | 'vs'>('solo');
  const [editOpen, setEditOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      toast({ title: 'Failed to delete account', description: 'Please try again or contact support@wordocious.com.', variant: 'destructive' });
      setDeleting(false);
    }
  };

  // Stats filtered to the active Solo/VS tab.
  const filteredStats = stats.filter((s) => s.play_type === activeTab);

  // Games per mode for the mode picker badge (active tab only)
  const gamesPerMode: Record<string, number> = {};
  for (const s of filteredStats) {
    gamesPerMode[s.game_mode] = (gamesPerMode[s.game_mode] || 0) + (s.total_games || 0);
  }

  // Aggregate VS record across all modes for the VS RECORD summary card.
  const vsRecord = (() => {
    const vsStats = stats.filter((s) => s.play_type === 'vs');
    const wins = vsStats.reduce((sum, s) => sum + (s.wins || 0), 0);
    const losses = vsStats.reduce((sum, s) => sum + (s.losses || 0), 0);
    const total = wins + losses;
    return { wins, losses, total, winRate: total > 0 ? Math.round((wins / total) * 100) : 0 };
  })();

  // Get stats for selected mode (active tab only)
  const getStatsForMode = (dbKey: string) => {
    const modeStats = filteredStats.filter((s) => s.game_mode === dbKey);
    if (modeStats.length === 0) return null;
    return {
      wins: modeStats.reduce((s, r) => s + (r.wins || 0), 0),
      losses: modeStats.reduce((s, r) => s + (r.losses || 0), 0),
      total_games: modeStats.reduce((s, r) => s + (r.total_games || 0), 0),
      best_score: modeStats.reduce((min, r) => r.best_score > 0 && (min === 0 || r.best_score < min) ? r.best_score : min, 0),
      fastest_time: modeStats.reduce((min, r) => r.fastest_time > 0 && (min === 0 || r.fastest_time < min) ? r.fastest_time : min, 0),
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="text-lg font-black animate-pulse" style={{ color: 'var(--color-text)' }}>Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="text-center">
          <h1 className="text-2xl font-black mb-4" style={{ color: 'var(--color-text)' }}>Sign in to view your profile</h1>
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

  const levelTier = (() => {
    const lvl = profile.level ?? 1;
    if (lvl >= 100) return { label: 'Diamond', bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' };
    if (lvl >= 51) return { label: 'Platinum', bg: '#f5f3ff', border: '#c4b5fd', color: '#6d28d9' };
    if (lvl >= 26) return { label: 'Gold', bg: '#fef9ec', border: '#fde68a', color: '#92400e' };
    if (lvl >= 11) return { label: 'Silver', bg: '#f3f4f6', border: '#d1d5db', color: '#374151' };
    return { label: 'Bronze', bg: '#fef2e8', border: '#fed7aa', color: '#9a3412' };
  })();

  const memberSince = (profile as any).created_at
    ? new Date((profile as any).created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  // Insights for the "All" view
  const insights: string[] = (() => {
    const out: string[] = [];
    const qualifying = stats.filter((s) => (s.total_games || 0) >= 3);
    if (qualifying.length > 0) {
      const strongest = qualifying.reduce((best, s) => {
        const rate = s.wins / s.total_games;
        const bestRate = best ? best.wins / best.total_games : -1;
        return rate > bestRate ? s : best;
      }, qualifying[0]);
      const name = gameModeTitles[strongest.game_mode] || strongest.game_mode;
      const rate = Math.round((strongest.wins / strongest.total_games) * 100);
      out.push(`Your strongest mode is ${name} at ${rate}% win rate.`);
    }
    const weekTotal = activity.reduce((s, a) => s + a.count, 0);
    if (weekTotal >= 10) out.push(`You've played ${weekTotal} games this week — on a roll!`);
    else if (weekTotal >= 1 && weekTotal < 5) out.push(`Only ${weekTotal} game${weekTotal === 1 ? '' : 's'} this week — warm up with a daily.`);
    if (xpToNextLevel <= 300) out.push(`Just ${xpToNextLevel} XP away from Level ${profile.level + 1}.`);
    if (todayDailies.size === DAILY_MODES.length) {
      const allWon = Array.from(todayDailies.values()).every((r) => r.won);
      out.push(allWon ? `Flawless Victory — all ${DAILY_MODES.length} dailies won today.` : `All ${DAILY_MODES.length} dailies done today. Legendary.`);
    } else if (todayDailies.size >= 3) {
      out.push(`${todayDailies.size}/${DAILY_MODES.length} dailies complete today — keep going.`);
    }
    return out.slice(0, 2);
  })();

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--color-bg)' }}>
      <AppHeader />

      <div className="max-w-2xl mx-auto px-4 space-y-4">
        {/* ── A. Profile Header ── */}
        <div className="flex flex-col items-center gap-3">
          <AvatarUpload size={96} editable={false} />
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black" style={{ color: 'var(--color-text)' }}>{profile.username}</h1>
            {isProActive && <ProBadge size="md" />}
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold"
              style={{ background: levelTier.bg, border: `1.5px solid ${levelTier.border}`, color: levelTier.color }}
            >
              <Star className="w-3.5 h-3.5" fill="currentColor" />
              Level {profile.level}
              <span className="opacity-70">·</span>
              <span>{levelTier.label}</span>
            </div>
            <div className="w-40">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                <div className="h-full" style={{ width: `${levelProgress}%`, background: 'linear-gradient(90deg, #fbbf24, #f97316)' }} />
              </div>
              <p className="text-[10px] font-bold text-center mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{xpToNextLevel} XP to next</p>
            </div>
            {memberSince && (
              <p className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Member since {memberSince}</p>
            )}
          </div>
          <SocialLinksDisplay links={(profile as any).social_links as SocialLinks | null} />
          <EditProfileButton onClick={() => setEditOpen(true)} />
          <div className="flex items-center gap-2">
            {!isProActive && (
              <Link href="/pro">
                <button className="btn-3d px-4 py-1.5 rounded-lg text-white font-extrabold text-xs" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 2px 0 #92400e' }}>
                  Go Pro
                </button>
              </Link>
            )}
            {/* DEV-ONLY: gated on profiles.is_admin so it renders only for the
                developer's account — never for App Review or real users. */}
            {(profile as any).is_admin && (
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
            )}
          </div>
        </div>

        {/* ── B. Today's Dailies ── */}
        {(() => {
          const completed = todayDailies.size;
          const wins = Array.from(todayDailies.values()).filter((r) => r.won).length;
          const total = DAILY_MODES.length;
          const allDone = completed >= total;
          const flawless = allDone && wins === total;
          const cardStyle: React.CSSProperties = flawless
            ? { background: 'linear-gradient(135deg, #fef3c7, #fde68a)', border: '1.5px solid #f59e0b', borderRadius: '16px' }
            : allDone
              ? { background: 'linear-gradient(135deg, #f5f3ff, #fce7f3)', border: '1.5px solid #c4b5fd', borderRadius: '16px' }
              : { background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' };
          return (
            <>
              {!allDone && (
                <div className="section-header mb-2 flex items-center justify-between">
                  <span>TODAY'S DAILIES</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>{completed}/{total}</span>
                </div>
              )}
              <div className="p-3 mb-1" style={cardStyle}>
                {allDone && (
                  <div className="text-center mb-2">
                    <div className="flex items-center justify-center gap-2">
                      {flawless ? (
                        <>
                          <Trophy className="w-5 h-5" style={{ color: '#b45309' }} fill="currentColor" />
                          <span className="text-lg font-black text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #d97706, #b45309)' }}>Flawless Victory!</span>
                          <Trophy className="w-5 h-5" style={{ color: '#b45309' }} fill="currentColor" />
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" style={{ color: '#7c3aed' }} />
                          <span className="text-base font-black text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}>Daily Sweep!</span>
                          <Sparkles className="w-4 h-4" style={{ color: '#ec4899' }} />
                        </>
                      )}
                    </div>
                  </div>
                )}
                {/* 5-on-top, 4-on-bottom grid so badges are balanced */}
                <div className="flex flex-col items-center gap-2">
                  {[DAILY_MODES.slice(0, 5), DAILY_MODES.slice(5)].map((row, ri) => (
                    <div key={ri} className="flex justify-center gap-3">
                      {row.map((m) => {
                        const cfg = gameModeIcons[m.id];
                        const result = todayDailies.get(m.id);
                        const played = result !== undefined;
                        const won = result?.won === true;
                        const title = gameModeTitles[m.id] || m.id;
                        const tileBg = !played ? 'var(--color-bg)' : won ? '#16a34a' : '#dc2626';
                        const tileBorder = !played ? 'var(--color-border)' : won ? '#16a34a' : '#dc2626';
                        return (
                          <Link key={m.id} href={m.href} className="flex flex-col items-center gap-1" style={{ width: '42px' }}>
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: tileBg, border: `1.5px solid ${tileBorder}`, opacity: played ? 1 : 0.7 }}>
                              {played ? (
                                <span className="text-sm font-black" style={{ color: '#ffffff' }}>{won ? 'W' : 'L'}</span>
                              ) : cfg?.romanNumeral ? (
                                <span className="text-[11px] font-black" style={{ color: cfg.color }}>{cfg.romanNumeral}</span>
                              ) : cfg?.icon ? (
                                (() => { const I = cfg.icon; return <I className="w-3.5 h-3.5" style={{ color: cfg.color }} />; })()
                              ) : (
                                <Zap className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
                              )}
                            </div>
                            <span className="text-[8px] font-bold truncate w-full text-center" style={{ color: played ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {allDone && (
                  <div className="text-center mt-2">
                    <div className="text-[11px] font-extrabold" style={{ color: flawless ? '#b45309' : '#6d28d9' }}>
                      {flawless ? `All ${total} dailies won today · +600 XP earned` : `All ${total} dailies completed · +200 XP earned`}
                    </div>
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {/* ── C. Global Summary Row ── */}
        <GlobalSummaryRow
          totalWins={profile.total_wins}
          totalLosses={profile.total_losses}
          currentStreak={(profile as any).current_streak ?? 0}
          bestStreak={(profile as any).best_streak ?? 0}
          dailyStreak={profile.daily_login_streak}
          bestDailyStreak={(profile as any).best_daily_login_streak ?? 0}
        />

        {/* ── D. Solo/VS toggle + Mode Picker ── */}
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

        {/* VS RECORD summary card (VS tab only) */}
        {activeTab === 'vs' && (
          <div
            className="p-4 flex items-center gap-4"
            style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #fce7f3 100%)', border: '1.5px solid #c4b5fd', borderRadius: '16px' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#7c3aed15' }}>
              <Swords className="w-5 h-5" style={{ color: '#7c3aed' }} />
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: '#6d28d9' }}>VS Record</div>
              <div className="text-xl font-black" style={{ color: 'var(--color-text)' }}>
                {vsRecord.wins}–{vsRecord.losses}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-black" style={{ color: '#7c3aed' }}>{vsRecord.winRate}%</div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Win rate · {vsRecord.total} {vsRecord.total === 1 ? 'match' : 'matches'}
              </div>
            </div>
          </div>
        )}

        <ModePicker
          selectedMode={selectedMode}
          onSelectMode={setSelectedMode}
          gamesPerMode={gamesPerMode}
        />

        {/* ── E. Dashboard Content ── */}
        {selectedMode === null ? (
          /* ── "All" Global View ── */
          <div className="space-y-4">
            {/* Activity Calendar */}
            {calendar.some((d) => d.gamesPlayed > 0) && (
              <>
                <div className="section-header mb-2">ACTIVITY</div>
                <DailyCalendar data={calendar} />
              </>
            )}

            {/* 7-day activity */}
            {activity.length > 0 && (() => {
              const maxCount = Math.max(1, ...activity.map((a) => a.count));
              const totalWeek = activity.reduce((sum, a) => sum + a.count, 0);
              return (
                <>
                  <div className="section-header mb-2 flex items-center justify-between">
                    <span>LAST 7 DAYS</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>{totalWeek} {totalWeek === 1 ? 'game' : 'games'}</span>
                  </div>
                  <div className="p-4" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}>
                    <div className="flex items-end justify-between gap-1 h-16">
                      {activity.map((a) => {
                        const d = new Date(a.day + 'T00:00:00Z');
                        const dow = d.toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' });
                        const heightPct = a.count === 0 ? 6 : 12 + (a.count / maxCount) * 88;
                        return (
                          <div key={a.day} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full flex items-end justify-center" style={{ height: '48px' }}>
                              <div
                                className="w-full rounded-t"
                                style={{
                                  height: `${heightPct}%`,
                                  background: a.count === 0 ? 'var(--color-border)' : 'linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)',
                                  transition: 'height 300ms ease-out',
                                }}
                                title={`${a.count} ${a.count === 1 ? 'game' : 'games'} · ${a.day}`}
                              />
                            </div>
                            <span className="text-[9px] font-extrabold uppercase" style={{ color: 'var(--color-text-muted)' }}>{dow}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Guess Distribution */}
            {guessDist.some((d) => d.count > 0) && (
              <>
                <div className="section-header mb-2">GUESS DISTRIBUTION</div>
                <GuessDistribution data={guessDist} />
              </>
            )}

            {/* Solve Time Trend */}
            {solveHistory.length >= 2 && (
              <>
                <div className="section-header mb-2">SOLVE TIME TREND</div>
                <SolveTimeChart data={solveHistory} />
              </>
            )}

            {/* All-Time Top Words */}
            {topWordsAllTime.length > 0 && (
              <>
                <div className="section-header mb-2">TOP WORDS — ALL TIME</div>
                <TopWordsCard words={topWordsAllTime} accentColor="#7c3aed" />
              </>
            )}

            {/* Insights */}
            {insights.length > 0 && (
              <>
                <div className="section-header mb-2">INSIGHTS</div>
                <div className="p-4 space-y-2" style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #eef2ff 100%)', border: '1.5px solid #ddd6fe', borderRadius: '16px' }}>
                  {insights.map((text, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#7c3aed' }} />
                      <p className="text-xs font-bold leading-snug" style={{ color: 'var(--color-text)' }}>{text}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Medals */}
            <div className="section-header mb-2">DAILY MEDALS</div>
            <div className="p-4" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {[
                  { icon: Crown, count: (profile as any).gold_medals || 0, label: 'Gold', color: '#d97706' },
                  { icon: Medal, count: (profile as any).silver_medals || 0, label: 'Silver', color: 'var(--color-text-muted)' },
                  { icon: Medal, count: (profile as any).bronze_medals || 0, label: 'Bronze', color: '#b45309' },
                ].map((m, i) => {
                  const MIcon = m.icon;
                  return (
                    <div key={i} className="text-center p-3" style={{ background: 'var(--color-bg)', borderRadius: '12px' }}>
                      <MIcon className="w-6 h-6 mx-auto mb-1" style={{ color: m.color }} />
                      <div className="text-xl font-black" style={{ color: m.color }}>{m.count}</div>
                      <div className="text-[10px] font-extrabold" style={{ color: 'var(--color-text-muted)' }}>{m.label}</div>
                    </div>
                  );
                })}
              </div>
              {medals.length > 0 ? (
                <div className="space-y-1.5">
                  {medals.slice(0, 5).map((medal) => {
                    const medalConfig: Record<string, { icon: typeof Crown; color: string; label: string }> = {
                      gold: { icon: Crown, color: '#d97706', label: '1st' },
                      silver: { icon: Medal, color: 'var(--color-text-muted)', label: '2nd' },
                      bronze: { icon: Medal, color: '#b45309', label: '3rd' },
                      streak_7: { icon: Flame, color: '#ea580c', label: '7-Day Streak' },
                      streak_30: { icon: Flame, color: '#dc2626', label: '30-Day Streak' },
                      streak_100: { icon: Flame, color: '#7c3aed', label: '100-Day Streak' },
                      perfect: { icon: Star, color: '#16a34a', label: 'Perfect' },
                    };
                    const cfg = medalConfig[medal.medal_type] || { icon: Medal, color: 'var(--color-text-muted)', label: medal.medal_type };
                    const MedalIcon = cfg.icon;
                    return (
                      <div key={medal.id} className="flex items-center gap-2.5 p-2.5" style={{ background: 'var(--color-bg)', borderRadius: '10px' }}>
                        <MedalIcon className="w-4 h-4" style={{ color: cfg.color }} fill={cfg.icon === Flame || cfg.icon === Star ? 'currentColor' : 'none'} />
                        <span className="text-xs font-extrabold flex-1" style={{ color: 'var(--color-text)' }}>
                          {medal.medal_type.startsWith('streak') ? cfg.label : (gameModeTitles[medal.game_mode] || medal.game_mode)}
                          {medal.medal_type === 'perfect' && <span className="text-[10px] font-bold ml-1" style={{ color: '#16a34a' }}>Perfect!</span>}
                        </span>
                        <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                          {new Date(medal.day + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-xs font-bold py-3" style={{ color: 'var(--color-text-muted)' }}>Play daily challenges to earn medals!</p>
              )}
            </div>

            {/* Pro Stats (global view) */}
            <ProStats userId={profile.id} isPro={isProActive} />
          </div>
        ) : (
          /* ── Mode Detail View ── */
          <div
            className="transition-all duration-200"
            style={{ animation: 'fadeSlideIn 250ms ease-out' }}
          >
            <ModeDetailPanel
              userId={profile.id}
              gameMode={selectedMode}
              isPro={isProActive}
              stats={getStatsForMode(selectedMode)}
            />
          </div>
        )}

        {/* ── F. Recent Matches ── */}
        <div className="section-header mb-2">RECENT MATCHES</div>
        {loadingStats ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 animate-pulse" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '12px' }}>
                <div className="w-9 h-9 rounded-lg flex-shrink-0" style={{ background: 'var(--color-border)' }} />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="h-3 w-20 rounded" style={{ background: 'var(--color-border)' }} />
                  <div className="h-2.5 w-28 rounded" style={{ background: 'var(--color-surface-hover)' }} />
                </div>
                <div className="flex-shrink-0 space-y-1.5 text-right">
                  <div className="h-3 w-10 rounded ml-auto" style={{ background: 'var(--color-border)' }} />
                  <div className="h-2.5 w-16 rounded ml-auto" style={{ background: 'var(--color-surface-hover)' }} />
                </div>
              </div>
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-8 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>No matches played yet.</div>
        ) : (
          <div className="space-y-2">
            {matches.map((match) => {
              const isWinner = match.winner_id === profile.id;
              const isPlayer1 = match.player1_id === profile.id;
              const score = isPlayer1 ? match.player1_score : (match.player2_score ?? 0);
              const playerTime = isPlayer1 ? match.player1_time : (match.player2_time ?? 0);
              const matchDate = new Date(match.created_at);
              const cfg = gameModeIcons[match.game_mode];
              const opponentId = match.player2_id ? (isPlayer1 ? match.player2_id : match.player1_id) : null;
              const opponentName = opponentId ? (opponentNames[opponentId] ?? 'Unknown') : null;
              return (
                <div key={match.id} className="flex items-center gap-3 p-3" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '12px' }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: cfg ? `${cfg.color}15` : 'var(--color-bg)' }}>
                    {(() => {
                      if (!cfg) return <Zap className="w-4 h-4" style={{ color: '#d97706' }} />;
                      if (cfg.romanNumeral) return <span className="text-[11px] font-black" style={{ color: cfg.color }}>{cfg.romanNumeral}</span>;
                      if (cfg.icon) { const Icon = cfg.icon; return <Icon className="w-4 h-4" style={{ color: cfg.color }} />; }
                      return <Zap className="w-4 h-4" style={{ color: cfg.color }} />;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold truncate" style={{ color: 'var(--color-text)' }}>{gameModeTitles[match.game_mode] || match.game_mode}</span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded" style={{ background: match.player2_id ? '#ede9f6' : '#f0fdf4', color: match.player2_id ? '#7c3aed' : '#16a34a' }}>
                        {match.player2_id ? 'VS' : 'Solo'}
                      </span>
                    </div>
                    <div className="text-[10px] font-bold truncate" style={{ color: 'var(--color-text-muted)' }}>
                      {score} {score === 1 ? 'guess' : 'guesses'} · {playerTime > 0 ? formatDuration(playerTime) : '—'}
                      {opponentName ? ` · vs ${opponentName}` : ''}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-extrabold" style={{ color: isWinner ? '#16a34a' : '#dc2626' }}>{isWinner ? 'Win' : 'Loss'}</div>
                    <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                      {matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {matchDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── G. Achievements (collapsible, below recent games) ── */}
        <CollapsibleSection title="ACHIEVEMENTS" badge={`${userAchievements.size}/${ACHIEVEMENTS.length}`}>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2">
            {ACHIEVEMENTS.map((achievement) => {
              const isUnlocked = userAchievements.has(achievement.key);
              return (
                <div
                  key={achievement.key}
                  className="text-center p-2.5 transition-all"
                  style={{
                    background: isUnlocked ? '#f3f0ff' : '#fafafa',
                    border: isUnlocked ? '1.5px solid #c4b5fd' : '1.5px solid var(--color-border)',
                    borderRadius: '12px',
                    opacity: isUnlocked ? 1 : 0.4,
                  }}
                >
                  <div className="text-lg mb-0.5">{isUnlocked ? '✓' : '?'}</div>
                  <div className="text-[10px] font-extrabold truncate" style={{ color: 'var(--color-text)' }}>{achievement.name}</div>
                  <div className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{achievement.description}</div>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>

        {/* ── H. Account Actions ── */}
        <div className="section-header mb-2 mt-4">ACCOUNT</div>
        <div className="space-y-2">
          <NotificationToggle />
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 p-4 transition-colors active:scale-[0.98]"
            style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
          >
            <LogOut className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
            <span className="text-sm font-extrabold" style={{ color: 'var(--color-text)' }}>Sign Out</span>
          </button>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center gap-3 p-4 transition-colors active:scale-[0.98]"
              style={{ background: 'var(--color-surface)', border: '1.5px solid #fecaca', borderRadius: '16px' }}
            >
              <Trash2 className="w-5 h-5" style={{ color: '#dc2626' }} />
              <span className="text-sm font-extrabold" style={{ color: '#dc2626' }}>Delete Account</span>
            </button>
          ) : (
            <div className="p-5" style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '16px' }}>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5" style={{ color: '#dc2626' }} />
                <span className="text-sm font-black" style={{ color: '#dc2626' }}>Delete your account?</span>
              </div>
              <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                This will permanently delete your profile, stats, streak, medals, achievements, and all game data. This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="flex-1 py-2.5 rounded-xl text-sm font-black" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)' }}>
                  Cancel
                </button>
                <button onClick={handleDeleteAccount} disabled={deleting} className="flex-1 py-2.5 rounded-xl text-white text-sm font-black disabled:opacity-50" style={{ background: '#dc2626' }}>
                  {deleting ? 'Deleting...' : 'Delete Forever'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
      <ProfileEditModal open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}
