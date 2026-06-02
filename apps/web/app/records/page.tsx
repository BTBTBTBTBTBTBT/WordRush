'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Trophy, Clock, Target, Flame, Crown, Zap, Medal, Users, User, Swords } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ModePicker, PROFILE_MODES } from '@/components/profile/mode-picker';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { RankDeltaBadge, saveRank } from '@/components/ui/rank-delta';
import {
  fetchAllTimeRecords,
  fetchDailyLeaderboard,
  getDailyPlayerCount,
  getUserDailyRank,
  getTodayLocal,
  type AllTimeRecord,
  type LeaderboardEntry,
} from '@/lib/daily-service';

const getMode = (dbKey: string) => PROFILE_MODES.find((m) => m.dbKey === dbKey)!;

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

  const loadData = useCallback(async () => {
    setLoading(true);
    setUserRank(null);
    const [lb, count] = await Promise.all([
      fetchDailyLeaderboard(selectedMode, playType, today, 50),
      getDailyPlayerCount(selectedMode, today),
    ]);
    setLeaderboard(lb);
    setPlayerCount(count);

    if (userId) {
      const rank = await getUserDailyRank(userId, selectedMode, playType, today);
      setUserRank(rank);
    }
    setLoading(false);
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
                <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>of {userRank.totalPlayers}</span>
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
            {leaderboard.map((entry, index) => {
              const rank = index + 1;
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
                    <div className="font-black text-xs" style={{ color: 'var(--color-text)' }}>{entry.composite_score}</div>
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
      </PullToRefresh>
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
    fetchAllTimeRecords().then((data) => {
      setRecords(data);
      setLoading(false);
    });
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
   MAIN PAGE
   ═══════════════════════════════════════════════════════ */
export default function RecordsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'daily' | 'alltime'>('daily');

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

        {/* Daily / All-Time Toggle */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setActiveTab('daily')}
            className="flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all"
            style={{
              background: activeTab === 'daily' ? 'var(--color-surface)' : 'var(--color-surface-hover)',
              border: activeTab === 'daily' ? '1.5px solid #7c3aed' : '1.5px solid var(--color-border)',
              color: activeTab === 'daily' ? '#7c3aed' : 'var(--color-text-muted)',
            }}
          >
            Daily
          </button>
          <button
            onClick={() => setActiveTab('alltime')}
            className="flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all"
            style={{
              background: activeTab === 'alltime' ? 'var(--color-surface)' : 'var(--color-surface-hover)',
              border: activeTab === 'alltime' ? '1.5px solid #7c3aed' : '1.5px solid var(--color-border)',
              color: activeTab === 'alltime' ? '#7c3aed' : 'var(--color-text-muted)',
            }}
          >
            All-Time
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'daily' ? (
          <DailyRecordsView key="daily" userId={user?.id} />
        ) : (
          <AllTimeRecordsView key="alltime" userId={user?.id} />
        )}
      </div>

      <BottomNav />
    </div>
  );
}
