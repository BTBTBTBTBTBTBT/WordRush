'use client';

import { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth-context';
import { useDailyCompletions } from '@/lib/daily-completions-context';
import { loadCpuProgression } from '@/lib/bot/cpu-progression';
import { supabase } from '@/lib/supabase-client';
import {
  Star,
  Swords,
  User,
  Medal,
  Sparkles,
  Bot,
  Lock,
  Pencil,
} from 'lucide-react';
import { GameArt } from '@/components/ui/game-art';
import { Icon3D, Flame3D, type IconLike } from '@/components/ui/icon3d';
import { handleSupabaseError } from '@/lib/supabase-error-handler';
import { fetchDailySweepStats, type DailySweepStats } from '@/lib/stats-service';
import { getTodayLocal, fetchDailyVsResult } from '@/lib/daily-service';
import { shareFlawlessStreakCard } from '@/lib/leaderboard-share-flow';
import { WIN_FG } from '@/lib/tile-theme';
import { BadgeArt, LevelBadge } from '@/components/badges/badge-art';
import { AchievementGrid } from '@/components/badges/achievement-grid';
import { achievementBadge, achievementProgress } from '@/lib/badges';
import { levelTier as coreLevelTier, levelTierLabel } from '@wordle-duel/core';
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
import { SectionHeader, KitCard, ChartCard, TintTile } from '@/components/profile/stat-kit';
import { STAT_LABELS } from '@/lib/stat-labels';
import { PageHeadline } from '@/components/ui/page-headline';
import { CandyButton, CandyLink } from '@/components/ui/candy-button';
import { HeaderGlyph } from '@/components/ui/header-glyph';
import { SoftNum } from '@/components/ui/soft-number';
import { BRAND_ACCENT, alphaHex, cardBarStyle, softBorder, softCard, softPill } from '@/lib/soft-surface';
import { MASCOT_LINES } from '@/lib/mascots';
import { PAGE_SCENES } from '@/lib/art';
import { SkillRadarCard, RivalriesCard } from '@/components/profile/pro-insights-deep';
import { PROFILE_MODES } from '@/components/profile/mode-picker';
import { resolveAccent } from '@/lib/profile-personalization';
import { shareResult } from '@/lib/share-utils';
import { useYourRecords, NextUpCard, SweepRecordsCard, PuzzleSweepRecordsCard, WordQuizRecordCard, GameRecordsCard, RecordsHeldRow, TrophyShelf } from '@/components/stats/your-records';
import { WeeklyFinishesCard } from '@/components/stats/weekly-finishes';
import { RecentMatchesList, isPlayedToday, isUnlimitedSolo } from '@/components/stats/recent-matches';
import { SignatureCard, StandingTrendCard } from '@/components/stats/signature-cards';
import { ModeDetailPanel } from '@/components/profile/mode-detail-panel';
import { StatsPicker } from '@/components/stats/stats-picker';
import { TintSegment } from '@/components/stats/tint-segment';
import { TodayCard } from '@/components/stats/today-card';
import { pickerRows, SWEEP_KEY } from '@/lib/game-picker';
import { VIEW_TODAY, VIEW_ALL, VIEW_SWEEP, VIEW_VS, VIEW_PARAM, parseViewParam, viewUrl, swipeOrder, swipeNeighbor, isPageSwipe, todayBadges } from '@/lib/stats-view';
import { useFlags } from '@/hooks/use-flags';
import type { Database } from '@/lib/database.types';

type UserStats = Database['public']['Tables']['user_stats']['Row'];
type Match = Database['public']['Tables']['matches']['Row'];

import { MODES, MODE_BY_DBKEY, SWEEP_MODES, MORE_GAME_MODES } from '@/lib/modes.generated';
import { sweepModesFor } from '@/lib/daily-modes';
import { dailyHref } from '@/lib/mode-routes';
import { MODE_CHROME } from '@/components/home/mode-chrome';
import { GameSquare, GameTileGlyph } from '@/components/ui/game-tile';
import { formatGuessStat } from '@/lib/format';
import { PageBackground } from '@/components/ui/page-background';
import { MedalArt, GoldMedal, SilverMedal, BronzeMedal } from '@/components/stats/medal-art';

// STATS (Stats + Friends redesign D2, founder 2026-09-26: "option 2" — Profile
// and Records merge into one Stats tab that "flows like butter"). One page:
//   STATS headline → identity card → the game picker → ONE page below it:
//   Today (landing) · All-time · the Daily Sweep · a game page per daily mode.
// The picker is the Leaderboard's (FINISH_SPEC C3): every game visible at
// once, Today | All-time as a toggle in its header row. Swipe left/right on
// the page moves one step in the picker's reading order (lib/stats-view.ts).
// `?view=<key>` keeps the page on reload and lets /records redirect to the
// All-time page. Zero new fetches beyond the old profile page except today's
// VS result and the sweep streak.

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

/** `?view=all-time` (the /records redirect), `?view=sweep`, `?view=<dbKey>`; 'vs' → All-time; anything else → Today. */
function readViewParam(): string {
  try {
    return parseViewParam(new URLSearchParams(window.location.search).get(VIEW_PARAM), (k) => !!MODE_BY_DBKEY[k]);
  } catch { return VIEW_TODAY; }
}
function writeViewParam(key: string) {
  try {
    window.history.replaceState(window.history.state, '', viewUrl(key));
  } catch {}
}

// Layout effect on the client (the ?view= page applies before the first paint),
// plain effect on the server (where layout effects warn and do nothing).
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
const NO_DAILIES = new Map<string, DailyCompletion>();

export default function StatsPage() {
  const { profile, loading, refreshProfile, isProActive, exitGuest } = useAuth();
  const { isOn: flagOn } = useFlags();
  // Solo/VS toggle on a game page — scopes user_stats AND every per-game
  // chart (restat B1). The VS page pins it to 'vs' (or 'vs_cpu' for practice).
  const [activeTab, setActiveTab] = useState<'solo' | 'vs' | 'vs_cpu'>('solo');
  // Which page the picker shows. Starts on Today on both server and client (a
  // lazy window read would mismatch hydration); the mount effect applies ?view=
  // before the first paint — a ?view=all-time landing no longer shows Today for
  // a frame first (founder, 2026-09-29).
  const [selected, setSelectedState] = useState<string>(VIEW_TODAY);
  useIsomorphicLayoutEffect(() => { setSelectedState(readViewParam()); }, []);
  const setSelected = useCallback((key: string) => {
    // The Today card's VS pill still says 'vs': that is All-time's VS section now.
    if (key === VIEW_VS) {
      setSelectedState(VIEW_ALL);
      writeViewParam(VIEW_ALL);
      setTimeout(() => document.getElementById('vs-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      return;
    }
    setSelectedState(key);
    writeViewParam(key);
    if (key !== VIEW_ALL && key !== VIEW_TODAY && !hasVs(key)) setActiveTab('solo');
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
          // The newest 50 plus every game of the last 36 h, so Today's Games is never cut short
          // by a long Unlimited session (founder, 2026-09-29); `seed` tells daily from Unlimited.
          const cols = 'id, game_mode, player1_id, player2_id, winner_id, player1_score, player2_score, player1_time, player2_time, created_at, forfeit, seed';
          const mine = `player1_id.eq.${profile!.id},player2_id.eq.${profile!.id}`;
          const since = new Date(Date.now() - 36 * 3600_000).toISOString();
          const [recent, today] = await Promise.all([
            supabase.from('matches').select(cols).or(mine).order('created_at', { ascending: false }).limit(50),
            supabase.from('matches').select(cols).or(mine).gte('created_at', since).order('created_at', { ascending: false }).limit(400),
          ]);
          const byId = new Map<string, Match>();
          for (const m of [...((today.data || []) as Match[]), ...((recent.data || []) as Match[])]) byId.set(m.id, m);
          const matchRows = Array.from(byId.values()).sort((x, y) => (x.created_at < y.created_at ? 1 : x.created_at > y.created_at ? -1 : 0));
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
        achievementDates: new Map<string, string | null>(achievementsRes.map(a => [a.key, a.unlocked_at ?? null])),
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
  // Unlimited is a Pro feature: free players see only their dailies and VS games here (founder, 2026-09-29).
  const todaysMatches = matches.filter((m) => isPlayedToday(m.created_at) && (isProActive || !isUnlimitedSolo(m)));
  const medals = staticData?.medals ?? [];
  const userAchievements = staticData?.userAchievements ?? new Set<string>();
  const achievementDates = staticData?.achievementDates ?? new Map<string, string | null>();
  // Until the page's own read lands (first visit this session), today's results
  // come from the completions context the whole app already holds (disk-cached,
  // same daily_results rows) — so the Today card, the rail's W/L dots and a game
  // page's "Today" line paint at once instead of reading "not played" and then
  // flipping (founder, 2026-09-29).
  const { todayDailies: ctxDailies, dailiesDay } = useDailyCompletions();
  const todayDailies = staticData?.todayDailies ?? (dailiesDay === getTodayLocal() ? ctxDailies : NO_DAILIES);
  const sweepPoints = staticData?.sweepPoints ?? [];
  const standing = staticData?.standing ?? null;
  const vsDailyWon = staticData?.vsDailyWon ?? null;
  const sweepStats = staticData?.sweepStats ?? null;
  const activity = tabData?.activity ?? [];
  const guessDist = tabData?.guessDist ?? [];
  // All-time's trend is the Wordocious games only (founder, 2026-10-01 stats audit: a 6-minute
  // Sudocious next to a 40-second Classic made the line meaningless); each Puzzles page has its own.
  const solveHistory = (tabData?.solveHistory ?? []).filter((r) => isSweepMode(r.mode));
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
  // Founder, 2026-10-01 stats audit: the Puzzles' runs and lifetime sweeps (Today card,
  // All-time "Puzzles Sweeps") and the Word of the Day record.
  const puzzleKeysParam = visibleMore.map((m) => m.dbKey as string).join(',');
  const { data: puzzleRec } = useSWR(
    profile ? ['puzzle-records', profile.id, puzzleKeysParam] : null,
    () => import('@/lib/home-streaks').then((m) => m.fetchPuzzleRecords(profile!.id, puzzleKeysParam ? puzzleKeysParam.split(',') : [])),
    { revalidateOnFocus: false },
  );
  const { data: quizRec } = useSWR(
    profile ? ['quiz-record', profile.id] : null,
    () => import('@/lib/home-streaks').then((m) => m.fetchQuizRecord(profile!.id)),
    { revalidateOnFocus: false },
  );
  // The picker's rows (the same filter as Home), today's W / L per tile, and
  // the swipe order (Today · All-time · WORDOCIOUS incl. Sweep · PUZZLES).
  const rows = useMemo(() => pickerRows(flagOn), [flagOn]);
  const badges = useMemo(() => todayBadges(rows, todayDailies, DAILY_MODES.map((m) => m.id)), [rows, todayDailies]);
  const order = useMemo(() => swipeOrder(rows), [rows]);

  // Swipe on the page moves one step through the picker (founder: no 19-page
  // swipe — but a swipe between neighbors is the natural gesture).
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    // A swipe that starts in a sideways scroller (the VS game tiles) scrolls it, never the page.
    let el = e.target as HTMLElement | null;
    while (el && el !== e.currentTarget) {
      const ox = getComputedStyle(el).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth) { touchStart.current = null; return; }
      el = el.parentElement;
    }
    const t = e.touches[0]; touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current; touchStart.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    // Founder 10-02: a diagonal scroll no longer flips the page (which snapped the view back to the picker).
    if (!isPageSwipe(dx, dy)) return;
    const next = swipeNeighbor(order, selected, dx < 0 ? 1 : -1);
    if (next) setSelected(next);
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
  // The All-time page's VS boards keep their OWN People | Bots choice, so picking Bots there never
  // re-scopes the rest of All-time (its charts read activeTab).
  const [vsTab, setVsTab] = useState<'vs' | 'vs_cpu'>('vs');
  const vsModes = useMemo(() => SWEEP_MODES.filter((m) => hasVs(m.dbKey as string)), []);

  if (loading) {
    return (
      <PageBackground tint="stats" className="min-h-screen flex items-center justify-center">
        <div className="text-lg font-black animate-pulse" style={{ color: 'var(--color-text)' }}>Loading...</div>
      </PageBackground>
    );
  }

  if (!profile) {
    return (
      <PageBackground tint="stats" className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-black mb-2" style={{ color: 'var(--color-text)' }}>Sign in to see your stats</h1>
          <p className="text-sm font-medium mb-5" style={{ color: 'var(--color-text-secondary)' }}>
            Create a free account to save your stats, streaks, and daily leaderboard ranks.
          </p>
          <div className="flex items-center justify-center gap-3">
            <CandyButton onClick={exitGuest} color="purple" size="md">Sign In</CandyButton>
            <CandyLink href="/" color="peach" size="md">Go Home</CandyLink>
          </div>
        </div>
      </PageBackground>
    );
  }

  const levelProgress = (profile.xp % 1000) / 10;
  const xpToNextLevel = 1000 - (profile.xp % 1000);

  // V3: the shared tier ladder (packages/core levelTier).
  const tierLabel = levelTierLabel(coreLevelTier(profile.level ?? 1));

  const memberSince = (profile as any).created_at
    ? new Date((profile as any).created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  // Insights for the All-time page
  const insights: string[] = (() => {
    const out: string[] = [];
    // Founder, 2026-10-01 stats audit: a game nearly everyone wins (Seven at 100%) says nothing,
    // so only games with 5+ plays and a win rate of 95% or less can be the "strongest".
    const qualifying = stats.filter((s) => (s.total_games || 0) >= 5 && s.wins / s.total_games <= 0.95);
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
    <PageBackground tint="stats" className="min-h-screen pb-32">
      <AppHeader />

      {/* FINISH_SPEC AG (desktop web ≥ 900 px; nothing changes below): up to
          1100 px wide — the headline across the top, then two columns: the
          player card + game picker on the left (kept in view on tall windows),
          the selected page's cards on the right. */}
      <div className="max-w-2xl page-wide mx-auto px-4 space-y-4">
        {/* A6: the STATS title is a headline — full width, edge to edge, right on the wallpaper. */}
        <PageHeadline name="art-title-stats" label="Stats" className="pt-1" />

        <div className="page-grid-2 space-y-4">
        <div className="page-sticky space-y-4">

        {/* ── Player card (C3 cont): lavender wash, purple→pink 10 px top bar, the level bar in
            the same gradient. Avatar · name · chips on the first row with Edit (candy) and Share
            (bare 3D icon) top-right; the level row spans the card; Private, Go Pro and the dev
            toggle sit in a single footer row only when they apply. ── */}
        <div className="overflow-hidden" style={softCard(BRAND_ACCENT, { radius: 20 })}>
          <div aria-hidden="true" style={{ height: 10, background: 'linear-gradient(90deg, #7c3aed, #ec4899)' }} />
          <div className="p-4">
          <div className="flex items-start gap-3">
            <AvatarUpload size={64} editable={false} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                {(profile as any).accent_color ? (
                  <h1 className="text-2xl font-black truncate leading-tight" style={{ color: accentHex }}>{profile.username}</h1>
                ) : (
                  <h1 className="text-2xl font-black truncate leading-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400">{profile.username}</h1>
                )}
              </div>
              {memberSince && (
                <p className="text-[11px] font-bold mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Playing since {memberSince}</p>
              )}
              {(() => {
                const featuredDef = (profile as any).featured_achievement
                  ? ACHIEVEMENTS.find((a) => a.key === (profile as any).featured_achievement) : null;
                const featuredName = featuredDef?.name ?? null;
                const bioText = ((profile as any).bio as string | null)?.trim();
                const favMode = (profile as any).favorite_mode
                  ? PROFILE_MODES.find((m) => m.dbKey === (profile as any).favorite_mode) : null;
                if (!featuredName && !bioText && !favMode) return null;
                return (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {featuredName && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-2 py-0.5" style={{ ...softPill(accentHex, { bar: false }), color: accentHex }}>
                        <BadgeArt name={achievementBadge(featuredDef!.icon)} size={18} className="-my-1" /> {featuredName}
                      </span>
                    )}
                    {favMode && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5" style={{ ...softPill(favMode.accentColor, { bar: false }), color: favMode.accentColor }}>
                        <GameArt id={favMode.id} size={16} className="-my-1" fallback={favMode.icon ? <favMode.icon className="w-3 h-3" /> : null} /> {favMode.shortTitle}
                      </span>
                    )}
                    {bioText && <p className="text-xs font-bold w-full" style={{ color: 'var(--color-text-muted)' }}>{bioText}</p>}
                  </div>
                );
              })()}
            </div>
            {/* A8 / A3: Edit is a small round candy button; Share is the bare 3D share icon. */}
            <div className="flex items-center gap-0.5 shrink-0 -mt-1 -mr-2">
              <CandyButton
                onClick={() => setEditOpen(true)}
                aria-label="Edit profile"
                color="purple"
                size="round"
                icon={<Pencil className="w-4 h-4 candy-icon" color="#fff" strokeWidth={3} aria-hidden="true" />}
                style={{ ['--candy-h' as string]: '34px' } as React.CSSProperties}
              />
              <HeaderGlyph
                icon="share"
                label="Share profile card"
                onClick={() => {
                  const tw = profile.total_wins, tl = profile.total_losses;
                  void shareResult({
                    layout: 'profile', mode: 'Classic',
                    username: profile.username || 'Player',
                    level: (profile as any).level ?? 1,
                    tier: tierLabel,
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
              />
            </div>
          </div>

          {/* Level row spans the card: LVL · tier on the left, XP on the right, the gradient bar under. */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[12px] font-black tint-ink" style={{ color: '#5b3c96' }}>
              <LevelBadge level={profile.level ?? 1} size={34} numberSize={17} prefix="Lvl" tier />
              <span>{xpToNextLevel} XP to next</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden mt-1.5" style={{ background: alphaHex('#7c3aed', 0.14) }}>
              <div className="h-full rounded-full" style={{ width: `${levelProgress}%`, background: 'linear-gradient(90deg, #a855f7, #ec4899)' }} />
            </div>
          </div>

          {/* Footer row — only when something applies. */}
          {((profile as any).social_links || (profile as any).is_private || !isProActive || (profile as any).is_admin) && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3" style={{ borderTop: `1.5px dashed ${alphaHex('#7c3aed', 0.25)}` }}>
              <SocialLinksDisplay links={(profile as any).social_links as SocialLinks | null} />
              {(profile as any).is_private && (
                <CandyButton
                  onClick={() => setEditOpen(true)}
                  title="Your profile is private — other players see a limited card. Tap to change."
                  color="peach"
                  size="sm"
                  icon={<Lock className="w-3.5 h-3.5" aria-hidden="true" />}
                >
                  Private
                </CandyButton>
              )}
              {!isProActive && (
                <CandyLink href="/pro" color="amber" size="sm" className="ml-auto">Go Pro</CandyLink>
              )}
              {/* DEV-ONLY (profiles.is_admin): a quiet peach tool pill. */}
              {(profile as any).is_admin && (
                <CandyButton
                  onClick={async () => {
                    const newValue = !(profile as any).is_pro;
                    await (supabase as any).from('profiles').update({ is_pro: newValue }).eq('id', profile.id);
                    await refreshProfile();
                  }}
                  color="peach"
                  size="sm"
                  className="ml-auto"
                  title="Developer: toggle Pro on this account"
                  icon={<span className="w-1.5 h-1.5 rounded-full" style={{ background: (profile as any).is_pro ? WIN_FG : '#9ca3af' }} />}
                >
                  Dev · Pro {(profile as any).is_pro ? 'on' : 'off'}
                </CandyButton>
              )}
            </div>
          )}
          </div>
        </div>

        {/* ── The game picker (C3): the Leaderboard's window in the Stats blue. ── */}
        <StatsPicker
          view={selected}
          onSelect={setSelected}
          badges={badges}
          wordociousExtra={(() => {
            const done = DAILY_MODES.filter((m) => todayDailies.has(m.id)).length;
            return <SoftNum size={13} className="soft-num-auto" style={{ opacity: 0.85 }}>{done} / {DAILY_MODES.length} today</SoftNum>;
          })()}
        />
        </div>

        {/* ── ONE page below the picker, keyed per page. No fade+rise on a switch any
            more (was F1): the new page is simply there in the tap's frame (founder,
            2026-09-29 — Android dropped its page-swap fade, iOS likewise). ── */}
        <div
          key={`${selected}-${activeTab}`}
          className="space-y-4"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {selected === VIEW_TODAY && (
            <TodayCard
              sweepModes={DAILY_MODES}
              moreModes={visibleMore}
              todayDailies={todayDailies}
              vsDailyWon={vsDailyWon}
              standing={standing}
              sweepStreak={sweepStats?.currentSweepStreak ?? 0}
              flawlessStreak={sweepStats?.currentFlawlessStreak ?? 0}
              puzzleStreaks={puzzleRec ? { sweep: puzzleRec.sweep, flawless: puzzleRec.flawless } : undefined}
              flawlessFooter={<FlawlessBannerFooter total={DAILY_MODES.length} />}
              onJump={setSelected}
            />
          )}
          {selected === VIEW_TODAY && (
            <>
              {/* Founder (2026-09-26): the most recent games — daily AND unlimited — right on Today;
                  the full history stays on All-time. Same rows, same stats. */}
              <SectionHeader label="Today's Games" accent="#2563eb" />
              {/* Founder, 2026-09-27: every game played TODAY (daily and unlimited), no cap, no "See all" — the full history lives on All-time. */}
              <RecentMatchesList matches={todaysMatches} opponentNames={opponentNames} profileId={profile.id} loading={loadingStats} limit={Number.MAX_SAFE_INTEGER} groupUnlimited emptyText={MASCOT_LINES.statsEmpty} emptyScene={PAGE_SCENES.stats} />
            </>
          )}

          {isGamePage && (() => {
            const meta = selectedMeta!;
            const accentColor = meta.accentHex;
            const today = todayDailies.get(selected);
            const href = dailyHref(selected) ?? '/';
            return (
              <>
                {/* Solo | VS toggle — only where the game has a live VS board (tinted segments). */}
                {hasVs(selected) && (
                  <TintSegment<'solo' | 'vs' | 'vs_cpu'>
                    options={[
                      { key: 'solo', label: 'Solo', icon: <User className="w-3.5 h-3.5" aria-hidden="true" /> },
                      { key: 'vs', label: 'VS', icon: <Swords className="w-3.5 h-3.5" aria-hidden="true" /> },
                    ]}
                    value={activeTab}
                    onChange={setActiveTab}
                    accent={accentColor}
                    ink={accentColor}
                    label="Solo or VS"
                  />
                )}
                {/* Today's result for this game on its own tint, with the candy door to play / open it. */}
                <div
                  className="flex items-center gap-3 pl-4 pr-2.5 py-2"
                  style={{ ...softPill(accentColor, { radius: 16 }), paddingTop: 10 }}
                >
                  <span className="text-[10px] font-black uppercase tracking-wider shrink-0 tint-ink" style={{ color: accentColor }}>Today</span>
                  <span className="text-xs font-extrabold flex-1 min-w-0 truncate" style={{ color: 'var(--color-text)' }}>
                    {today
                      ? `${today.won ? 'Won' : 'Lost'} · ${matchStat(selected, today.guesses)}${today.timeSeconds > 0 ? ` · ${formatDuration(today.timeSeconds)}` : ''} · ${today.score.toLocaleString()} pts`
                      : `Not played yet — play today's ${meta.title}`}
                  </span>
                  <CandyLink href={href} color={today ? 'peach' : 'purple'} size="sm" icon={today ? 'eye' : 'play'} className="shrink-0" aria-label={today ? `Open today's ${meta.title}` : `Play today's ${meta.title}`}>
                    {today ? 'Open' : 'Play'}
                  </CandyLink>
                </div>
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
                  statsLoading={loadingStats}
                  playType={activeTab === 'vs_cpu' ? 'solo' : activeTab}
                />
              </>
            );
          })()}

          {/* The Daily Sweep page (the picker's broom tile, C2b / C3): the sweep stats the
              page already had — today's run, the Daily Sweeps + Puzzles Sweeps records and the
              daily points trend with its sweep / flawless marks — plus the door to the Sweep board. */}
          {selected === VIEW_SWEEP && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <TintTile
                  accent="#f5a524"
                  ink="#a2560c"
                  icon={<Icon3D name="flame" size={20} />}
                  label={STAT_LABELS.sweepStreak}
                  value={sweepStats?.currentSweepStreak ?? 0}
                  sub={`${sweepStats?.sweepCount ?? 0} ${(sweepStats?.sweepCount ?? 0) === 1 ? 'sweep' : 'sweeps'} all-time`}
                />
                <TintTile
                  accent="#7c3aed"
                  ink="#6d28d9"
                  icon={<MedalArt medal="trophy" size={20} />}
                  label="Flawless streak"
                  value={sweepStats?.currentFlawlessStreak ?? 0}
                  sub={`best ${sweepStats?.bestFlawlessStreak ?? 0}`}
                />
              </div>
              <SectionHeader label="Daily Sweeps" accent="#4f46e5" right={<CandyLink href={`/daily?mode=${SWEEP_KEY}`} color="purple" size="sm" icon="trophy">Sweep board</CandyLink>} />
              <SweepRecordsCard sweep={yours.sweep} sweepRankToday={yours.sweepRankToday} sweepRankAllTime={yours.sweepRankAllTime} />
              <PuzzleSweepRecordsCard rec={puzzleRec ?? null} />
              {sweepPoints.length >= 2 && (
                <>
                  <SectionHeader label="Daily Points" accent="#ec4899" />
                  <ChartCard title="Points per day" hint="Last 30 days · ● sweep · ● flawless" tint="#ec4899">
                    <PointsChart points={sweepPoints} />
                  </ChartCard>
                </>
              )}
            </>
          )}

          {selected === VIEW_ALL && (
            <>
              {/* Lifetime headline stats (four colored tiles) + this-week strip */}
              <SectionHeader label="All-time" accent="#7c3aed" />
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
              <PuzzleSweepRecordsCard rec={puzzleRec ?? null} />
              <WordQuizRecordCard rec={quizRec ?? null} />
              {/* D3.3: settled weekly friends races. */}
              <WeeklyFinishesCard userId={profile.id} />
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
                    <KitCard tint="#7c3aed">
                      <div className="flex items-end justify-between gap-2">
                        {activity.map((a) => {
                          const d = new Date(a.day + 'T00:00:00Z');
                          const dow = d.toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' });
                          const heightPct = a.count === 0 ? 6 : 12 + (a.count / maxCount) * 88;
                          return (
                            <div key={a.day} className="flex-1 flex flex-col items-center gap-1">
                              <div className="w-full flex items-end justify-center" style={{ height: 72 }}>
                                <div
                                  className="w-full"
                                  style={{
                                    height: `${heightPct}%`,
                                    borderRadius: '8px 8px 4px 4px',
                                    background: a.count === 0 ? alphaHex('#7c3aed', 0.14) : 'linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)',
                                    transition: 'height 300ms ease-out',
                                  }}
                                  title={`${a.count} ${a.count === 1 ? 'game' : 'games'} · ${a.day}`}
                                />
                              </div>
                              <span className="text-[11px] font-black uppercase" style={{ color: 'var(--color-text-muted)' }}>{dow}</span>
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
                  <SectionHeader label="Solve Time Trend" accent="#0d9488" right={<span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Wordocious games</span>} />
                  <SolveTimeChart data={solveHistory} />
                </>
              )}

              {/* Daily points trend (sweep/flawless days marked). */}
              {sweepPoints.length >= 2 && (
                <>
                  <SectionHeader label="Daily Points" accent="#ec4899" />
                  <ChartCard title="Points per day" hint="Last 30 days · ● sweep · ● flawless" tint="#ec4899">
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
                  <KitCard tint="#06b6d4">
                    <div className="space-y-1.5">
                      {openers.map((o, i) => (
                        <div key={o.word} className="flex items-center gap-2.5 p-2" style={{ background: alphaHex('#06b6d4', i % 2 === 0 ? 0.1 : 0.04), borderRadius: '10px' }}>
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
                      tint="#f97316"
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
                                  className="w-full"
                                  style={{
                                    height: `${d.played === 0 ? 4 : 10 + rate * 90}%`,
                                    borderRadius: '8px 8px 4px 4px',
                                    background: d.played === 0 ? alphaHex('#7c3aed', 0.14) : best && d.dow === best.dow ? 'linear-gradient(180deg, #fbbf24, #f97316)' : 'linear-gradient(180deg, #a78bfa, #7c3aed)',
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
                  <div className="overflow-hidden" style={softCard('#7c3aed', { radius: 18 })}>
                  <div aria-hidden="true" style={cardBarStyle('#7c3aed')} />
                  <div className="p-4 space-y-2">
                    {insights.map((text, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#7c3aed' }} />
                        <p className="text-xs font-bold leading-snug" style={{ color: 'var(--color-text)' }}>{text}</p>
                      </div>
                    ))}
                  </div>
                  </div>
                </>
              )}

              {/* Signature (audit, 2026-09-26): best day, best week, comebacks, perfects — free. */}
              <SectionHeader label="Signature" accent="#f97316" />
              <SignatureCard userId={profile.id} />

              {/* Standing trend — your Top X% per day over 30 days (Pro). */}
              <SectionHeader label="Standing Trend" accent="#7c3aed" />
              <StandingTrendCard userId={profile.id} isPro={isProActive} />

              {/* Pro Stats (global view) */}
              <ProStats userId={profile.id} isPro={isProActive} />

              {/* Skill Radar — the five-axis signature chart (Pro). */}
              <SkillRadarCard userId={profile.id} isPro={isProActive} />

              {/* ── Progression: medals + achievements under one banner ── */}
              <SectionHeader label="Progression" accent="#f59e0b" />

              {/* Daily Medals — on gold, each medal count a soft number on its own tint. */}
              <KitCard accent="#f5a524">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black" style={{ color: 'var(--color-text)' }}>Daily Medals</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {[
                    { icon: GoldMedal, count: (profile as any).gold_medals || 0, label: 'Gold', color: '#d97706', tint: '#f5a524' },
                    { icon: SilverMedal, count: (profile as any).silver_medals || 0, label: 'Silver', color: '#64748b', tint: '#94a3b8' },
                    { icon: BronzeMedal, count: (profile as any).bronze_medals || 0, label: 'Bronze', color: '#b45309', tint: '#d97706' },
                  ].map((m, i) => {
                    const MIcon = m.icon;
                    return (
                      <div key={i} className="text-center p-3" style={softPill(m.tint, { radius: 14 })}>
                        <MIcon className="w-8 h-8 mx-auto mb-1" style={{ color: m.color }} />
                        <SoftNum size={22} as="div" className="soft-num-auto">{m.count}</SoftNum>
                        <div className="text-[10px] font-extrabold" style={{ color: 'var(--color-text-muted)' }}>{m.label}</div>
                      </div>
                    );
                  })}
                </div>
                {medals.length > 0 ? (
                  <>
                    <div className={`space-y-1.5 ${showAllMedals ? 'max-h-80 overflow-y-auto pr-1' : ''}`}>
                      {(showAllMedals ? medals : medals.slice(0, 5)).map((medal: MedalType) => {
                        const medalConfig: Record<string, { icon: IconLike; color: string; label: string }> = {
                          gold: { icon: GoldMedal, color: '#d97706', label: '1st' },
                          silver: { icon: SilverMedal, color: 'var(--color-text-muted)', label: '2nd' },
                          bronze: { icon: BronzeMedal, color: '#b45309', label: '3rd' },
                          streak_7: { icon: Flame3D, color: '#ea580c', label: '7-Day Streak' },
                          streak_30: { icon: Flame3D, color: '#dc2626', label: '30-Day Streak' },
                          streak_100: { icon: Flame3D, color: '#7c3aed', label: '100-Day Streak' },
                          perfect: { icon: Star, color: WIN_FG, label: 'Perfect' },
                        };
                        const cfg = medalConfig[medal.medal_type] || { icon: Medal, color: 'var(--color-text-muted)', label: medal.medal_type };
                        const MedalIcon = cfg.icon;
                        return (
                          <div key={medal.id} className="flex items-center gap-2.5 p-2.5" style={{ background: alphaHex('#f5a524', 0.1), border: softBorder('#f5a524', 0.1, 1), borderRadius: '10px' }}>
                            <MedalIcon className="w-5 h-5" style={{ color: cfg.color }} fill={cfg.icon === Flame3D || cfg.icon === Star ? 'currentColor' : 'none'} />
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
                      <div className="flex justify-center mt-2.5">
                        <CandyButton onClick={() => setShowAllMedals((v) => !v)} color="peach" size="sm" aria-expanded={showAllMedals}>
                          {showAllMedals ? 'Show less' : `View all ${medals.length} medals`}
                        </CandyButton>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-center text-xs font-bold py-3" style={{ color: 'var(--color-text-muted)' }}>Play daily challenges to earn medals!</p>
                )}
              </KitCard>

              {/* Achievements (grouped by category, under the Progression banner) */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black" style={{ color: 'var(--color-text)' }}>Achievements</span>
                <span className="px-2 py-0.5" style={softPill('#7c3aed', { bar: false })}><SoftNum size={12} className="soft-num-auto">{userAchievements.size} / {ACHIEVEMENTS.length}</SoftNum></span>
              </div>
              <AchievementGrid
                unlocked={achievementDates}
                progress={(a) => achievementProgress(a.key, {
                  dailyStreak: profile.daily_login_streak,
                  winStreak: (profile as any).current_streak,
                  level: profile.level,
                  totalWins: profile.total_wins,
                  totalLosses: profile.total_losses,
                  gold: (profile as any).gold_medals,
                  silver: (profile as any).silver_medals,
                  bronze: (profile as any).bronze_medals,
                })}
              />

              {/* VS (founder, 2026-10-01): VS left the game strip (rarely played; the grid now
                  comes out even). Its record, Rivalries, Bots practice and per-game boards live here.
                  The People and Bots sums here are the VS banner's RECORD row (VS overhaul §10). */}
              <div id="vs-section" style={{ scrollMarginTop: 12 }}><SectionHeader label="VS" accent="#ec4899" /></div>
              {/* VS RECORD summary card */}
              <div className="overflow-hidden" style={softCard('#ec4899', { radius: 18 })}>
              <div aria-hidden="true" style={{ height: 10, background: 'linear-gradient(90deg, #7c3aed, #ec4899)' }} />
              <div className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={softPill('#ec4899', { radius: 12 })}>
                  <Swords className="w-5 h-5" style={{ color: '#db2777' }} />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider tint-ink" style={{ color: '#a0336b' }}>VS Record</div>
                  <SoftNum size={24} as="div" className="soft-num-auto">
                    {vsRecord.wins}–{vsRecord.losses}
                  </SoftNum>
                  <div className="text-[10px] font-extrabold" style={{ color: vsDailyWon === null ? 'var(--color-text-muted)' : vsDailyWon ? WIN_FG : '#dc2626' }}>
                    Today: {vsDailyWon === null ? 'not played' : vsDailyWon ? 'won' : 'lost'}
                  </div>
                </div>
                <div className="text-right">
                  <SoftNum size={24} as="div" className="soft-num-auto">{vsRecord.winRate}%</SoftNum>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                    Win rate · {vsRecord.total} {vsRecord.total === 1 ? 'match' : 'matches'}
                  </div>
                </div>
              </div>
              </div>

              {/* Rivalries — most-faced opponents with head-to-head bars (Pro). */}
              {vsRecord.total > 0 && <RivalriesCard userId={profile.id} isPro={isProActive} />}

              {/* vs Bots record — unranked practice: no leaderboard, no XP, no streak. */}
              <div className="p-4 flex items-center gap-4" style={softCard('#0d9488', { radius: 18 })}>
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={softPill('#0d9488', { radius: 12 })}>
                  <Bot className="w-5 h-5" style={{ color: '#0d9488' }} />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider tint-ink" style={{ color: '#0f766e' }}>vs Bots</div>
                  <SoftNum size={24} as="div" className="soft-num-auto">
                    {cpuRecord.wins}–{cpuRecord.losses}
                  </SoftNum>
                  {cpuRecord.total === 0 ? (
                    <div className="text-[10px] font-extrabold" style={{ color: 'var(--color-text-muted)' }}>Beat a bot to start your record</div>
                  ) : cpuBestStreak > 0 && (
                    <div className="text-[10px] font-extrabold flex items-center gap-1" style={{ color: '#f97316' }}><Icon3D name="flame" size={14} /> Best streak: {cpuBestStreak}</div>
                  )}
                </div>
                <div className="text-right">
                  <SoftNum size={24} as="div" className="soft-num-auto">{cpuRecord.total === 0 ? '—' : `${cpuRecord.winRate}%`}</SoftNum>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                    {cpuRecord.total === 0 ? 'No games yet' : `Win rate · ${cpuRecord.total} ${cpuRecord.total === 1 ? 'match' : 'matches'}`}
                  </div>
                </div>
              </div>

              {/* Per-game VS board: pick the word game, People or Bots. */}
              <div className="flex items-center gap-2">
                {/* Square game tiles (docs/GAME_TILE_STYLE.md) at 56 px. */}
                <div className="flex-1 flex gap-1.5 overflow-x-auto py-1.5 -my-1.5 px-1 -mx-1" style={{ scrollbarWidth: 'none' }}>
                  {vsModes.map((m) => {
                    const active = vsMode === m.dbKey;
                    return (
                      <GameSquare
                        key={m.id}
                        accent={m.accentHex}
                        selected={active}
                        size={56}
                        glyph={<GameTileGlyph accent={m.accentHex} icon={MODE_CHROME[m.id]?.icon} romanNumeral={m.romanNumeral} />}
                        label={m.shortTitle}
                        aria-label={m.title}
                        aria-pressed={active}
                        onClick={() => setVsMode(m.dbKey as string)}
                      />
                    );
                  })}
                </div>
                <TintSegment<'vs' | 'vs_cpu'>
                  options={[{ key: 'vs', label: 'People' }, { key: 'vs_cpu', label: 'Bots' }]}
                  value={vsTab}
                  onChange={setVsTab}
                  accent="#7c3aed"
                  ink="#6d28d9"
                  label="People or Bots"
                  size="sm"
                  className="shrink-0"
                />
              </div>
              <ModeDetailPanel
                userId={profile.id}
                gameMode={vsMode}
                isPro={isProActive}
                stats={(() => {
                  const pt = vsTab;
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
                statsLoading={loadingStats}
                playType={vsTab}
              />

              {/* ── Recent Matches (every game, newest first) ── */}
              <SectionHeader label="Recent Matches" accent="#2563eb" />
              <RecentMatchesList matches={matches} opponentNames={opponentNames} profileId={profile.id} loading={loadingStats} limit={5} />
            </>
          )}
        </div>{/* /page */}
        </div>{/* /page-grid-2 */}
      </div>

      <BottomNav />
      <ProfileEditModal open={editOpen} onClose={() => setEditOpen(false)} />
    </PageBackground>
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
          <MedalArt medal="trophy" size={18} inline /> <SoftNum size={15} className="soft-num-auto">{streak}</SoftNum>-DAY FLAWLESS STREAK
        </div>
      )}
      <div className="flex items-center justify-center gap-1.5 mt-0.5">
        <span className="text-[11px] font-extrabold" style={{ color: '#b45309' }}>
          All {total} dailies won today · +600 XP earned
        </span>
        {streak >= 1 && (
          <HeaderGlyph icon="share" label="Share flawless streak" onClick={share} disabled={sharing} size={20} style={{ opacity: sharing ? 0.4 : 1, minHeight: 36 }} />
        )}
      </div>
    </div>
  );
}
