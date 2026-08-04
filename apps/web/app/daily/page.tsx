'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Clock, Medal, Crown, Users, Calendar, ChevronDown, ChevronUp, Trophy, Play } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { formatScore } from '@/lib/composite-scoring';
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

    const cacheKey = `${selectedMode}:${day}:${user?.id ?? 'anon'}`;
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
  }, [selectedMode, user]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    if (!showYesterday) return;
    if (selectedMode === 'SWEEP') {
      fetchDailySweepLeaderboard(yesterday, 3).then(setYesterdaySweep);
    } else {
      fetchDailyLeaderboard(selectedMode, 'solo', yesterday, 3).then(setYesterdayLeaderboard);
    }
  }, [showYesterday, selectedMode, yesterday]);

  const mode = getMode(selectedMode);
  const color = mode.accentColor;
  const Icon = mode.icon;
  const modeHref = `/${mode.id}`;
  const playLimitKey = mode.id;

  // One row of the leaderboard — shared by the top-50 list and the
  // "your neighborhood" rank window so they can never drift apart visually.
  const renderLbRow = (entry: LeaderboardEntry, rank: number) => {
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
          <div className="font-black text-xs" style={{ color: 'var(--color-text)' }}>{formatScore(entry.composite_score)}</div>
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
      </div>
    );
  };

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
          <div className="font-black text-xs" style={{ color: 'var(--color-text)' }}>{formatScore(entry.total_score)}</div>
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
            <RankDeltaBadge mode={selectedMode} playType="solo" pageKey="daily" currentRank={userRank.rank} />
            <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}> of {userRank.totalPlayers}</span>
          </div>
        )}

        {/* Leaderboard — the caption is founder-approved clarity: this board
            ranks DAILY games only, so an Unlimited session never shows here. */}
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Leaderboard
          </div>
          <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
            Daily games only
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
            <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-bold">No daily results yet. Be the first!</p>
            </div>
          ) : (
            <div>
              {/* Blocked users are hidden client-side; ranks keep their
                  original positions (holes where blocked rows were). */}
              {leaderboard
                .map((entry, index) => ({ entry, rank: index + 1 }))
                .filter(({ entry }) => !isBlocked(entry.user_id))
                .map(({ entry, rank }) => renderLbRow(entry, rank))}
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
        <button
          onClick={() => setShowYesterday(!showYesterday)}
          className="w-full mt-4 flex items-center justify-center gap-1.5 text-xs font-extrabold py-2 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Yesterday's Winners
          {showYesterday ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

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
                      <span className="text-xs font-black" style={{ color: 'var(--color-text-muted)' }}>{formatScore(entry.total_score)}</span>
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
                {yesterdayLeaderboard.filter((e) => !isBlocked(e.user_id)).map((entry, index) => (
                  <div
                    key={entry.user_id}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                  >
                    <RankIcon rank={index + 1} />
                    <span className="text-xs font-extrabold flex-1 truncate" style={{ color: 'var(--color-text)' }}>{entry.username}</span>
                    <span
                      className="text-[9px] font-extrabold px-1.5 py-0.5 rounded"
                      style={{
                        background: entry.completed ? 'var(--color-win-bg)' : 'var(--color-loss-bg)',
                        color: entry.completed ? 'var(--color-win-text)' : 'var(--color-loss-text)',
                      }}
                    >
                      {entry.completed ? 'W' : 'L'}
                    </span>
                    <span className="text-xs font-black" style={{ color: 'var(--color-text-muted)' }}>{formatScore(entry.composite_score)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
