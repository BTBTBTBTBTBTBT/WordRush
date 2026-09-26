'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth-context';
import { loadCpuProgression } from '@/lib/bot/cpu-progression';
import { supabase } from '@/lib/supabase-client';
import {
  Trophy,
  Flame,
  Star,
  Zap,
  Swords,
  User,
  Medal,
  Sparkles,
  Crown,
  Bot,
  Lock,
  Share,
} from 'lucide-react';
import Link from 'next/link';
import { handleSupabaseError } from '@/lib/supabase-error-handler';
import { fetchDailySweepStats, type DailySweepStats } from '@/lib/stats-service';
import { getTodayLocal, fetchDailyVsResult } from '@/lib/daily-service';
import { shareFlawlessStreakCard } from '@/lib/leaderboard-share-flow';
import { WIN_FG } from '@/lib/tile-theme';
import { ProBadge } from '@/components/ui/pro-badge';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { AvatarUpload } from '@/components/profile/avatar-upload';
import dynamic from 'next/dynamic';
const ProStats = dynamic(() => import('@/components/profile/pro-stats').then(m => m.ProStats), { ssr: false });
import { SocialLinksDisplay, type SocialLinks } from '@/components/profile/social-links';
import { ProfileEditModal, EditProfileButton } from '@/components/profile/profile-edit-modal';
import { fetchUserMedals, fetchTodayDailyCompletions, type Medal as MedalType, type DailyCompletion } from '@/lib/daily-service';
import { fetchProfileTrends, fetchDailyPointsOverTime, fetchOpenerStats, fetchWeekdayForm, fetchTodayDailyStanding } from '@/lib/stats-service';
import { PointsChart } from '@/components/profile/sweep-stats';
import { GuessDistribution } from '@/components/profile/guess-distribution';
import { SolveTimeChart } from '@/components/profile/solve-time-chart';
import { DailyCalendar } from '@/components/profile/daily-calendar';
import { TopWordsCard } from '@/components/profile/top-words-card';
import { fetchUserAchievements, ACHIEVEMENTS } from '@/lib/achievement-service';
import { SnapshotHero } from '@/components/profile/snapshot-hero';
import { SectionHeader, KitCard, ChartCard } from '@/components/profile/stat-kit';
import { SkillRadarCard, RivalriesCard } from '@/components/profile/pro-insights-deep';
import { PROFILE_MODES } from '@/components/profile/mode-picker';
import { resolveAccent } from '@/lib/profile-personalization';
import { shareResult } from '@/lib/share-utils';
import { useYourRecords, NextUpCard, SweepRecordsCard, GameRecordsCard, RecordsHeldRow, TrophyShelf } from '@/components/stats/your-records';
import { ModeDetailPanel } from '@/components/profile/mode-detail-panel';
import { GameRail, buildRailItems, RAIL_TODAY, RAIL_VS, RAIL_ALL } from '@/components/stats/game-rail';
import { TodayCard } from '@/components/stats/today-card';
import { useFlags } from '@/hooks/use-flags';
import type { Database } from '@/lib/database.types';

type UserStats = Database['public']['Tables']['user_stats']['Row'];
type Match = Database['public']['Tables']['matches']['Row'];

import { MODES, MODE_BY_DBKEY, SWEEP_MODES, MORE_GAME_MODES } from '@/lib/modes.generated';
import { sweepModesFor } from '@/lib/daily-modes';
import { dailyHref } from '@/lib/mode-routes';
import { MODE_CHROME } from '@/components/home/mode-chrome';
import { formatGuessStat } from '@/lib/format';

// STATS (Stats + Friends redesign D2, founder 2026-09-26: "option 2" — Profile
// and Records merge into one Stats tab that "flows like butter"). One page:
//   identity strip → game rail → ONE page below it, chosen from the rail:
//   Today (landing) · a game page per daily mode · VS · All-time.
// Swipe left/right on the page moves one rail chip; hold Today (or the grid
// button) for every game at once. `?view=<key>` keeps the page on reload and
// lets /records redirect to the All-time page. Zero new fetches beyond the
// old profile page except today's VS result and the sweep streak.

// Recent Matches chrome — from the catalog + the home icon table (More Games
// Stage 6), so every daily mode (Sudocious included) gets its title, icon and
// accent without a second hand-typed list. The two legacy VS labels stay.
const gameModeTitles: Record<string, string> = {
  ...Object.fromEntries(MODES.filter((m) => m.dbKey).map((m) => [m.dbKey as string, m.title])),
  MULTI_DUEL: 'Multi Duel',
  TOURNAMENT: 'Tournament',
};

const gameModeIcons: Record<string, { icon: React.ComponentType<any> | null; romanNumeral?: string; color: string }> = Object.fromEntries(
  MODES.filter((m) => m.dbKey).map((m) => [
    m.dbKey as string,
    { icon: MODE_CHROME[m.id]?.icon ?? null, romanNumeral: m.romanNumeral ?? undefined, color: m.accentHex },
  ]),
);

/** "4 guesses" / "0 mistakes" / "Par" — the row's stat through the mode's semantics. */
const matchStat = (gameMode: string, score: number): string => {
  const meta = MODE_BY_DBKEY[gameMode];
  return formatGuessStat(meta?.guessSemantics ?? 'guesses', meta?.guessBase ?? 1, score);
};

// Today's sweep set, from the catalog's dated era table (8 modes from
// 2026-09-25, 9 before — never a literal list). Routes from mode-routes.
const DAILY_MODES: Array<{ id: string; href: string }> = sweepModesFor(getTodayLocal()).map((id) => ({
  id,
  href: dailyHref(id) ?? '/',
}));
const isSweepMode = (dbKey: string) => DAILY_MODES.some((m) => m.id === dbKey);

/** Word-engine games and ProperNoundle have live VS boards; the More Games titles do not. */
const hasVs = (dbKey: string): boolean => {
  const meta = MODE_BY_DBKEY[dbKey];
  return !!meta && (meta.engine === 'word' || meta.dbKey === 'PROPERNOUNDLE');
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

const VIEW_PARAM = 'view';
/** `?view=all-time` (the /records redirect), `?view=vs`, `?view=<dbKey>`; anything else → Today. */
function readViewParam(): string {
  try {
    const v = new URLSearchParams(window.location.search).get(VIEW_PARAM);
    if (!v) return RAIL_TODAY;
    if (v === 'all-time' || v === RAIL_ALL) return RAIL_ALL;
    if (v === RAIL_VS) return RAIL_VS;
    return MODE_BY_DBKEY[v] ? v : RAIL_TODAY;
  } catch { return RAIL_TODAY; }
}
function writeViewParam(key: string) {
  try {
    const url = key === RAIL_TODAY ? '/stats' : `/stats?${VIEW_PARAM}=${key === RAIL_ALL ? 'all-time' : key}`;
    window.history.replaceState(window.history.state, '', url);
  } catch {}
}

export default function StatsPage() {
  const { profile, loading, refreshProfile, isProActive, exitGuest } = useAuth();
  const { isOn: flagOn } = useFlags();
  // Solo/VS toggle on a game page — scopes user_stats AND every per-game
  // chart (restat B1). The VS page pins it to 'vs' (or 'vs_cpu' for practice).
  const [activeTab, setActiveTab] = useState<'solo' | 'vs' | 'vs_cpu'>('solo');
  // Which page the rail shows. Starts on Today on both server and client (a
  // lazy window read would mismatch hydration); the mount effect applies ?view=.
  const [selected, setSelectedState] = useState<string>(RAIL_TODAY);
  useEffect(() => { setSelectedState(readViewParam()); }, []);
  const setSelected = useCallback((key: string) => {
    setSelectedState(key);
    writeViewParam(key);
    if (key === RAIL_VS) setActiveTab((t) => (t === 'solo' ? 'vs' : t));
    else if (key !== RAIL_ALL && key !== RAIL_TODAY && !hasVs(key)) setActiveTab('solo');
  }, []);

  // P5 split: static-per-user data fetches once; only trends/openers/weekday
  // re-fetch on a Solo/VS toggle, and keepPreviousData keeps the old charts
  // up (with the F1 fade) instead of dropping to skeletons.
  const { data: staticData, isLoading: loadingStats } = useSWR(
    profile ? ['profile-static', profile.id] : null,
    async () => {
      const [statsRes, matchBundle, medalsRes, achievementsRes, dailiesRes, sweepPointsRes, standingRes, vsTodayRes, sweepStatsRes] = await Promise.all([
        supabase.from('user_stats').select('*').eq('user_id', profile!.id).then(r => r.data || []),
        // Matches + opponent usernames chained INSIDE the Promise.all — the
        // name lookup used to run after it, adding a round trip to everything.
        (async () => {
          const { data } = await supabase.from('matches')
            .select('id, game_mode, player1_id, player2_id, winner_id, player1_score, player2_score, player1_time, player2_time, created_at, forfeit')
            .or(`player1_id.eq.${profile!.id},player2_id.eq.${profile!.id}`)
            .order('created_at', { ascending: false })
            .limit(50);
          const matchRows = (data || []) as Match[];
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
          return { matchRows, opponentNames };
        })(),
        fetchUserMedals(profile!.id, 120),
        fetchUserAchievements(profile!.id),
        fetchTodayDailyCompletions(profile!.id),
        fetchDailyPointsOverTime(profile!.id, 30),
        fetchTodayDailyStanding(profile!.id),
        fetchDailyVsResult(profile!.id).catch(() => null),
        fetchDailySweepStats(profile!.id).catch(() => null),
      ]);
      return {
        stats: statsRes as UserStats[],
        matches: matchBundle.matchRows,
        opponentNames: matchBundle.opponentNames,
        medals: medalsRes,
        userAchievements: new Set(achievementsRes.map(a => a.key)),
        todayDailies: dailiesRes,
        sweepPoints: sweepPointsRes,
        standing: standingRes,
        vsDailyWon: vsTodayRes as boolean | null,
        sweepStats: sweepStatsRes as DailySweepStats | null,
      };
    },
    { revalidateOnFocus: true, onError: (err: any) => handleSupabaseError(err, 'profile-data') },
  );

  const { data: tabData } = useSWR(
    profile ? ['profile-tab', profile.id, activeTab] : null,
    async () => {
      const [trendsRes, openersRes, weekdayRes] = await Promise.all([
        fetchProfileTrends(profile!.id, activeTab),   // B4: one query → activity+calendar+dist+solve+topwords
        fetchOpenerStats(profile!.id, 5, activeTab),
        fetchWeekdayForm(profile!.id, activeTab),
      ]);
      return {
        activity: trendsRes.activity,
        guessDist: trendsRes.guessDist,
        solveHistory: trendsRes.solveHistory,
        calendar: trendsRes.calendar,
        topWordsAllTime: trendsRes.topWordsAllTime,
        openers: openersRes,
        weekdayForm: weekdayRes,
      };
    },
    { revalidateOnFocus: true, keepPreviousData: true, onError: (err: any) => handleSupabaseError(err, 'profile-data') },
  );

  const stats = staticData?.stats ?? [];
  const matches = staticData?.matches ?? [];
  const opponentNames = staticData?.opponentNames ?? {};
  const medals = staticData?.medals ?? [];
  const userAchievements = staticData?.userAchievements ?? new Set<string>();
  const todayDailies = staticData?.todayDailies ?? new Map<string, DailyCompletion>();
  const sweepPoints = staticData?.sweepPoints ?? [];
  const standing = staticData?.standing ?? null;
  const vsDailyWon = staticData?.vsDailyWon ?? null;
  const sweepStats = staticData?.sweepStats ?? null;
  const activity = tabData?.activity ?? [];
  const guessDist = tabData?.guessDist ?? [];
  const solveHistory = tabData?.solveHistory ?? [];
  const calendar = tabData?.calendar ?? [];
  const topWordsAllTime = tabData?.topWordsAllTime ?? [];
  const openers = tabData?.openers ?? [];
  const weekdayForm = tabData?.weekdayForm ?? [];

  const [editOpen, setEditOpen] = useState(false);
  // Your records (the old Records → You view), folded in: D2 step 3.
  const yours = useYourRecords(profile?.id, stats);
  const [showAllMedals, setShowAllMedals] = useState(false);
  const [showAllRecent, setShowAllRecent] = useState(false);

  // The rail: Today · sweep games · VS · the More Games titles this viewer can
  // see (catalog ∩ remote flags) · All-time.
  const visibleMore = useMemo(() => MORE_GAME_MODES.filter((m) => m.dailyEligible && m.dbKey && flagOn(m.flagKey)), [flagOn]);
  const railItems = useMemo(() => buildRailItems(SWEEP_MODES, visibleMore, todayDailies, vsDailyWon), [visibleMore, todayDailies, vsDailyWon]);

  // Swipe on the page moves one chip along the rail (founder: no 19-page
  // swipe — but a swipe between neighbors is the natural gesture).
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; touchStart.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current; touchStart.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 50) return;
    const i = railItems.findIndex((it) => it.key === selected);
    const next = railItems[i + (dx < 0 ? 1 : -1)];
    if (next) setSelected(next.key);
  };

  // Stats filtered to the active Solo/VS tab.
  const filteredStats = stats.filter((s) => s.play_type === activeTab);

  // Aggregate VS record across all modes for the VS RECORD summary card.
  const vsRecord = (() => {
    const vsStats = stats.filter((s) => s.play_type === 'vs');
    const wins = vsStats.reduce((sum, s) => sum + (s.wins || 0), 0);
    const losses = vsStats.reduce((sum, s) => sum + (s.losses || 0), 0);
    const total = wins + losses;
    return { wins, losses, total, winRate: total > 0 ? Math.round((wins / total) * 100) : 0 };
  })();

  // Separate practice record vs the CPU (play_type='vs_cpu') — never ranked,
  // never on the leaderboard. Shown as its own box on the VS page. The best CPU
  // win streak comes from the client-side progression store (not user_stats).
  const cpuRecord = (() => {
    const cpuStats = stats.filter((s) => s.play_type === 'vs_cpu');
    const wins = cpuStats.reduce((sum, s) => sum + (s.wins || 0), 0);
    const losses = cpuStats.reduce((sum, s) => sum + (s.losses || 0), 0);
    const total = wins + losses;
    return { wins, losses, total, winRate: total > 0 ? Math.round((wins / total) * 100) : 0 };
  })();
  const cpuBestStreak = useMemo(() => loadCpuProgression().bestStreak, []);

  // Get stats for a mode (active tab only)
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

  // The VS page shows one word game's VS board at a time — the most-played by default.
  const [vsMode, setVsMode] = useState<string>('DUEL');
  const vsModes = useMemo(() => SWEEP_MODES.filter((m) => hasVs(m.dbKey as string)), []);

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
          <h1 className="text-2xl font-black mb-2" style={{ color: 'var(--color-text)' }}>Sign in to see your stats</h1>
          <p className="text-sm font-medium mb-5" style={{ color: 'var(--color-text-secondary)' }}>
            Create a free account to save your stats, streaks, and daily leaderboard ranks.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={exitGuest}
              className="btn-3d px-6 py-2.5 rounded-xl text-white font-black text-sm"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 4px 0 #4c1d95' }}
            >
              Sign In
            </button>
            <Link href="/">
              <button className="px-6 py-2.5 rounded-xl font-black text-sm" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)' }}>
                Go Home
              </button>
            </Link>
          </div>
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

  // Insights for the All-time page
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
    // Sweep cells only — a More Games daily on the books is not a sweep mode.
    const sweepToday = Array.from(todayDailies.entries()).filter(([k]) => isSweepMode(k));
    if (sweepToday.length === DAILY_MODES.length) {
      const allWon = sweepToday.every(([, r]) => r.won);
      out.push(allWon ? `Flawless Victory — all ${DAILY_MODES.length} dailies won today.` : `All ${DAILY_MODES.length} dailies done today. Legendary.`);
    } else if (sweepToday.length >= 3) {
      out.push(`${sweepToday.length}/${DAILY_MODES.length} dailies complete today — keep going.`);
    }
    return out.slice(0, 2);
  })();

  const accentHex = resolveAccent((profile as any).accent_color);
  const selectedMeta = MODE_BY_DBKEY[selected];
  const isGamePage = !!selectedMeta;

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: 'var(--color-bg)' }}>
      <AppHeader />

      <div className="max-w-2xl mx-auto px-4 space-y-4">
        {/* ── Identity strip (the old Profile header, compact) ── */}
        <div className="flex items-start gap-3 pt-1">
          <AvatarUpload size={64} editable={false} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              {(profile as any).accent_color ? (
                <h1 className="text-2xl font-black truncate" style={{ color: accentHex }}>{profile.username}</h1>
              ) : (
                <h1 className="text-2xl font-black truncate text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400">{profile.username}</h1>
              )}
              {isProActive && <ProBadge size="md" />}
            </div>
            {/* Personalization: featured title, bio, favorite-mode chip */}
            {(() => {
              const featuredName = (profile as any).featured_achievement
                ? ACHIEVEMENTS.find((a) => a.key === (profile as any).featured_achievement)?.name : null;
              const bioText = ((profile as any).bio as string | null)?.trim();
              const favMode = (profile as any).favorite_mode
                ? PROFILE_MODES.find((m) => m.dbKey === (profile as any).favorite_mode) : null;
              if (!featuredName && !bioText && !favMode) return null;
              return (
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {featuredName && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: `${accentHex}1a`, color: accentHex }}>
                      <Star className="w-3 h-3" fill="currentColor" /> {featuredName}
                    </span>
                  )}
                  {favMode && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${favMode.accentColor}1a`, color: favMode.accentColor }}>
                      {favMode.icon ? <favMode.icon className="w-3 h-3" /> : null} {favMode.shortTitle}
                    </span>
                  )}
                  {bioText && <p className="text-xs font-bold w-full" style={{ color: 'var(--color-text-muted)' }}>{bioText}</p>}
                </div>
              );
            })()}
            <div className="flex items-center gap-2 mt-1.5">
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold shrink-0"
                style={{ background: levelTier.bg, border: `1.5px solid ${levelTier.border}`, color: levelTier.color }}
              >
                <Star className="w-3 h-3" fill="currentColor" />
                Lvl {profile.level}
                <span className="opacity-70">·</span>
                <span>{levelTier.label}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                  <div className="h-full" style={{ width: `${levelProgress}%`, background: 'linear-gradient(90deg, #fbbf24, #f97316)' }} />
                </div>
                <p className="text-[9px] font-bold mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
                  {xpToNextLevel} XP to next{memberSince ? ` · since ${memberSince}` : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 -mt-1">
          <SocialLinksDisplay links={(profile as any).social_links as SocialLinks | null} />
          <EditProfileButton onClick={() => setEditOpen(true)} />
          <button
            onClick={() => {
              const tw = profile.total_wins, tl = profile.total_losses;
              void shareResult({
                layout: 'profile', mode: 'Classic',
                username: profile.username || 'Player',
                level: (profile as any).level ?? 1,
                tier: levelTier.label,
                accentHex,
                totalWins: tw,
                winRate: tw + tl > 0 ? Math.round((tw / (tw + tl)) * 100) : 0,
                currentStreak: (profile as any).current_streak ?? 0,
                dailyStreak: profile.daily_login_streak ?? 0,
                gold: (profile as any).gold_medals ?? 0,
                silver: (profile as any).silver_medals ?? 0,
                bronze: (profile as any).bronze_medals ?? 0,
                achievementsUnlocked: userAchievements.size,
                achievementsTotal: ACHIEVEMENTS.length,
              });
            }}
            className="flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-muted)', border: '1.5px solid var(--color-border)' }}
          >
            <Sparkles className="w-3.5 h-3.5" /> Share
          </button>
          {/* PRIVATE PROFILES: the owner's always-on reminder that others see
              only the teaser card. Tap opens the edit modal (where the toggle lives). */}
          {(profile as any).is_private && (
            <button
              onClick={() => setEditOpen(true)}
              title="Your profile is private — other players see a limited card. Tap to change."
              className="flex items-center gap-1 text-[11px] font-extrabold px-3 py-1.5 rounded-full"
              style={{ background: '#f3f0ff', border: '1.5px solid #c4b5fd', color: '#7c3aed' }}
            >
              <Lock className="w-3 h-3" /> Private
            </button>
          )}
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

        {/* ── The game rail ── */}
        <GameRail items={railItems} selected={selected} onSelect={setSelected} />

        {/* ── ONE page below the rail. Keyed so each change fades+rises (F1). ── */}
        <div
          key={`${selected}-${activeTab}`}
          className="animate-content-swap space-y-4"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {selected === RAIL_TODAY && (
            <TodayCard
              sweepModes={DAILY_MODES}
              moreModes={visibleMore}
              todayDailies={todayDailies}
              vsDailyWon={vsDailyWon}
              standing={standing}
              sweepStreak={sweepStats?.currentSweepStreak ?? 0}
              flawlessStreak={sweepStats?.currentFlawlessStreak ?? 0}
              flawlessFooter={<FlawlessBannerFooter total={DAILY_MODES.length} />}
              onJump={setSelected}
            />
          )}

          {isGamePage && (() => {
            const meta = selectedMeta!;
            const accentColor = meta.accentHex;
            const today = todayDailies.get(selected);
            const href = dailyHref(selected) ?? '/';
            return (
              <>
                {/* Solo | VS toggle — only where the game has a live VS board. */}
                {hasVs(selected) && (
                  <div className="flex gap-2">
                    {(['solo', 'vs'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setActiveTab(t)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all"
                        style={{
                          background: activeTab === t ? 'var(--color-surface)' : 'var(--color-surface-hover)',
                          border: activeTab === t ? `1.5px solid ${accentColor}` : '1.5px solid var(--color-border)',
                          color: activeTab === t ? accentColor : 'var(--color-text-muted)',
                        }}
                      >
                        {t === 'solo' ? <User className="w-3.5 h-3.5" /> : <Swords className="w-3.5 h-3.5" />}
                        {t === 'solo' ? 'Solo' : 'VS'}
                      </button>
                    ))}
                  </div>
                )}
                {/* Today's result for this game, or the door to play it. */}
                <Link
                  href={href}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{ background: `${accentColor}10`, border: `1.5px solid ${accentColor}55`, borderRadius: '14px' }}
                >
                  <span className="text-[10px] font-black uppercase tracking-wider shrink-0" style={{ color: accentColor }}>Today</span>
                  <span className="text-xs font-extrabold flex-1 min-w-0 truncate" style={{ color: 'var(--color-text)' }}>
                    {today
                      ? `${today.won ? 'Won' : 'Lost'} · ${matchStat(selected, today.guesses)}${today.timeSeconds > 0 ? ` · ${formatDuration(today.timeSeconds)}` : ''} · ${today.score.toLocaleString()} pts`
                      : `Not played yet — play today's ${meta.title}`}
                  </span>
                  <span className="text-[11px] font-black shrink-0" style={{ color: accentColor }}>{today ? 'Open →' : 'Play →'}</span>
                </Link>
                {/* Your records in this game (the old Records → You "bests by mode" card). */}
                {activeTab === 'solo' && (
                  <GameRecordsCard
                    dbKey={selected}
                    my={stats.find((s) => s.game_mode === selected && s.play_type === 'solo')}
                    recordsHeld={yours.recordsHeld}
                    chases={yours.chases}
                  />
                )}
                <ModeDetailPanel
                  userId={profile.id}
                  gameMode={selected}
                  isPro={isProActive}
                  stats={getStatsForMode(selected)}
                  playType={activeTab === 'vs_cpu' ? 'solo' : activeTab}
                />
              </>
            );
          })()}

          {selected === RAIL_VS && (
            <>
              {/* VS RECORD summary card */}
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
                  <div className="text-[10px] font-extrabold" style={{ color: vsDailyWon === null ? 'var(--color-text-muted)' : vsDailyWon ? WIN_FG : '#dc2626' }}>
                    Today: {vsDailyWon === null ? 'not played' : vsDailyWon ? 'won' : 'lost'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black" style={{ color: '#7c3aed' }}>{vsRecord.winRate}%</div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                    Win rate · {vsRecord.total} {vsRecord.total === 1 ? 'match' : 'matches'}
                  </div>
                </div>
              </div>

              {/* Rivalries — most-faced opponents with head-to-head bars (Pro). */}
              {vsRecord.total > 0 && <RivalriesCard userId={profile.id} isPro={isProActive} />}

              {/* vs CPU record — unranked practice: no leaderboard, no XP, no streak. */}
              <div
                className="p-4 flex items-center gap-4"
                style={{ background: 'var(--color-surface)', border: '1.5px dashed var(--color-border)', borderRadius: '16px' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#64748b15' }}>
                  <Bot className="w-5 h-5" style={{ color: '#64748b' }} />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: '#64748b' }}>vs CPU</div>
                  <div className="text-xl font-black" style={{ color: 'var(--color-text)' }}>
                    {cpuRecord.wins}–{cpuRecord.losses}
                  </div>
                  {cpuRecord.total === 0 ? (
                    <div className="text-[10px] font-extrabold" style={{ color: 'var(--color-text-muted)' }}>Beat a bot to start your record</div>
                  ) : cpuBestStreak > 0 && (
                    <div className="text-[10px] font-extrabold" style={{ color: '#f97316' }}>🔥 Best streak: {cpuBestStreak}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xl font-black" style={{ color: '#64748b' }}>{cpuRecord.total === 0 ? '—' : `${cpuRecord.winRate}%`}</div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                    {cpuRecord.total === 0 ? 'No games yet' : `Win rate · ${cpuRecord.total} ${cpuRecord.total === 1 ? 'match' : 'matches'}`}
                  </div>
                </div>
              </div>

              {/* Per-game VS board: pick the word game, Live or CPU. */}
              <div className="flex items-center gap-2">
                <div className="flex-1 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {vsModes.map((m) => {
                    const active = vsMode === m.dbKey;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setVsMode(m.dbKey as string)}
                        className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-extrabold"
                        style={{
                          background: active ? `${m.accentHex}15` : 'var(--color-surface)',
                          border: active ? `1.5px solid ${m.accentHex}` : '1.5px solid var(--color-border)',
                          color: active ? m.accentHex : 'var(--color-text-muted)',
                        }}
                      >
                        {m.shortTitle}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-1 shrink-0">
                  {(['vs', 'vs_cpu'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold"
                      style={{
                        background: activeTab === t ? '#7c3aed15' : 'var(--color-surface)',
                        border: activeTab === t ? '1.5px solid #7c3aed' : '1.5px solid var(--color-border)',
                        color: activeTab === t ? '#7c3aed' : 'var(--color-text-muted)',
                      }}
                    >
                      {t === 'vs' ? 'Live' : 'CPU'}
                    </button>
                  ))}
                </div>
              </div>
              <ModeDetailPanel
                userId={profile.id}
                gameMode={vsMode}
                isPro={isProActive}
                stats={(() => {
                  const pt = activeTab === 'vs_cpu' ? 'vs_cpu' : 'vs';
                  const rows = stats.filter((s) => s.play_type === pt && s.game_mode === vsMode);
                  if (rows.length === 0) return null;
                  return {
                    wins: rows.reduce((s, r) => s + (r.wins || 0), 0),
                    losses: rows.reduce((s, r) => s + (r.losses || 0), 0),
                    total_games: rows.reduce((s, r) => s + (r.total_games || 0), 0),
                    best_score: rows.reduce((min, r) => r.best_score > 0 && (min === 0 || r.best_score < min) ? r.best_score : min, 0),
                    fastest_time: rows.reduce((min, r) => r.fastest_time > 0 && (min === 0 || r.fastest_time < min) ? r.fastest_time : min, 0),
                  };
                })()}
                playType={activeTab === 'vs_cpu' ? 'vs_cpu' : 'vs'}
              />
            </>
          )}

          {selected === RAIL_ALL && (
            <>
              {/* Lifetime headline stats + this-week strip */}
              <SnapshotHero
                totalWins={profile.total_wins}
                totalLosses={profile.total_losses}
                currentStreak={(profile as any).current_streak ?? 0}
                bestStreak={(profile as any).best_streak ?? 0}
                dailyStreak={profile.daily_login_streak}
                bestDailyStreak={(profile as any).best_daily_login_streak ?? 0}
                gamesThisWeek={activity.reduce((s, a) => s + a.count, 0)}
                level={(profile as any).level ?? 1}
                xpToNext={xpToNextLevel}
                isPro={isProActive}
              />

              {/* Your records (D2 step 3): what the Records → You view used to hold. */}
              <SectionHeader label="Your Records" accent="#d97706" />
              <NextUpCard dailyStreak={profile.daily_login_streak ?? 0} chases={yours.chases} />
              <SweepRecordsCard sweep={yours.sweep} sweepRankToday={yours.sweepRankToday} sweepRankAllTime={yours.sweepRankAllTime} />
              <RecordsHeldRow recordsHeld={yours.recordsHeld} />
              <TrophyShelf recordsHeld={yours.recordsHeld} />

              {/* Activity Calendar */}
              {calendar.some((d) => d.gamesPlayed > 0) && (
                <>
                  <SectionHeader label="Activity" accent="#7c3aed" />
                  <DailyCalendar data={calendar} />
                </>
              )}

              {/* 7-day activity */}
              {activity.length > 0 && (() => {
                const maxCount = Math.max(1, ...activity.map((a) => a.count));
                const totalWeek = activity.reduce((sum, a) => sum + a.count, 0);
                return (
                  <>
                    <SectionHeader
                      label="Last 7 Days"
                      accent="#a78bfa"
                      right={<span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{totalWeek} {totalWeek === 1 ? 'game' : 'games'}</span>}
                    />
                    <KitCard>
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
                    </KitCard>
                  </>
                );
              })()}

              {/* Guess Distribution — word games only here (one histogram cannot mix
                  guesses, mistakes and checks); each game page has its own. */}
              {guessDist.some((d) => d.count > 0) && (
                <>
                  <SectionHeader label="Guess Distribution" accent="#2563eb" right={<span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>word games</span>} />
                  <GuessDistribution data={guessDist} />
                </>
              )}

              {/* Solve Time Trend */}
              {solveHistory.length >= 2 && (
                <>
                  <SectionHeader label="Solve Time Trend" accent="#0d9488" />
                  <SolveTimeChart data={solveHistory} />
                </>
              )}

              {/* Daily points trend (sweep/flawless days marked). */}
              {sweepPoints.length >= 2 && (
                <>
                  <SectionHeader label="Daily Points" accent="#ec4899" />
                  <ChartCard title="Points per day" hint="Last 30 days · ● sweep · ● flawless">
                    <PointsChart points={sweepPoints} />
                  </ChartCard>
                </>
              )}

              {/* All-Time Top Words */}
              {topWordsAllTime.length > 0 && (
                <>
                  <SectionHeader label="Top Words — All Time" accent="#d97706" />
                  <TopWordsCard words={topWordsAllTime} accentColor="#7c3aed" />
                </>
              )}

              {/* Opener Lab (basic): favorite starting words + how they convert. */}
              {openers.length > 0 && (
                <>
                  <SectionHeader label="Opener Lab" accent="#06b6d4" />
                  <KitCard>
                    <div className="space-y-1.5">
                      {openers.map((o, i) => (
                        <div key={o.word} className="flex items-center gap-2.5 p-2" style={{ background: 'var(--color-bg)', borderRadius: '10px' }}>
                          <span className="text-[10px] font-black w-4 text-center" style={{ color: 'var(--color-text-muted)' }}>{i + 1}</span>
                          <span className="text-sm font-black tracking-wider flex-1" style={{ color: 'var(--color-text)' }}>{o.word}</span>
                          <span className="text-[10px] font-bold w-8 text-right" style={{ color: 'var(--color-text-muted)' }}>{o.count}×</span>
                          <span className="text-xs font-black w-14 text-right whitespace-nowrap" style={{ color: o.winRate >= 50 ? WIN_FG : '#dc2626' }}>{o.winRate}% W</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] font-bold mt-2 text-center" style={{ color: 'var(--color-text-muted)' }}>Win rate of games opened with each word</p>
                  </KitCard>
                </>
              )}

              {/* Weekday form: your best (and worst) day of the week. */}
              {weekdayForm.some((d) => d.played > 0) && (() => {
                const maxPlayed = Math.max(1, ...weekdayForm.map((d) => d.played));
                const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
                const withRate = weekdayForm.filter((d) => d.played >= 3);
                const best = withRate.length > 0 ? withRate.reduce((a, b) => (b.won / b.played > a.won / a.played ? b : a)) : null;
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                return (
                  <>
                    <SectionHeader label="Weekday Form" accent="#f97316" />
                    <ChartCard
                      title="Win rate by day"
                      hint={best ? `Best: ${dayNames[best.dow]} (${Math.round((best.won / best.played) * 100)}%)` : undefined}
                    >
                      <div className="flex items-end justify-between gap-1.5 h-20">
                        {weekdayForm.map((d) => {
                          const rate = d.played > 0 ? d.won / d.played : 0;
                          return (
                            <div key={d.dow} className="flex-1 flex flex-col items-center gap-1">
                              <span className="text-[8px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                                {d.played > 0 ? `${Math.round(rate * 100)}%` : ''}
                              </span>
                              <div className="w-full flex items-end" style={{ height: 44 }}>
                                <div
                                  className="w-full rounded-t"
                                  style={{
                                    height: `${d.played === 0 ? 4 : 10 + rate * 90}%`,
                                    background: d.played === 0 ? 'var(--color-border)' : best && d.dow === best.dow ? 'linear-gradient(180deg, #fbbf24, #f97316)' : 'linear-gradient(180deg, #a78bfa, #7c3aed)',
                                    opacity: d.played === 0 ? 1 : 0.5 + 0.5 * (d.played / maxPlayed),
                                  }}
                                  title={`${d.won}/${d.played} won`}
                                />
                              </div>
                              <span className="text-[9px] font-extrabold" style={{ color: 'var(--color-text-muted)' }}>{labels[d.dow]}</span>
                            </div>
                          );
                        })}
                      </div>
                    </ChartCard>
                  </>
                );
              })()}

              {/* Insights */}
              {insights.length > 0 && (
                <>
                  <SectionHeader label="Insights" accent="#7c3aed" />
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

              {/* Pro Stats (global view) */}
              <ProStats userId={profile.id} isPro={isProActive} />

              {/* Skill Radar — the five-axis signature chart (Pro). */}
              <SkillRadarCard userId={profile.id} isPro={isProActive} />

              {/* ── Progression: medals + achievements under one banner ── */}
              <SectionHeader label="Progression" accent="#f59e0b" />

              {/* Daily Medals */}
              <KitCard>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black" style={{ color: 'var(--color-text)' }}>Daily Medals</span>
                </div>
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
                  <>
                    <div className={`space-y-1.5 ${showAllMedals ? 'max-h-80 overflow-y-auto pr-1' : ''}`}>
                      {(showAllMedals ? medals : medals.slice(0, 5)).map((medal: MedalType) => {
                        const medalConfig: Record<string, { icon: typeof Crown; color: string; label: string }> = {
                          gold: { icon: Crown, color: '#d97706', label: '1st' },
                          silver: { icon: Medal, color: 'var(--color-text-muted)', label: '2nd' },
                          bronze: { icon: Medal, color: '#b45309', label: '3rd' },
                          streak_7: { icon: Flame, color: '#ea580c', label: '7-Day Streak' },
                          streak_30: { icon: Flame, color: '#dc2626', label: '30-Day Streak' },
                          streak_100: { icon: Flame, color: '#7c3aed', label: '100-Day Streak' },
                          perfect: { icon: Star, color: WIN_FG, label: 'Perfect' },
                        };
                        const cfg = medalConfig[medal.medal_type] || { icon: Medal, color: 'var(--color-text-muted)', label: medal.medal_type };
                        const MedalIcon = cfg.icon;
                        return (
                          <div key={medal.id} className="flex items-center gap-2.5 p-2.5" style={{ background: 'var(--color-bg)', borderRadius: '10px' }}>
                            <MedalIcon className="w-4 h-4" style={{ color: cfg.color }} fill={cfg.icon === Flame || cfg.icon === Star ? 'currentColor' : 'none'} />
                            <span className="text-xs font-extrabold flex-1" style={{ color: 'var(--color-text)' }}>
                              {medal.medal_type.startsWith('streak') ? cfg.label : (gameModeTitles[medal.game_mode] || medal.game_mode)}
                              {medal.medal_type === 'perfect' && <span className="text-[10px] font-bold ml-1" style={{ color: WIN_FG }}>Perfect!</span>}
                            </span>
                            <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                              {new Date(medal.day + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {medals.length > 5 && (
                      <button onClick={() => setShowAllMedals((v) => !v)} className="w-full mt-2 py-1 text-[11px] font-extrabold" style={{ color: '#7c3aed' }}>
                        {showAllMedals ? 'Show less' : `View all ${medals.length} medals →`}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-center text-xs font-bold py-3" style={{ color: 'var(--color-text-muted)' }}>Play daily challenges to earn medals!</p>
                )}
              </KitCard>

              {/* Achievements (grouped by category, under the Progression banner) */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black" style={{ color: 'var(--color-text)' }}>Achievements</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: '#f3f0ff', color: '#7c3aed' }}>{userAchievements.size}/{ACHIEVEMENTS.length}</span>
              </div>
              <div className="space-y-3 mb-2">
                {([
                  ['beginner', 'Getting Started', '#7c3aed'],
                  ['consistency', 'Consistency', '#f97316'],
                  ['skill', 'Skill', '#2563eb'],
                  ['social', 'Social', '#0d9488'],
                  ['collection', 'Collection', '#d97706'],
                ] as const).map(([catKey, catLabel, catColor]) => {
                  const items = ACHIEVEMENTS.filter((a) => a.category === catKey);
                  if (items.length === 0) return null;
                  const unlockedN = items.filter((a) => userAchievements.has(a.key)).length;
                  const medalCount = ((profile as any).gold_medals || 0) + ((profile as any).silver_medals || 0) + ((profile as any).bronze_medals || 0);
                  // Progress hints for a few cheaply-derivable locked achievements.
                  const progressMap: Record<string, { c: number; t: number }> = {
                    streak_7: { c: profile.daily_login_streak || 0, t: 7 },
                    streak_30: { c: profile.daily_login_streak || 0, t: 30 },
                    medal_10: { c: medalCount, t: 10 },
                    medal_50: { c: medalCount, t: 50 },
                  };
                  return (
                    <div key={catKey}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[11px] font-black uppercase tracking-wide" style={{ color: catColor }}>{catLabel}</span>
                        <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{unlockedN}/{items.length}</span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {items.map((a) => {
                          const isUnlocked = userAchievements.has(a.key);
                          const prog = !isUnlocked ? progressMap[a.key] : undefined;
                          const showProg = !!prog && prog.c < prog.t;
                          return (
                            <div key={a.key} className="text-center p-2.5" style={{ background: isUnlocked ? '#f3f0ff' : '#fafafa', border: isUnlocked ? '1.5px solid #c4b5fd' : '1.5px solid var(--color-border)', borderRadius: '12px', opacity: isUnlocked ? 1 : (showProg ? 0.8 : 0.4) }}>
                              <div className="text-lg mb-0.5">{isUnlocked ? '✓' : '?'}</div>
                              <div className="text-[10px] font-extrabold truncate" style={{ color: 'var(--color-text)' }}>{a.name}</div>
                              <div className="text-[9px] font-bold truncate" style={{ color: 'var(--color-text-muted)' }}>{a.description}</div>
                              {showProg && (
                                <div className="mt-1">
                                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (prog!.c / prog!.t) * 100)}%`, background: '#7c3aed' }} />
                                  </div>
                                  <div className="text-[8px] font-bold mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{prog!.c}/{prog!.t}</div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Recent Matches ── */}
              <SectionHeader label="Recent Matches" accent="#2563eb" />
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
                  {(showAllRecent ? matches : matches.slice(0, 5)).map((match) => {
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
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded" style={{ background: match.player2_id ? '#ede9f6' : '#eff6ff', color: match.player2_id ? '#7c3aed' : '#2563eb' }}>
                              {match.player2_id ? 'VS' : 'Solo'}
                            </span>
                            {(match as any).forfeit && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded" style={{ background: '#fef3c7', color: '#b45309' }}>
                                FORFEIT
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-bold truncate" style={{ color: 'var(--color-text-muted)' }}>
                            {matchStat(match.game_mode, score)} · {playerTime > 0 ? formatDuration(playerTime) : '—'}
                            {opponentName ? ` · vs ${opponentName}` : ''}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs font-extrabold" style={{ color: isWinner ? WIN_FG : '#dc2626' }}>{isWinner ? 'Win' : 'Loss'}</div>
                          <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                            {matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {matchDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {matches.length > 5 && (
                    <button onClick={() => setShowAllRecent((v) => !v)} className="w-full mt-2 py-1 text-[11px] font-extrabold" style={{ color: '#7c3aed' }}>
                      {showAllRecent ? 'Show less' : `View all ${matches.length} →`}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>{/* /page */}
      </div>

      <BottomNav />
      <ProfileEditModal open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}

/** §244 (founder: "I just got my third flawless victory in a row and I have
 *  no way of easily identifying that or even show it off"): the flawless
 *  banner's footer — streak-aware copy ("3-DAY FLAWLESS STREAK") plus the
 *  share button for the brag card. Self-contained fetch so the card stays
 *  hook-free. */
function FlawlessBannerFooter({ total }: { total: number }) {
  const { profile } = useAuth();
  const [sweep, setSweep] = useState<DailySweepStats | null>(null);
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    let active = true;
    if (profile?.id) fetchDailySweepStats(profile.id).then((s) => { if (active) setSweep(s); });
    return () => { active = false; };
  }, [profile?.id]);
  const streak = sweep?.currentFlawlessStreak ?? 0;
  const share = async () => {
    if (sharing || streak < 1) return;
    setSharing(true);
    try {
      await shareFlawlessStreakCard({
        streak,
        anchorDay: getTodayLocal(),
        bestStreak: sweep?.bestFlawlessStreak,
        username: profile?.username,
      });
    } finally { setSharing(false); }
  };
  return (
    <div className="text-center mt-2">
      {streak >= 2 && (
        <div className="text-sm font-black tracking-wide" style={{ color: '#b45309' }}>
          🏆 {streak}-DAY FLAWLESS STREAK
        </div>
      )}
      <div className="flex items-center justify-center gap-1.5 mt-0.5">
        <span className="text-[11px] font-extrabold" style={{ color: '#b45309' }}>
          All {total} dailies won today · +600 XP earned
        </span>
        {streak >= 1 && (
          <button
            onClick={share}
            disabled={sharing}
            aria-label="Share flawless streak"
            className="p-0.5 active:scale-95 transition-transform"
            style={{ color: '#b45309', opacity: sharing ? 0.4 : 1 }}
          >
            <Share className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
