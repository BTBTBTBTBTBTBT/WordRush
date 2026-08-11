'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Clock, Medal, Crown, Users, Calendar, ChevronDown, ChevronUp, Trophy, Play, Share, Bell } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { formatScore, tieAwareScoreLabels } from '@/lib/composite-scoring';
import { formatShortTime as formatTime } from '@/lib/format';
import { AuthModal } from '@/components/auth/auth-modal';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ModeLimitModal } from '@/components/modals/mode-limit-modal';
import { ModePicker, PROFILE_MODES, SWEEP_MODE } from '@/components/profile/mode-picker';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { RankDeltaBadge } from '@/components/ui/rank-delta';
import {
  fetchDailyLeaderboard,
  fetchRankWindow,
  fetchDailySweepLeaderboard,
  getUserDailyRank,
  getUserSweepRank,
  getDailyPlayerCount,
  getSecondsUntilMidnightLocal,
  getTodayLocal,
  getYesterdayLocal,
  formatHintsLabel,
  type LeaderboardEntry,
  type SweepEntry,
} from '@/lib/daily-service';
import { hasPlayedModeToday } from '@/lib/play-limit-service';
import { fetchBlockedIds, isBlocked } from '@/lib/moderation-service';
import {
  loadFriends,
  getFriendIds,
  getFriends,
  onFriendsChange,
  sendTaunt,
  type FriendProfile,
} from '@/lib/friends-service';
import { FRIEND_TAUNTS } from '@/lib/friends-taunts';
import { shareDailyLeaderboardCard, shareYesterdayPodiumCard } from '@/lib/leaderboard-share-flow';
import { CompletedDailyBoard } from '@/components/game/completed-daily-board';

const getMode = (dbKey: string) => (dbKey === 'SWEEP' ? SWEEP_MODE : PROFILE_MODES.find((m) => m.dbKey === dbKey)!);

// Session-lived stale-while-revalidate cache, keyed mode:day:user. A mode-chip
// tap or a return visit paints the last-known rows instantly while the fresh
// fetch swaps in silently — the skeleton only ever shows on a true first load.
const lbCache = new Map<string, {
  lb: LeaderboardEntry[];
  count: number;
  rank: { rank: number; totalPlayers: number } | null;
  // "Your neighborhood" rows when the user ranks past the top-50 list.
  win: { startRank: number; entries: LeaderboardEntry[] } | null;
}>();

// Same stale-while-revalidate cache for the synthetic Sweep board, keyed
// day:user (no per-mode dimension — Sweep is cross-mode).
const sweepCache = new Map<string, {
  lb: SweepEntry[];
  count: number;
  rank: { rank: number; totalPlayers: number } | null;
}>();



function CountdownTimer() {
  const [secondsLeft, setSecondsLeft] = useState(getSecondsUntilMidnightLocal());

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(getSecondsUntilMidnightLocal());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft % 60;

  return (
    <span className="font-mono text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
      <Clock className="w-3 h-3 inline mr-1" />
      {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
    </span>
  );
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-5 h-5" style={{ color: '#d97706' }} />;
  if (rank === 2) return <Medal className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />;
  if (rank === 3) return <Medal className="w-5 h-5" style={{ color: '#b45309' }} />;
  return <span className="text-xs font-black w-5 text-center" style={{ color: 'var(--color-text-muted)' }}>{rank}</span>;
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-0">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
          <div className="w-5 h-5 rounded-full" style={{ background: 'var(--color-border)' }} />
          <div className="flex-1 h-3 rounded" style={{ background: 'var(--color-border)' }} />
          <div className="w-12 h-3 rounded" style={{ background: 'var(--color-border)' }} />
        </div>
      ))}
    </div>
  );
}

export default function DailyPage() {
  const { user, isProActive } = useAuth();
  const router = useRouter();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState('DUEL');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [sweepLeaderboard, setSweepLeaderboard] = useState<SweepEntry[]>([]);
  const [userRank, setUserRank] = useState<{ rank: number; totalPlayers: number } | null>(null);
  const [rankWindow, setRankWindow] = useState<{ startRank: number; entries: LeaderboardEntry[] } | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showYesterday, setShowYesterday] = useState(false);
  const [yesterdayLeaderboard, setYesterdayLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [yesterdaySweep, setYesterdaySweep] = useState<SweepEntry[]>([]);

  const isPro = isProActive;

  // `today` must be derived on the client, not at SSR time. Next.js
  // renders the initial HTML on Vercel's UTC servers — if we computed
  // getTodayLocal() at module top-level, a user whose local day differs
  // from Vercel's UTC day would see the wrong day baked into the SSR HTML.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    setToday(getTodayLocal());
  }, []);

  // Load the signed-in user's block list (session-cached) so blocked users'
  // rows can be filtered out of the leaderboard render below. The state bump
  // just forces a re-render once the list arrives.
  const [, setBlockedLoaded] = useState(false);
  useEffect(() => {
    if (user) fetchBlockedIds(user.id).then(() => setBlockedLoaded(true));
  }, [user]);

  // FRIENDS (§207): the All|Friends toggle. Friends boards are the same
  // query restricted to friends∪me, dense-ranked #1..N — plus grayed "ghost"
  // rows for friends who haven't played this mode today (taunt bell lives
  // there). friendsVersion bumps when the session cache changes so ghost
  // rows and the toggle react without a page reload.
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [friendsVersion, setFriendsVersion] = useState(0);
  useEffect(() => {
    if (!user) {
      setFriendsOnly(false);
      return;
    }
    loadFriends().then(() => setFriendsVersion((v) => v + 1));
    return onFriendsChange(() => setFriendsVersion((v) => v + 1));
  }, [user]);

  // Canned-taunt picker (fixed phrases only — §207's no-free-text rule).
  const [tauntTarget, setTauntTarget] = useState<FriendProfile | null>(null);
  const [tauntStatus, setTauntStatus] = useState<string | null>(null);
  const fireTaunt = async (tauntId: string) => {
    if (!tauntTarget) return;
    const r = await sendTaunt(tauntTarget.id, tauntId);
    setTauntStatus(r.sent ? 'Sent 😈' : r.alreadySent ? 'Already taunted them today' : 'Could not send');
    setTimeout(() => {
      setTauntTarget(null);
      setTauntStatus(null);
    }, 1400);
  };
  const yesterday = useMemo(() => getYesterdayLocal(), []);
  // Drops late responses from a previous mode so a slow fetch can't overwrite
  // the rows of the mode the user has since switched to.
  const loadSeq = useRef(0);

  const loadLeaderboard = useCallback(async () => {
    // The fetch keys off the local date directly — the `today` state only
    // gates the SSR-rendered date display, and waiting for its post-hydration
    // effect delayed the first request by a render cycle.
    const day = getTodayLocal();
    const seq = ++loadSeq.current;

    // Synthetic Sweep board — cross-mode ranking, different RPCs and row shape.
    if (selectedMode === 'SWEEP') {
      const sweepKey = `SWEEP:${day}:${user?.id ?? 'anon'}`;
      const cachedSweep = sweepCache.get(sweepKey);
      if (cachedSweep) {
        setSweepLeaderboard(cachedSweep.lb);
        setPlayerCount(cachedSweep.count);
        setUserRank(cachedSweep.rank);
        setRankWindow(null);
        setLoading(false);
      } else {
        setLoading(true);
        setUserRank(null);
        setRankWindow(null);
        setSweepLeaderboard([]);
      }

      const lb = await fetchDailySweepLeaderboard(day, 50);
      if (seq !== loadSeq.current) return;
      setSweepLeaderboard(lb);
      setLoading(false);

      let rank: { rank: number; totalPlayers: number } | null = null;
      if (user) {
        rank = await getUserSweepRank(user.id, day);
        if (seq === loadSeq.current) setUserRank(rank);
      }
      // No dedicated count RPC — the rank query yields the true total when the
      // user swept; otherwise the (≤50) board length is the best estimate.
      const count = rank?.totalPlayers ?? lb.length;
      if (seq === loadSeq.current) setPlayerCount(count);
      sweepCache.set(sweepKey, { lb, count, rank });
      return;
    }

    const friends = friendsOnly && !!user;
    const cacheKey = `${selectedMode}:${day}:${user?.id ?? 'anon'}${friends ? ':friends' : ''}`;
    const cached = lbCache.get(cacheKey);
    if (cached) {
      setLeaderboard(cached.lb);
      setPlayerCount(cached.count);
      setUserRank(cached.rank);
      setRankWindow(cached.win);
      setLoading(false);
    } else {
      setLoading(true);
      setUserRank(null);
      setRankWindow(null);
      setLeaderboard([]);
    }

    // Friends board: same query restricted to friends∪me. The whole board
    // fits in one fetch (it's your friends list), so rank is just the dense
    // index — no rank query, no neighborhood window.
    if (friends) {
      const ids = [...new Set([...getFriendIds(), user!.id])];
      const lb = await fetchDailyLeaderboard(selectedMode, 'solo', day, 50, 0, ids);
      if (seq !== loadSeq.current) return;
      setLeaderboard(lb);
      setPlayerCount(lb.length);
      setLoading(false);
      const idx = lb.findIndex((e) => e.user_id === user!.id);
      const rank = idx >= 0 ? { rank: idx + 1, totalPlayers: lb.length } : null;
      setUserRank(rank);
      setRankWindow(null);
      lbCache.set(cacheKey, { lb, count: lb.length, rank, win: null });
      return;
    }

    const [lb, count] = await Promise.all([
      fetchDailyLeaderboard(selectedMode, 'solo', day, 50),
      getDailyPlayerCount(selectedMode, day),
    ]);
    if (seq !== loadSeq.current) return;
    // Paint the rows the moment they arrive — the rank banner fills in on its
    // own instead of holding the whole list behind its extra queries.
    setLeaderboard(lb);
    setPlayerCount(count);
    setLoading(false);

    let rank: { rank: number; totalPlayers: number } | null = null;
    let win: { startRank: number; entries: LeaderboardEntry[] } | null = null;
    if (user) {
      rank = await getUserDailyRank(user.id, selectedMode, 'solo', day, lb, 50);
      if (seq === loadSeq.current) setUserRank(rank);
      // Ranked past the visible list → also show the rows around them.
      if (rank && rank.rank > 50) {
        win = await fetchRankWindow(selectedMode, 'solo', rank.rank, day);
      }
      if (seq === loadSeq.current) setRankWindow(win);
    }
    lbCache.set(cacheKey, { lb, count, rank, win });
  }, [selectedMode, user, friendsOnly, friendsVersion]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    if (!showYesterday) return;
    if (selectedMode === 'SWEEP') {
      fetchDailySweepLeaderboard(yesterday, 5).then(setYesterdaySweep);
    } else {
      // Friends toggle carries into Yesterday's Winners: podium among friends.
      const ids = friendsOnly && user ? [...new Set([...getFriendIds(), user.id])] : undefined;
      fetchDailyLeaderboard(selectedMode, 'solo', yesterday, 5, 0, ids).then(setYesterdayLeaderboard);
    }
  }, [showYesterday, selectedMode, yesterday, friendsOnly, friendsVersion, user]);

  const mode = getMode(selectedMode);
  const color = mode.accentColor;
  const Icon = mode.icon;
  // URL slugs that differ from internal mode ids (mark scrub 2026-08-11):
  // routes wear the display-name slug; ids stay put (they key play limits,
  // saves, and the shared catalog).
  const modeHref = `/${({ quordle: 'quadword', octordle: 'octoword' } as Record<string, string>)[mode.id] ?? mode.id}`;
  const playLimitKey = mode.id;

  // TIE-AWARE score display: stored scores are fractional (speed carries the
  // decimals) but rows show whole numbers — so when two rows on the same board
  // land on one whole number, exactly those rows render the decimals that rank
  // them (2,328.8 over 2,328.0 instead of a phantom tie). One map per board.
  const lbScoreLabels = tieAwareScoreLabels([
    ...leaderboard.map((e) => e.composite_score),
    ...(rankWindow?.entries.map((e) => e.composite_score) ?? []),
  ]);
  const sweepScoreLabels = tieAwareScoreLabels(sweepLeaderboard.map((e) => e.total_score));
  const yLbScoreLabels = tieAwareScoreLabels(yesterdayLeaderboard.map((e) => e.composite_score));
  const ySweepScoreLabels = tieAwareScoreLabels(yesterdaySweep.map((e) => e.total_score));

  // §212: photo → emoji → initial, left of every username — the boards
  // wear faces, not just names.
  const lbAvatar = (avatarUrl: string | null, avatarEmoji: string | null | undefined, username: string) =>
    avatarUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
    ) : (
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
        style={{ background: '#7c3aed22', color: '#7c3aed' }}
      >
        {avatarEmoji?.trim() || username.charAt(0).toUpperCase()}
      </div>
    );

  // One row of the leaderboard — shared by the top-50 list and the
  // "your neighborhood" rank window so they can never drift apart visually.
  const renderLbRow = (entry: LeaderboardEntry, rank: number, scoreLabels = lbScoreLabels) => {
    const isCurrentUser = user && entry.user_id === user.id;
    return (
      <div
        key={entry.user_id}
        className="flex items-center gap-3 px-4 py-3"
        style={{
          background: isCurrentUser ? 'var(--color-highlight-gold)' : rank <= 3 ? 'var(--color-surface-alt)' : 'transparent',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <RankIcon rank={rank} />
        {lbAvatar(entry.avatar_url, entry.avatar_emoji, entry.username)}
        <div className="flex-1 min-w-0">
          <Link
            href={`/profile/${entry.user_id}`}
            className="text-xs font-extrabold truncate block hover:opacity-80 transition-opacity"
            style={{ color: 'var(--color-text)' }}
          >
            {entry.username}
            {isCurrentUser && <span style={{ color: '#d97706' }}> (you)</span>}
          </Link>
        </div>
        <div className="text-right">
          <div className="font-black text-xs" style={{ color: 'var(--color-text)' }}>{scoreLabels.get(entry.composite_score) ?? formatScore(entry.composite_score)}</div>
          <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
            <span>
              {entry.guess_count} Guesses · {formatTime(entry.time_seconds)}
              {entry.total_boards > 1 && ` · ${entry.boards_solved}/${entry.total_boards}`}
              {(() => {
                const h = formatHintsLabel(selectedMode, entry.hints_used);
                return h ? ` · ${h}` : '';
              })()}
            </span>
            <span
              className="text-[9px] font-extrabold px-1.5 py-0.5 rounded"
              style={{
                background: entry.completed ? 'var(--color-win-bg)' : 'var(--color-loss-bg)',
                color: entry.completed ? 'var(--color-win-text)' : 'var(--color-loss-text)',
              }}
            >
              {entry.completed ? 'Win' : 'Loss'}
            </span>
          </div>
        </div>
        {/* Friends board: one-tap canned taunt on any friend's row (§207). */}
        {friendsOnly && user && !isCurrentUser && (
          <button
            onClick={() =>
              setTauntTarget({ id: entry.user_id, username: entry.username, avatar_url: entry.avatar_url, level: 0 })
            }
            aria-label={`Taunt ${entry.username}`}
            className="p-1 -mr-1 active:scale-95 transition-transform"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Bell className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  // FRIENDS ghost row — a friend who hasn't played this mode today, in the
  // standard row shell at muted opacity. The taunt bell is the whole point:
  // peer pressure as a game mechanic.
  const renderGhostRow = (f: FriendProfile) => (
    <div
      key={`ghost-${f.id}`}
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: '1px solid var(--color-border)', opacity: 0.55 }}
    >
      <span className="text-xs font-black w-5 text-center" style={{ color: 'var(--color-text-muted)' }}>–</span>
      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${f.id}`}
          className="text-xs font-extrabold truncate block hover:opacity-80 transition-opacity"
          style={{ color: 'var(--color-text)' }}
        >
          {f.username}
        </Link>
        <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
          Hasn&apos;t played yet
        </div>
      </div>
      <button
        onClick={() => setTauntTarget(f)}
        aria-label={`Nudge ${f.username}`}
        className="p-1 -mr-1 active:scale-95 transition-transform"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <Bell className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  // One row of the Sweep board — same shell + RankIcon as renderLbRow, but the
  // three stats are total score · total time · modes-won, and the Win/Loss pill
  // becomes a GOLD "FLAWLESS" (won all 9) vs VIOLET "SWEEP" (completed all 9).
  const renderSweepRow = (entry: SweepEntry, rank: number) => {
    const isCurrentUser = user && entry.user_id === user.id;
    const pillColor = entry.is_flawless ? '#d97706' : '#a78bfa';
    return (
      <div
        key={entry.user_id}
        className="flex items-center gap-3 px-4 py-3"
        style={{
          background: isCurrentUser ? 'var(--color-highlight-gold)' : rank <= 3 ? 'var(--color-surface-alt)' : 'transparent',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <RankIcon rank={rank} />
        {lbAvatar(entry.avatar_url, null, entry.username)}
        <div className="flex-1 min-w-0">
          <Link
            href={`/profile/${entry.user_id}`}
            className="text-xs font-extrabold truncate block hover:opacity-80 transition-opacity"
            style={{ color: 'var(--color-text)' }}
          >
            {entry.username}
            {isCurrentUser && <span style={{ color: '#d97706' }}> (you)</span>}
          </Link>
        </div>
        <div className="text-right">
          <div className="font-black text-xs" style={{ color: 'var(--color-text)' }}>{sweepScoreLabels.get(entry.total_score) ?? formatScore(entry.total_score)}</div>
          <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
            <span>{formatTime(entry.total_time)} · {entry.modes_won}/9</span>
            <span
              className="text-[9px] font-extrabold px-1.5 py-0.5 rounded"
              style={{ background: `${pillColor}22`, color: pillColor }}
            >
              {entry.is_flawless ? 'FLAWLESS' : 'SWEEP'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const isSweep = selectedMode === 'SWEEP';

  // Friends who haven't played this mode today — the ghost rows.
  const ghostFriends = useMemo(() => {
    if (!friendsOnly || !user || isSweep) return [];
    void friendsVersion; // re-derive when the friends cache changes
    return getFriends().filter(
      (f) => !leaderboard.some((e) => e.user_id === f.id) && !isBlocked(f.id),
    );
  }, [friendsOnly, user, isSweep, leaderboard, friendsVersion]);

  // ── LEADERBOARD SHARE — today's board card + yesterday's podium card.
  // Single-tap, spoiler-free by construction (names/scores/stats only), so no
  // variant chooser. Sweep has no card design — its buttons stay hidden.
  const [sharingLb, setSharingLb] = useState(false);
  const [sharingPodium, setSharingPodium] = useState(false);

  const handleShareLeaderboard = async () => {
    if (sharingLb || loading || isSweep) return;
    setSharingLb(true);
    try {
      // The sharer's row when the page already holds it — the top-50 list or
      // the "your neighborhood" rank window; the flow fetches it otherwise.
      const userEntry = user
        ? leaderboard.find((e) => e.user_id === user.id)
          ?? rankWindow?.entries.find((e) => e.user_id === user.id)
          ?? null
        : null;
      await shareDailyLeaderboardCard({
        dbMode: selectedMode,
        playType: 'solo',
        day: getTodayLocal(),
        yesterday,
        ranked: leaderboard
          .map((entry, index) => ({ entry, rank: index + 1 }))
          .filter(({ entry }) => !isBlocked(entry.user_id)),
        userId: user?.id ?? null,
        userRank,
        userEntry,
        friendIds: friendsOnly && user ? [...getFriendIds()] : undefined,
      });
    } finally {
      setSharingLb(false);
    }
  };

  const handleSharePodium = async () => {
    if (sharingPodium || isSweep) return;
    setSharingPodium(true);
    try {
      await shareYesterdayPodiumCard({
        dbMode: selectedMode,
        playType: 'solo',
        day: yesterday,
        ranked: yesterdayLeaderboard
          .map((entry, index) => ({ entry, rank: index + 1 }))
          .filter(({ entry }) => !isBlocked(entry.user_id)),
        userId: user?.id ?? null,
        friends: friendsOnly && !!user,
      });
    } finally {
      setSharingPodium(false);
    }
  };

  const handlePlayDaily = () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (!isPro && hasPlayedModeToday(playLimitKey)) {
      setLimitModalOpen(true);
      return;
    }
    router.push(`${modeHref}?daily=true`);
  };

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--color-bg)' }}>
      <AppHeader />

      <div className="max-w-lg mx-auto px-4">
        {/* Title */}
        <div className="text-center mb-4">
          <h1
            className="text-3xl font-black bg-clip-text text-transparent tracking-tight"
            style={{
              backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)',
            }}
          >
            DAILY CHALLENGE
          </h1>
          <div className="flex items-center justify-center gap-3 mt-1">
            <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
              <Calendar className="w-3 h-3 inline mr-1" />
              {today && new Date(today + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <CountdownTimer />
          </div>
        </div>

        {/* Mode Picker */}
        <div className="mb-4">
          <ModePicker
            grid
            includeSweep
            showAll={false}
            selectedMode={selectedMode}
            onSelectMode={(m) => setSelectedMode(m || 'DUEL')}
          />
        </div>

        {/* Play CTA Card */}
        <div
          className="overflow-hidden mb-4"
          style={{
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            borderRadius: '16px',
          }}
        >
          {/* Mode accent bar */}
          <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />

          <div className="px-4 pt-3 pb-3">
            {/* Mode header + Play button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}15` }}
                >
                  {mode.romanNumeral ? (
                    <span className="text-[11px] font-black leading-none" style={{ color }}>{mode.romanNumeral}</span>
                  ) : Icon ? (
                    <Icon className="w-4 h-4" style={{ color }} />
                  ) : null}
                </div>
                <div>
                  <div className="font-black text-sm" style={{ color: 'var(--color-text)' }}>
                    {mode.title}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                    <Users className="w-3 h-3" />
                    <span>
                      {isSweep
                        ? `${playerCount} swept today`
                        : `${playerCount} player${playerCount !== 1 ? 's' : ''} today`}
                    </span>
                  </div>
                </div>
              </div>
              {/* Sweep isn't a playable puzzle — it's a cross-mode ranking, so
                  no Play button (just complete the 9 dailies to appear here). */}
              {!isSweep && (
                <button
                  onClick={handlePlayDaily}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-white font-black text-xs active:scale-95 transition-transform"
                  style={{ background: color }}
                >
                  <Play className="w-3.5 h-3.5" fill="currentColor" />
                  Play
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Completed Board Preview (per-mode only — Sweep has no board) */}
        {!isSweep && <CompletedDailyBoard modeId={selectedMode} />}

        {/* User Rank */}
        {userRank && (
          <div
            className="text-center p-3 mb-4"
            style={{
              background: `linear-gradient(135deg, var(--color-highlight-gold), var(--color-surface))`,
              border: '1.5px solid var(--color-gold-border)',
              borderRadius: '16px',
            }}
          >
            <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>You're ranked </span>
            <span className="font-black text-lg" style={{ color: '#d97706' }}>#{userRank.rank}</span>
            <RankDeltaBadge
              mode={selectedMode}
              playType="solo"
              pageKey={friendsOnly ? 'daily-friends' : 'daily'}
              currentRank={userRank.rank}
            />
            <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
              {' '}of {userRank.totalPlayers}{friendsOnly && !isSweep ? ' friends' : ''}
            </span>
          </div>
        )}

        {/* Leaderboard — the caption is founder-approved clarity: this board
            ranks DAILY games only, so an Unlimited session never shows here. */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Leaderboard
          </div>
          <div className="flex items-center gap-2">
            {/* FRIENDS toggle — the records-page segmented control, compact. */}
            {!isSweep && user && (
              <div
                className="flex rounded-lg overflow-hidden"
                style={{ border: '1.5px solid var(--color-border)' }}
              >
                {([false, true] as const).map((f) => (
                  <button
                    key={String(f)}
                    onClick={() => setFriendsOnly(f)}
                    className="px-2 py-0.5 text-[10px] font-extrabold transition-all"
                    style={{
                      background: friendsOnly === f ? `${color}15` : 'var(--color-surface)',
                      color: friendsOnly === f ? color : 'var(--color-text-muted)',
                    }}
                  >
                    {f ? 'Friends' : 'All'}
                  </button>
                ))}
              </div>
            )}
            <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
              Daily games only
            </div>
            {!isSweep && !loading && leaderboard.length > 0 && (
              <button
                onClick={handleShareLeaderboard}
                disabled={sharingLb}
                aria-label="Share leaderboard"
                className="p-1 -my-1 active:scale-95 transition-transform"
                style={{ color: 'var(--color-text-muted)', opacity: sharingLb ? 0.4 : 1 }}
              >
                <Share className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <PullToRefresh onRefresh={loadLeaderboard} accentColor={color}>
        <div
          className="overflow-hidden"
          style={{
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            borderRadius: '16px',
          }}
        >
          {loading ? (
            <LeaderboardSkeleton />
          ) : isSweep ? (
            sweepLeaderboard.length === 0 ? (
              <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
                <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-bold">Nobody&apos;s swept today. Be the first!</p>
              </div>
            ) : (
              // Blocked users are already filtered by the service; the RPC's
              // rank field is authoritative (handles ties), so use it directly.
              <div>{sweepLeaderboard.map((entry) => renderSweepRow(entry, entry.rank))}</div>
            )
          ) : leaderboard.length === 0 ? (
            friendsOnly && ghostFriends.length > 0 ? (
              // Nobody's played yet, but the friends list still renders as
              // ghost rows — the board should feel alive (and tauntable).
              <div>{ghostFriends.map(renderGhostRow)}</div>
            ) : (
              <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
                <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-bold">
                  {friendsOnly
                    ? 'No friends yet — add them from any profile'
                    : 'No daily results yet. Be the first!'}
                </p>
                {friendsOnly && (
                  <Link
                    href="/friends"
                    className="inline-block mt-3 px-4 py-2 rounded-xl text-xs font-black text-white btn-3d"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 4px 0 #4c1d95' }}
                  >
                    Add friends
                  </Link>
                )}
              </div>
            )
          ) : (
            <div>
              {/* Blocked users are hidden client-side; ranks keep their
                  original positions (holes where blocked rows were). The
                  friends board is dense by construction — its fetch is
                  already restricted to friends∪me. */}
              {leaderboard
                .map((entry, index) => ({ entry, rank: index + 1 }))
                .filter(({ entry }) => !isBlocked(entry.user_id))
                .map(({ entry, rank }) => renderLbRow(entry, rank))}
              {/* Friends who haven't played this mode today. */}
              {friendsOnly && ghostFriends.map(renderGhostRow)}
              {/* "Your neighborhood" — the rows around the user's rank when they
                  placed past the top 50 (e.g. #425 sees ~421–429, own row
                  highlighted). Same ordering as the list, so ranks agree. */}
              {rankWindow && (
                <>
                  <div
                    className="text-center py-1.5 text-sm font-black tracking-widest"
                    style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}
                  >
                    ···
                  </div>
                  {rankWindow.entries
                    .map((entry, index) => ({ entry, rank: rankWindow.startRank + index }))
                    .filter(({ entry }) => !isBlocked(entry.user_id))
                    .map(({ entry, rank }) => renderLbRow(entry, rank))}
                </>
              )}
            </div>
          )}
        </div>
        </PullToRefresh>

        {/* Yesterday's Winners — per-mode top 3, or yesterday's top sweepers */}
        <div className="w-full mt-4 flex items-center justify-center gap-1.5 py-2">
          <button
            onClick={() => setShowYesterday(!showYesterday)}
            className="flex items-center gap-1.5 text-xs font-extrabold transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Yesterday's Winners
            {showYesterday ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {/* Settled-podium share — only once the dropdown is open with rows. */}
          {showYesterday && !isSweep && yesterdayLeaderboard.length > 0 && (
            <button
              onClick={handleSharePodium}
              disabled={sharingPodium}
              aria-label="Share yesterday's podium"
              className="p-1 -my-1 active:scale-95 transition-transform"
              style={{ color: 'var(--color-text-muted)', opacity: sharingPodium ? 0.4 : 1 }}
            >
              <Share className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {showYesterday && (
          <div
            className="overflow-hidden mb-4"
            style={{
              background: 'var(--color-surface)',
              border: '1.5px solid var(--color-border)',
              borderRadius: '16px',
            }}
          >
            {isSweep ? (
              yesterdaySweep.length === 0 ? (
                <div className="p-6 text-center text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
                  No sweeps yesterday
                </div>
              ) : (
                <div>
                  {yesterdaySweep.filter((e) => !isBlocked(e.user_id)).map((entry) => (
                    <div
                      key={entry.user_id}
                      className="flex items-center gap-3 px-4 py-3"
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                    >
                      <RankIcon rank={entry.rank} />
                      <span className="text-xs font-extrabold flex-1 truncate" style={{ color: 'var(--color-text)' }}>{entry.username}</span>
                      <span
                        className="text-[9px] font-extrabold px-1.5 py-0.5 rounded"
                        style={{
                          background: entry.is_flawless ? '#d9770622' : '#a78bfa22',
                          color: entry.is_flawless ? '#d97706' : '#a78bfa',
                        }}
                      >
                        {entry.is_flawless ? 'FLAWLESS' : 'SWEEP'}
                      </span>
                      <span className="text-xs font-black" style={{ color: 'var(--color-text-muted)' }}>{ySweepScoreLabels.get(entry.total_score) ?? formatScore(entry.total_score)}</span>
                    </div>
                  ))}
                </div>
              )
            ) : yesterdayLeaderboard.length === 0 ? (
              <div className="p-6 text-center text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
                No results from yesterday
              </div>
            ) : (
              <div>
                {/* Full daily rows (founder ask, Aug 11): clickable profiles,
                    guesses + time detail, W/L pill — same renderer as today. */}
                {yesterdayLeaderboard.filter((e) => !isBlocked(e.user_id)).map((entry, index) =>
                  renderLbRow(entry, index + 1, yLbScoreLabels))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Canned-taunt picker (§207): fixed phrases, one per friend per day. */}
      {tauntTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => { setTauntTarget(null); setTauntStatus(null); }}
        >
          <div
            className="w-full max-w-sm overflow-hidden"
            style={{
              background: 'var(--color-surface)',
              border: '1.5px solid var(--color-border)',
              borderRadius: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Taunt {tauntTarget.username}
              </p>
            </div>
            {tauntStatus ? (
              <div className="p-6 text-center text-sm font-extrabold" style={{ color: 'var(--color-text)' }}>
                {tauntStatus}
              </div>
            ) : (
              <div>
                {FRIEND_TAUNTS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => fireTaunt(t.id)}
                    className="w-full text-left px-4 py-3 text-xs font-extrabold transition-colors hover:opacity-80"
                    style={{ color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)' }}
                  >
                    {t.text}
                  </button>
                ))}
                <button
                  onClick={() => setTauntTarget(null)}
                  className="w-full px-4 py-3 text-xs font-extrabold"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <BottomNav />
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
      <ModeLimitModal
        open={limitModalOpen}
        onClose={() => setLimitModalOpen(false)}
        modeName={mode.title}
        onViewPuzzle={() => router.push(`${modeHref}?daily=true`)}
      />
    </div>
  );
}
