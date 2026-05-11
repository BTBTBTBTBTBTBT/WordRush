'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Clock, Medal, Crown, Users, Calendar, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AuthModal } from '@/components/auth/auth-modal';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ModeLimitModal } from '@/components/modals/mode-limit-modal';
import { ModePicker, PROFILE_MODES } from '@/components/profile/mode-picker';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { RankDeltaBadge } from '@/components/ui/rank-delta';
import {
  fetchDailyLeaderboard,
  getUserDailyRank,
  getDailyPlayerCount,
  getSecondsUntilMidnightUTC,
  getTodayLocal,
  getYesterdayLocal,
  type LeaderboardEntry,
} from '@/lib/daily-service';
import { hasPlayedModeToday } from '@/lib/play-limit-service';
import { CompletedDailyBoard } from '@/components/game/completed-daily-board';

const getMode = (dbKey: string) => PROFILE_MODES.find((m) => m.dbKey === dbKey)!;

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function CountdownTimer() {
  const [secondsLeft, setSecondsLeft] = useState(getSecondsUntilMidnightUTC());

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(getSecondsUntilMidnightUTC());
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
  const [userRank, setUserRank] = useState<{ rank: number; totalPlayers: number } | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showYesterday, setShowYesterday] = useState(false);
  const [yesterdayLeaderboard, setYesterdayLeaderboard] = useState<LeaderboardEntry[]>([]);

  const isPro = isProActive;

  // `today` must be derived on the client, not at SSR time. Next.js
  // renders the initial HTML on Vercel's UTC servers — if we computed
  // getTodayLocal() at module top-level, a user whose local day differs
  // from Vercel's UTC day would see the wrong day baked into the SSR HTML.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    setToday(getTodayLocal());
  }, []);
  const yesterday = useMemo(() => getYesterdayLocal(), []);

  const loadLeaderboard = useCallback(async () => {
    if (!today) return;
    setLoading(true);
    setUserRank(null);
    setLeaderboard([]);
    const [lb, count] = await Promise.all([
      fetchDailyLeaderboard(selectedMode, 'solo', today, 50),
      getDailyPlayerCount(selectedMode, today),
    ]);
    setLeaderboard(lb);
    setPlayerCount(count);

    if (user) {
      const rank = await getUserDailyRank(user.id, selectedMode, 'solo', today);
      setUserRank(rank);
    }
    setLoading(false);
  }, [selectedMode, user, today]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    if (showYesterday) {
      fetchDailyLeaderboard(selectedMode, 'solo', yesterday, 3).then(setYesterdayLeaderboard);
    }
  }, [showYesterday, selectedMode, yesterday]);

  const mode = getMode(selectedMode);
  const color = mode.accentColor;
  const Icon = mode.icon;
  const modeHref = `/${mode.id}`;
  const playLimitKey = mode.id;

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
                    <span>{playerCount} player{playerCount !== 1 ? 's' : ''} today</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handlePlayDaily}
                className="btn-3d px-4 py-2 rounded-lg text-white font-black text-xs"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  boxShadow: '0 3px 0 #92400e',
                }}
              >
                Play {mode.shortTitle}
              </button>
            </div>
          </div>
        </div>

        {/* Completed Board Preview */}
        <CompletedDailyBoard modeId={selectedMode} />

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

        {/* Leaderboard */}
        <div className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
          Leaderboard
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
          ) : leaderboard.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-bold">No results yet. Be the first!</p>
            </div>
          ) : (
            <div>
              {leaderboard.map((entry, index) => {
                const rank = index + 1;
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
                      <div className="font-black text-xs" style={{ color: 'var(--color-text)' }}>{entry.composite_score}</div>
                      <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                        <span>
                          {entry.guess_count} Guesses · {formatTime(entry.time_seconds)}
                          {entry.total_boards > 1 && ` · ${entry.boards_solved}/${entry.total_boards}`}
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
              })}
            </div>
          )}
        </div>
        </PullToRefresh>

        {/* Yesterday's Winners */}
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
            {yesterdayLeaderboard.length === 0 ? (
              <div className="p-6 text-center text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
                No results from yesterday
              </div>
            ) : (
              <div>
                {yesterdayLeaderboard.map((entry, index) => (
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
                    <span className="text-xs font-black" style={{ color: 'var(--color-text-muted)' }}>{entry.composite_score}</span>
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
