'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Trophy, Clock, Target, Flame, Crown, Zap, Medal, Users, User, Swords, Sparkles, TrendingUp, ChevronDown, Star } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { formatScore } from '@/lib/composite-scoring';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ModePicker, PROFILE_MODES } from '@/components/profile/mode-picker';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { RankDeltaBadge } from '@/components/ui/rank-delta';
import { supabase } from '@/lib/supabase-client';
import { fetchDailySweepStats, type DailySweepStats } from '@/lib/stats-service';
import { fetchBlockedIds, isBlocked } from '@/lib/moderation-service';
import { SectionHeader } from '@/components/profile/stat-kit';
import {
  fetchAllTimeRecords,
  fetchDailyLeaderboard,
  getDailyPlayerCount,
  getUserDailyRank,
  getTodayLocal,
  getYesterdayLocal,
  type AllTimeRecord,
  type LeaderboardEntry,
} from '@/lib/daily-service';

const getMode = (dbKey: string) => PROFILE_MODES.find((m) => m.dbKey === dbKey)!;

// Session-lived stale-while-revalidate cache for the Daily records view —
// same pattern as lbCache on /daily, with playType in the key (this view has
// a Solo/VS toggle). Mode/toggle taps repaint instantly; skeleton = first load.
const recordsLbCache = new Map<string, {
  lb: LeaderboardEntry[];
  count: number;
  rank: { rank: number; totalPlayers: number } | null;
}>();

// All-Time and Your Records both need the full record list — share one
// session-lived fetch (fresh on reload; records change rarely) instead of
// re-querying per sub-tab visit.
let allTimeRecordsPromise: Promise<AllTimeRecord[]> | null = null;
function fetchAllTimeRecordsShared(): Promise<AllTimeRecord[]> {
  if (!allTimeRecordsPromise) {
    allTimeRecordsPromise = fetchAllTimeRecords().catch((e) => {
      allTimeRecordsPromise = null;  // don't memoize a failure
      throw e;
    });
  }
  return allTimeRecordsPromise;
}

const RECORD_LABELS: Record<string, { label: string; icon: typeof Trophy; format: (v: number) => string }> = {
  fastest_win: { label: 'Fastest Win', icon: Clock, format: (v) => v < 60 ? `${v}s` : `${Math.floor(v / 60)}m ${v % 60}s` },
  fewest_guesses: { label: 'Fewest Guesses', icon: Target, format: (v) => `${v} guesses` },
  most_games_played: { label: 'Most Games Played', icon: Zap, format: (v) => `${v} games` },
  longest_streak: { label: 'Longest Streak', icon: Flame, format: (v) => `${v} wins` },
  most_gold_medals: { label: 'Most Gold Medals', icon: Crown, format: (v) => `${v} golds` },
  highest_level: { label: 'Highest Level', icon: Trophy, format: (v) => `Level ${v}` },
  most_daily_completions: { label: 'Most Dailies Completed', icon: Target, format: (v) => `${v} dailies` },
};

const PER_MODE_RECORD_TYPES = ['fastest_win', 'fewest_guesses', 'most_games_played', 'longest_streak'];
const GLOBAL_RECORD_TYPES = ['longest_streak', 'highest_level', 'most_gold_medals', 'most_daily_completions'];

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-5 h-5" style={{ color: '#d97706' }} />;
  if (rank === 2) return <Medal className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />;
  if (rank === 3) return <Medal className="w-5 h-5" style={{ color: '#b45309' }} />;
  return <span className="text-xs font-black w-5 text-center" style={{ color: 'var(--color-text-muted)' }}>{rank}</span>;
}

function StatCell({
  recordType,
  record,
  accentColor,
  isCurrentUser,
}: {
  recordType: string;
  record?: AllTimeRecord;
  accentColor: string;
  isCurrentUser: boolean;
}) {
  const config = RECORD_LABELS[recordType];
  if (!config) return null;
  const Icon = config.icon;
  const hasRecord = !!record;

  return (
    <div
      className="flex items-start gap-2.5 p-2 rounded-lg"
      style={
        isCurrentUser && hasRecord
          ? { background: 'var(--color-highlight-gold)', border: '1px solid var(--color-gold-border)' }
          : { border: '1px solid transparent' }
      }
    >
      <Icon
        className="w-4 h-4 shrink-0 mt-0.5"
        style={{ color: hasRecord ? accentColor : 'var(--color-text-muted)' }}
      />
      <div className="min-w-0 flex-1">
        <div
          className="font-black text-base leading-tight"
          style={{ color: hasRecord ? 'var(--color-text)' : 'var(--color-text-muted)' }}
        >
          {hasRecord ? config.format(record!.record_value) : '—'}
        </div>
        <div
          className="text-[10px] font-bold leading-tight mt-0.5"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {config.label}
        </div>
        {hasRecord && (
          <Link
            href={`/profile/${record!.holder_id}`}
            className="text-[10px] font-extrabold leading-tight mt-1 flex items-center gap-1 hover:opacity-80 transition-opacity"
            style={{ color: isCurrentUser ? '#d97706' : accentColor }}
          >
            <span className="truncate">{record!.holder_username || 'Unknown'}</span>
            {isCurrentUser && <Crown className="w-2.5 h-2.5 shrink-0" />}
          </Link>
        )}
      </div>
    </div>
  );
}

/* ── Skeleton loaders ── */
function LeaderboardSkeleton() {
  return (
    <div className="space-y-0">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5 animate-pulse">
          <div className="w-5 h-5 rounded-full" style={{ background: 'var(--color-border)' }} />
          <div className="flex-1 h-3 rounded" style={{ background: 'var(--color-border)' }} />
          <div className="w-12 h-3 rounded" style={{ background: 'var(--color-border)' }} />
        </div>
      ))}
    </div>
  );
}

function AllTimeSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{ background: 'var(--color-border)', borderRadius: '16px', height: i === 1 ? '140px' : '100px' }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   DAILY RECORDS VIEW
   ═══════════════════════════════════════════════════════ */
function DailyRecordsView({ userId }: { userId?: string }) {
  const [selectedMode, setSelectedMode] = useState('DUEL');
  const [playType, setPlayType] = useState<'solo' | 'vs'>('solo');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [userRank, setUserRank] = useState<{ rank: number; totalPlayers: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const today = getTodayLocal();
  // Drops late responses from a previous mode/toggle so a slow fetch can't
  // overwrite the selection the user has since switched to.
  const loadSeq = useRef(0);

  const loadData = useCallback(async () => {
    const seq = ++loadSeq.current;
    const cacheKey = `${selectedMode}:${playType}:${today}:${userId ?? 'anon'}`;
    const cached = recordsLbCache.get(cacheKey);
    if (cached) {
      setLeaderboard(cached.lb);
      setPlayerCount(cached.count);
      setUserRank(cached.rank);
      setLoading(false);
    } else {
      setLoading(true);
      setUserRank(null);
      setLeaderboard([]);
    }

    const [lb, count] = await Promise.all([
      fetchDailyLeaderboard(selectedMode, playType, today, 50),
      getDailyPlayerCount(selectedMode, today),
    ]);
    if (seq !== loadSeq.current) return;
    // Paint the rows the moment they arrive — the rank banner fills in on its
    // own instead of holding the whole list behind its extra queries.
    setLeaderboard(lb);
    setPlayerCount(count);
    setLoading(false);

    let rank: { rank: number; totalPlayers: number } | null = null;
    if (userId) {
      rank = await getUserDailyRank(userId, selectedMode, playType, today, lb, 50);
      if (seq === loadSeq.current) setUserRank(rank);
    }
    recordsLbCache.set(cacheKey, { lb, count, rank });
  }, [selectedMode, playType, userId, today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const mode = getMode(selectedMode);
  const color = mode.accentColor;
  const Icon = mode.icon;

  return (
    <div className="animate-fade-in-up">
      {/* Mode Picker */}
      <div className="mb-3">
        <ModePicker
          grid
          showAll={false}
          selectedMode={selectedMode}
          onSelectMode={(m) => setSelectedMode(m || 'DUEL')}
        />
      </div>

      <PullToRefresh onRefresh={loadData} accentColor={color}>
      {/* Leaderboard Card */}
      <div
        key={`${selectedMode}-${playType}`}
        className="overflow-hidden animate-fade-in"
        style={{
          background: 'var(--color-surface)',
          border: '1.5px solid var(--color-border)',
          borderRadius: '16px',
        }}
      >
        {/* Mode accent bar */}
        <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />

        {/* Card header: mode info + solo/vs toggle */}
        <div className="px-4 pt-3 pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
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
                <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                  Today
                </div>
              </div>
            </div>

            {/* Solo/VS toggle */}
            <div
              className="flex rounded-lg overflow-hidden"
              style={{ border: '1.5px solid var(--color-border)' }}
            >
              {(['solo', 'vs'] as const).map((t) => (
                <button
                  key={t}
                  className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-extrabold transition-all"
                  style={{
                    background: playType === t ? `${color}15` : 'var(--color-surface)',
                    color: playType === t ? color : 'var(--color-text-muted)',
                  }}
                  onClick={() => setPlayType(t)}
                >
                  {t === 'solo' ? <User className="w-3 h-3" /> : <Swords className="w-3 h-3" />}
                  {t === 'solo' ? 'Solo' : 'VS'}
                </button>
              ))}
            </div>
          </div>

          {/* Player count + user rank */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
              <Users className="w-3.5 h-3.5" />
              <span>{playerCount} player{playerCount !== 1 ? 's' : ''} today</span>
            </div>
            {userRank && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Your rank:</span>
                <span className="font-black text-xs" style={{ color: '#d97706' }}>#{userRank.rank}</span>
                <RankDeltaBadge mode={selectedMode} playType={playType} pageKey="records-daily" currentRank={userRank.rank} />
                <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                  of {userRank.totalPlayers}
                  {userRank.totalPlayers > 1 && ` · top ${Math.max(1, Math.round((userRank.rank / userRank.totalPlayers) * 100))}%`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard rows */}
        {loading ? (
          <LeaderboardSkeleton />
        ) : leaderboard.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs font-bold">No results yet today. Be the first!</p>
          </div>
        ) : (
          <div>
            {/* Blocked users are hidden client-side; ranks keep their
                original positions (holes where blocked rows were). */}
            {leaderboard
              .map((entry, index) => ({ entry, rank: index + 1 }))
              .filter(({ entry }) => !isBlocked(entry.user_id))
              .map(({ entry, rank }) => {
              const isCurrentUser = !!userId && entry.user_id === userId;
              return (
                <div
                  key={entry.user_id}
                  className="flex items-center gap-3 px-4 py-2.5"
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
                      {playType === 'solo' ? (
                        <>
                          <span>
                            {entry.guess_count}G · {formatTime(entry.time_seconds)}
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
                        </>
                      ) : (
                        <>{entry.vs_wins}W / {entry.vs_games}G</>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Yesterday's podium */}
      <YesterdayPodium mode={selectedMode} playType={playType} color={color} />
      </PullToRefresh>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   YESTERDAY'S PODIUM (collapsible)
   ═══════════════════════════════════════════════════════ */
function YesterdayPodium({ mode, playType, color }: { mode: string; playType: 'solo' | 'vs'; color: string }) {
  const [top3, setTop3] = useState<LeaderboardEntry[]>([]);
  const [open, setOpen] = useState(false);
  const yesterday = getYesterdayLocal();

  useEffect(() => {
    let active = true;
    fetchDailyLeaderboard(mode, playType, yesterday, 3).then((r) => { if (active) setTop3(r); });
    return () => { active = false; };
  }, [mode, playType, yesterday]);

  if (top3.length === 0) return null;
  const medalColor = ['#d97706', '#9ca3af', '#b45309'];

  return (
    <div
      className="overflow-hidden mt-3"
      style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5"
      >
        <div className="flex items-center gap-1.5">
          <Crown className="w-3.5 h-3.5" style={{ color: '#d97706' }} />
          <span className="text-[11px] font-black uppercase tracking-wide" style={{ color: 'var(--color-text)' }}>Yesterday&apos;s Podium</span>
        </div>
        <ChevronDown className="w-4 h-4 transition-transform" style={{ color: 'var(--color-text-muted)', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div style={{ borderTop: '1px solid var(--color-border)' }}>
          {top3.filter((e) => !isBlocked(e.user_id)).map((e, i, arr) => (
            <div key={e.user_id} className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
              <Medal className="w-4 h-4 shrink-0" style={{ color: medalColor[i] }} />
              <Link href={`/profile/${e.user_id}`} className="flex-1 min-w-0 text-xs font-extrabold truncate hover:opacity-80" style={{ color: 'var(--color-text)' }}>{e.username}</Link>
              <span className="font-black text-xs" style={{ color }}>{formatScore(e.composite_score)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ALL-TIME RECORDS VIEW
   ═══════════════════════════════════════════════════════ */
function AllTimeRecordsView({ userId }: { userId?: string }) {
  const [records, setRecords] = useState<AllTimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState('DUEL');

  useEffect(() => {
    fetchAllTimeRecordsShared().then((data) => {
      setRecords(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const globalRecords = useMemo(
    () => records.filter((r) => !r.game_mode && GLOBAL_RECORD_TYPES.includes(r.record_type)),
    [records],
  );

  const modeRecordsMap = useMemo(() => {
    const map = new Map<string, AllTimeRecord[]>();
    for (const r of records) {
      if (r.game_mode) {
        const existing = map.get(r.game_mode) || [];
        existing.push(r);
        map.set(r.game_mode, existing);
      }
    }
    return map;
  }, [records]);

  if (loading) {
    return (
      <div className="animate-fade-in-up">
        <AllTimeSkeleton />
      </div>
    );
  }

  const mode = getMode(selectedMode);
  const color = mode.accentColor;
  const Icon = mode.icon;
  const modeRecords = modeRecordsMap.get(selectedMode) || [];

  return (
    <div className="animate-fade-in-up">
      {/* Hall of Fame */}
      <div className="mb-5">
        <div
          className="text-[10px] font-black uppercase tracking-wider mb-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Hall of Fame
        </div>
        <div
          className="overflow-hidden animate-fade-in-scale"
          style={{
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-gold-border)',
            borderRadius: '16px',
          }}
        >
          <div
            className="h-[3px]"
            style={{ background: 'linear-gradient(90deg, #f59e0b, var(--color-gold-border))' }}
          />
          <div className="px-4 pt-2 pb-4">
            <div className="grid grid-cols-2 gap-3">
              {GLOBAL_RECORD_TYPES.map((rt) => {
                const record = globalRecords.find((r) => r.record_type === rt);
                return (
                  <StatCell
                    key={rt}
                    recordType={rt}
                    record={record}
                    accentColor="#d97706"
                    isCurrentUser={!!userId && record?.holder_id === userId}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* By Game Mode */}
      <div>
        <div
          className="text-[10px] font-black uppercase tracking-wider mb-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          By Game Mode
        </div>

        <div className="mb-3">
          <ModePicker
            grid
            showAll={false}
            selectedMode={selectedMode}
            onSelectMode={(m) => setSelectedMode(m || 'DUEL')}
          />
        </div>

        <div
          key={selectedMode}
          className="overflow-hidden animate-fade-in"
          style={{
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            borderRadius: '16px',
          }}
        >
          <div
            className="h-[3px]"
            style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }}
          />
          <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
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
            <div className="font-black text-sm" style={{ color: 'var(--color-text)' }}>
              {mode.title}
            </div>
          </div>
          <div className="px-4 pb-4">
            {modeRecords.length === 0 ? (
              <div className="py-5 text-center">
                <Trophy
                  className="w-7 h-7 mx-auto mb-1.5"
                  style={{ color: 'var(--color-text-muted)' }}
                />
                <p className="text-[11px] font-extrabold" style={{ color: 'var(--color-text-muted)' }}>
                  No records yet
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {PER_MODE_RECORD_TYPES.map((rt) => {
                  // A mode can have both a solo and a VS record per type; the
                  // per-mode card represents solo play, so prefer the solo row
                  // (else fall back to whatever exists). Otherwise e.g. Classic
                  // "Most Games Played" could show the tiny VS count.
                  const candidates = modeRecords.filter((r) => r.record_type === rt);
                  const record = candidates.find((r) => r.play_type === 'solo') ?? candidates[0];
                  return (
                    <StatCell
                      key={rt}
                      recordType={rt}
                      record={record}
                      accentColor={color}
                      isCurrentUser={!!userId && record?.holder_id === userId}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   YOUR RECORDS VIEW
   ═══════════════════════════════════════════════════════ */
type UserStatRow = { game_mode: string; play_type: string; wins: number; losses: number; total_games: number; best_score: number | null; fastest_time: number | null };

const STREAK_MILESTONES = [7, 30, 100];

function MyStatCell({ icon: Icon, value, label, color, dim }: { icon: typeof Trophy; value: string; label: string; color: string; dim?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 p-2">
      <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: dim ? 'var(--color-text-muted)' : color }} />
      <div className="min-w-0 flex-1">
        <div className="font-black text-base leading-tight" style={{ color: dim ? 'var(--color-text-muted)' : 'var(--color-text)' }}>{value}</div>
        <div className="text-[10px] font-bold leading-tight mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
      </div>
    </div>
  );
}

function YourRecordsView({ userId }: { userId?: string }) {
  const { profile } = useAuth();
  const [stats, setStats] = useState<UserStatRow[]>([]);
  const [sweep, setSweep] = useState<DailySweepStats | null>(null);
  const [recordsHeld, setRecordsHeld] = useState<AllTimeRecord[]>([]);
  const [chases, setChases] = useState<Array<{ label: string; gap: string; pct: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState('DUEL');

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let active = true;
    (async () => {
      const [statsRes, sweepRes, recs] = await Promise.all([
        supabase.from('user_stats').select('game_mode, play_type, wins, losses, total_games, best_score, fastest_time').eq('user_id', userId),
        fetchDailySweepStats(userId),
        fetchAllTimeRecordsShared(),
      ]);
      if (!active) return;
      const rows = (statsRes.data || []) as UserStatRow[];
      setStats(rows);
      setSweep(sweepRes);
      setRecordsHeld(recs.filter((r) => r.holder_id === userId));

      // Record Chase: EVERY beatable all-time record with your gap, sorted by
      // how close you are (relative gap). Lower-is-better types only.
      const all: Array<{ label: string; gap: string; pct: number; rel: number }> = [];
      for (const r of recs) {
        if (r.holder_id === userId || !r.game_mode || r.play_type !== 'solo') continue;
        const mine = rows.find((s) => s.game_mode === r.game_mode && s.play_type === 'solo');
        if (!mine) continue;
        if (r.record_type === 'fastest_win' && mine.fastest_time && mine.fastest_time > r.record_value) {
          const gap = mine.fastest_time - r.record_value;
          all.push({ label: `${getMode(r.game_mode).title} fastest win`, gap: `${gap}s away`, pct: Math.round((r.record_value / mine.fastest_time) * 100), rel: gap / Math.max(1, r.record_value) });
        } else if (r.record_type === 'fewest_guesses' && mine.best_score && mine.best_score > r.record_value) {
          const gap = mine.best_score - r.record_value;
          all.push({ label: `${getMode(r.game_mode).title} fewest guesses`, gap: `${gap} away`, pct: Math.round((r.record_value / mine.best_score) * 100), rel: gap / Math.max(1, r.record_value) });
        }
      }
      setChases(all.sort((a, b) => a.rel - b.rel).slice(0, 3).map(({ rel: _rel, ...rest }) => rest));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  if (!userId) {
    return (
      <div className="animate-fade-in-up p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
        <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-xs font-bold">Sign in to see your personal records.</p>
      </div>
    );
  }
  if (loading) return <div className="animate-fade-in-up"><AllTimeSkeleton /></div>;

  const dailyStreak = profile?.daily_login_streak ?? 0;
  const nextMilestone = STREAK_MILESTONES.find((m) => m > dailyStreak);
  const mode = getMode(selectedMode);
  const color = mode.accentColor;
  const Icon = mode.icon;
  const my = stats.find((s) => s.game_mode === selectedMode && s.play_type === 'solo');

  const fmtRecord = (rt: string, v: number | null | undefined) =>
    v == null || v === 0 ? '—' : RECORD_LABELS[rt].format(v);

  return (
    <div className="animate-fade-in-up space-y-5">
      {/* Milestone progress */}
      {(nextMilestone || chases.length > 0) && (
        <div className="overflow-hidden" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}>
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #a78bfa, #ec4899)' }} />
          <div className="px-4 pt-3 pb-4">
            <div className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>Next Up</div>
            {nextMilestone && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-[11px] font-extrabold mb-1">
                  <span className="flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}><Flame className="w-3.5 h-3.5" style={{ color: '#f97316' }} />{nextMilestone}-day streak shield</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>{dailyStreak}/{nextMilestone}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (dailyStreak / nextMilestone) * 100)}%`, background: 'linear-gradient(90deg, #f97316, #fbbf24)' }} />
                </div>
              </div>
            )}
            {chases.length > 0 && (
              <div className="space-y-2">
                {chases.map((c) => (
                  <div key={c.label}>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      <TrendingUp className="w-3.5 h-3.5 shrink-0" style={{ color: '#7c3aed' }} />
                      <span className="flex-1 truncate">You&apos;re <b style={{ color: 'var(--color-text)' }}>{c.gap}</b> from the {c.label} record</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, c.pct)}%`, background: 'linear-gradient(90deg, #a78bfa, #7c3aed)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sweep & Flawless */}
      {sweep && (sweep.sweepCount > 0 || sweep.flawlessCount > 0) && (
        <div className="overflow-hidden" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}>
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #fbbf24, #d97706)' }} />
          <div className="px-4 pt-2 pb-3">
            <div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Daily Sweeps</div>
            <div className="grid grid-cols-2 gap-1">
              <MyStatCell icon={Sparkles} value={`${sweep.sweepCount}`} label="Daily Sweeps" color="#7c3aed" />
              <MyStatCell icon={Trophy} value={`${sweep.flawlessCount}`} label="Flawless Victories" color="#d97706" />
              <MyStatCell icon={Flame} value={`${sweep.currentSweepStreak}`} label="Current Sweep Streak" color="#f97316" />
              <MyStatCell icon={Clock} value={sweep.bestSweepSecs ? formatTime(Math.round(sweep.bestSweepSecs)) : '—'} label="Best Sweep Time" color="#2563eb" dim={!sweep.bestSweepSecs} />
            </div>
          </div>
        </div>
      )}

      {/* Personal bests by mode */}
      <div>
        <SectionHeader label="Your Bests By Mode" accent="#7c3aed" />
        <div className="mb-3">
          <ModePicker grid showAll={false} selectedMode={selectedMode} onSelectMode={(m) => setSelectedMode(m || 'DUEL')} />
        </div>
        <div className="overflow-hidden" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}>
          <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
          <div className="flex items-center gap-2.5 px-4 pt-3 pb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
              {mode.romanNumeral ? <span className="text-[11px] font-black leading-none" style={{ color }}>{mode.romanNumeral}</span> : Icon ? <Icon className="w-4 h-4" style={{ color }} /> : null}
            </div>
            <div className="font-black text-sm" style={{ color: 'var(--color-text)' }}>{mode.title}</div>
          </div>
          <div className="px-4 pb-3 grid grid-cols-2 gap-1">
            <MyStatCell icon={Clock} value={fmtRecord('fastest_win', my?.fastest_time)} label="Fastest Win" color={color} dim={!my?.fastest_time} />
            <MyStatCell icon={Target} value={fmtRecord('fewest_guesses', my?.best_score)} label="Fewest Guesses" color={color} dim={!my?.best_score} />
            <MyStatCell icon={Zap} value={my ? `${my.total_games} games` : '—'} label="Games Played" color={color} dim={!my} />
            <MyStatCell icon={Trophy} value={my ? `${my.wins}–${my.losses}` : '—'} label="Win–Loss" color={color} dim={!my} />
          </div>
        </div>
      </div>

      {/* Medals + global records held */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/profile" className="overflow-hidden block" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}>
          <div className="px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Medals</div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 font-black text-sm" style={{ color: '#d97706' }}><Crown className="w-3.5 h-3.5" />{profile?.gold_medals ?? 0}</span>
              <span className="flex items-center gap-1 font-black text-sm" style={{ color: '#9ca3af' }}><Medal className="w-3.5 h-3.5" />{profile?.silver_medals ?? 0}</span>
              <span className="flex items-center gap-1 font-black text-sm" style={{ color: '#b45309' }}><Medal className="w-3.5 h-3.5" />{profile?.bronze_medals ?? 0}</span>
            </div>
            <div className="text-[10px] font-bold mt-1.5" style={{ color: '#7c3aed' }}>View all →</div>
          </div>
        </Link>
        <div className="overflow-hidden" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}>
          <div className="px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Global Records</div>
            <div className="flex items-center gap-1.5 font-black text-2xl" style={{ color: recordsHeld.length ? '#d97706' : 'var(--color-text-muted)' }}>
              <Star className="w-5 h-5" />{recordsHeld.length}
            </div>
            <div className="text-[10px] font-bold mt-0.5" style={{ color: 'var(--color-text-muted)' }}>all-time record{recordsHeld.length !== 1 ? 's' : ''} held</div>
          </div>
        </div>
      </div>

      {/* Trophy shelf — the specific records you hold, spelled out. */}
      {recordsHeld.length > 0 && (
        <div className="overflow-hidden" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}>
          <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #fbbf24, #d97706)' }} />
          <div className="px-4 pt-2 pb-3">
            <div className="text-[10px] font-black uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Your Trophy Shelf</div>
            <div className="space-y-1.5">
              {recordsHeld.map((r) => {
                const cfg = RECORD_LABELS[r.record_type];
                const RIcon = cfg?.icon ?? Star;
                const modeTitle = r.game_mode ? getMode(r.game_mode).title : 'Global';
                return (
                  <div key={`${r.record_type}-${r.game_mode ?? 'g'}-${r.play_type ?? 'g'}`} className="flex items-center gap-2.5 p-2" style={{ background: 'var(--color-bg)', borderRadius: '10px' }}>
                    <RIcon className="w-4 h-4 shrink-0" style={{ color: '#d97706' }} />
                    <span className="text-xs font-extrabold flex-1 truncate" style={{ color: 'var(--color-text)' }}>
                      {modeTitle} · {cfg?.label ?? r.record_type}
                    </span>
                    <span className="text-xs font-black" style={{ color: '#d97706' }}>
                      {cfg ? cfg.format(r.record_value) : r.record_value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════ */
export default function RecordsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'daily' | 'alltime' | 'you'>('daily');

  // Load the signed-in user's block list (session-cached) so blocked users'
  // rows can be filtered out of the leaderboard renders below. The state bump
  // just forces a re-render (which cascades to the tab views) once it arrives.
  const [, setBlockedLoaded] = useState(false);
  useEffect(() => {
    if (user) fetchBlockedIds(user.id).then(() => setBlockedLoaded(true));
  }, [user]);

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--color-bg)' }}>
      <AppHeader />

      <div className="max-w-lg mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-4 animate-fade-in-up">
          <h1
            className="text-3xl font-black bg-clip-text text-transparent tracking-tight"
            style={{
              backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)',
            }}
          >
            RECORDS
          </h1>
          <p className="text-xs font-bold mt-1" style={{ color: 'var(--color-text-muted)' }}>
            The best of the best across Wordocious
          </p>
        </div>

        {/* Daily / All-Time / You Toggle */}
        <div className="flex gap-2 mb-5">
          {([['daily', 'Daily'], ['alltime', 'All-Time'], ['you', 'You']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all"
              style={{
                background: activeTab === key ? 'var(--color-surface)' : 'var(--color-surface-hover)',
                border: activeTab === key ? '1.5px solid #7c3aed' : '1.5px solid var(--color-border)',
                color: activeTab === key ? '#7c3aed' : 'var(--color-text-muted)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'daily' ? (
          <DailyRecordsView key="daily" userId={user?.id} />
        ) : activeTab === 'alltime' ? (
          <AllTimeRecordsView key="alltime" userId={user?.id} />
        ) : (
          <YourRecordsView key="you" userId={user?.id} />
        )}
      </div>

      <BottomNav />
    </div>
  );
}
