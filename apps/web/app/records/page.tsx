'use client';

import { useState, useEffect, useMemo } from 'react';
import { Trophy, Clock, Target, Flame, Crown, Zap, TrendingUp, Skull, Shield, Medal, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';
import {
  fetchAllTimeRecords,
  fetchDailyLeaderboard,
  getDailyPlayerCount,
  getUserDailyRank,
  getTodayUTC,
  type AllTimeRecord,
  type LeaderboardEntry,
} from '@/lib/daily-service';

/* ── record type config ── */
const RECORD_LABELS: Record<string, { label: string; icon: typeof Trophy; format: (v: number) => string }> = {
  fastest_win: { label: 'Fastest Win', icon: Clock, format: (v) => v < 60 ? `${v}s` : `${Math.floor(v / 60)}m ${v % 60}s` },
  fewest_guesses: { label: 'Fewest Guesses', icon: Target, format: (v) => `${v} guesses` },
  most_games_played: { label: 'Most Games Played', icon: Zap, format: (v) => `${v} games` },
  longest_streak: { label: 'Longest Streak', icon: Flame, format: (v) => `${v} wins` },
  most_gold_medals: { label: 'Most Gold Medals', icon: Crown, format: (v) => `${v} golds` },
  highest_level: { label: 'Highest Level', icon: Trophy, format: (v) => `Level ${v}` },
  most_daily_completions: { label: 'Most Dailies Completed', icon: Target, format: (v) => `${v} dailies` },
};

/* ── mode config ── */
const MODE_LABELS: Record<string, string> = {
  DUEL: 'Classic',
  QUORDLE: 'QuadWord',
  OCTORDLE: 'OctoWord',
  SEQUENCE: 'Succession',
  RESCUE: 'Deliverance',
  GAUNTLET: 'Gauntlet',
  PROPERNOUNDLE: 'ProperNoundle',
};

const MODE_COLORS: Record<string, string> = {
  DUEL: '#7c3aed',
  QUORDLE: '#ec4899',
  OCTORDLE: '#7e22ce',
  SEQUENCE: '#2563eb',
  RESCUE: '#059669',
  GAUNTLET: '#d97706',
  PROPERNOUNDLE: '#dc2626',
};

const MODE_ICONS: Record<string, any> = {
  DUEL: WordleGridIcon,
  SEQUENCE: TrendingUp,
  RESCUE: Shield,
  GAUNTLET: Skull,
  PROPERNOUNDLE: Crown,
};

const MODE_ROMAN: Record<string, string> = {
  QUORDLE: 'IV',
  OCTORDLE: 'VIII',
};

const GAME_MODES_ORDERED = ['DUEL', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'GAUNTLET', 'PROPERNOUNDLE'];
const PER_MODE_RECORD_TYPES = ['fastest_win', 'fewest_guesses', 'most_games_played'];
const GLOBAL_RECORD_TYPES = ['longest_streak', 'highest_level', 'most_gold_medals', 'most_daily_completions'];

/* ── helpers ── */
function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/* ── mode icon renderer ── */
function ModeIcon({ mode, color, size = 16 }: { mode: string; color: string; size?: number }) {
  const Icon = MODE_ICONS[mode];
  const roman = MODE_ROMAN[mode];

  if (roman) {
    return (
      <span className="text-[11px] font-black leading-none" style={{ color }}>{roman}</span>
    );
  }
  if (Icon) {
    return <Icon style={{ color, width: size, height: size }} />;
  }
  return <Trophy style={{ color, width: size, height: size }} />;
}

/* ── medal icon for leaderboard ranks ── */
function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-5 h-5" style={{ color: '#d97706' }} />;
  if (rank === 2) return <Medal className="w-5 h-5" style={{ color: '#9ca3af' }} />;
  if (rank === 3) return <Medal className="w-5 h-5" style={{ color: '#b45309' }} />;
  return <span className="text-xs font-black w-5 text-center" style={{ color: '#9ca3af' }}>{rank}</span>;
}

/* ── stat cell (matches Gauntlet All-Time Stats visual) ──
   Mirrors the layout used in `components/gauntlet/gauntlet-results.tsx`
   — small colored icon on the left, stacked `bold value / gray label`
   on the right, all packed into a 2-column grid by the parent. Handles
   both "record exists" (shows holder link + optional current-user
   crown) and "no record yet" (em-dash placeholder in muted color). */
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
          ? { background: '#fffbeb', border: '1px solid #fde68a' }
          : { border: '1px solid transparent' }
      }
    >
      <Icon
        className="w-4 h-4 shrink-0 mt-0.5"
        style={{ color: hasRecord ? accentColor : '#d1d5db' }}
      />
      <div className="min-w-0 flex-1">
        <div
          className="font-black text-base leading-tight"
          style={{ color: hasRecord ? '#1a1a2e' : '#d1d5db' }}
        >
          {hasRecord ? config.format(record!.record_value) : '—'}
        </div>
        <div
          className="text-[10px] font-bold leading-tight mt-0.5"
          style={{ color: '#9ca3af' }}
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

  const today = getTodayUTC();

  useEffect(() => {
    async function load() {
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
    }
    load();
  }, [selectedMode, playType, userId, today]);

  const color = MODE_COLORS[selectedMode];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Mode Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-3">
        {GAME_MODES_ORDERED.map((mode) => (
          <button
            key={mode}
            onClick={() => setSelectedMode(mode)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-extrabold whitespace-nowrap transition-all"
            style={{
              background: selectedMode === mode ? '#ffffff' : '#f3f0ff',
              border: selectedMode === mode ? `1.5px solid ${MODE_COLORS[mode]}` : '1.5px solid #ede9f6',
              color: selectedMode === mode ? MODE_COLORS[mode] : '#9ca3af',
            }}
          >
            {MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      {/* Solo/VS Toggle */}
      <div className="flex gap-2 mb-4">
        {(['solo', 'vs'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setPlayType(type)}
            className="flex-1 py-2 rounded-xl text-xs font-extrabold transition-all"
            style={{
              background: playType === type ? '#ffffff' : '#f3f0ff',
              border: playType === type ? '1.5px solid #7c3aed' : '1.5px solid #ede9f6',
              color: playType === type ? '#7c3aed' : '#9ca3af',
            }}
          >
            {type === 'solo' ? 'Solo' : 'VS'}
          </button>
        ))}
      </div>

      {/* Player Count + User Rank */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: '#9ca3af' }}>
          <Users className="w-3.5 h-3.5" />
          <span>{playerCount} player{playerCount !== 1 ? 's' : ''} today</span>
        </div>
        {userRank && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold" style={{ color: '#92400e' }}>Your rank:</span>
            <span className="font-black text-xs" style={{ color: '#d97706' }}>#{userRank.rank}</span>
            <span className="text-[10px] font-bold" style={{ color: '#92400e' }}>of {userRank.totalPlayers}</span>
          </div>
        )}
      </div>

      {/* Mode Card + Leaderboard */}
      <motion.div
        key={`${selectedMode}-${playType}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="overflow-hidden"
        style={{
          background: '#ffffff',
          border: '1.5px solid #ede9f6',
          borderRadius: '16px',
        }}
      >
        {/* Mode accent bar */}
        <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />

        {/* Mode header */}
        <div className="flex items-center gap-2.5 px-4 pt-3 pb-2" style={{ borderBottom: '1px solid #ede9f6' }}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}15` }}
          >
            <ModeIcon mode={selectedMode} color={color} />
          </div>
          <div>
            <div className="font-black text-sm" style={{ color: '#1a1a2e' }}>
              {MODE_LABELS[selectedMode]}
            </div>
            <div className="text-[10px] font-bold" style={{ color: '#9ca3af' }}>
              {playType === 'solo' ? 'Solo' : 'VS'} · Today
            </div>
          </div>
        </div>

        {/* Leaderboard rows */}
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-5 h-5 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin mb-2" />
            <p className="text-xs font-bold" style={{ color: '#9ca3af' }}>Loading...</p>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="p-8 text-center" style={{ color: '#9ca3af' }}>
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
                    background: isCurrentUser ? '#fffbeb' : rank <= 3 ? '#fafafa' : 'transparent',
                    borderBottom: '1px solid #f3f0ff',
                  }}
                >
                  <RankIcon rank={rank} />
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/profile/${entry.user_id}`}
                      className="text-xs font-extrabold truncate block hover:opacity-80 transition-opacity"
                      style={{ color: '#1a1a2e' }}
                    >
                      {entry.username}
                      {isCurrentUser && <span style={{ color: '#d97706' }}> (you)</span>}
                    </Link>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-xs" style={{ color: '#1a1a2e' }}>{entry.composite_score}</div>
                    <div className="text-[10px] font-bold" style={{ color: '#9ca3af' }}>
                      {playType === 'solo' ? (
                        <>
                          {entry.guess_count}G · {formatTime(entry.time_seconds)}
                          {entry.total_boards > 1 && ` · ${entry.boards_solved}/${entry.total_boards}`}
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
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   ALL-TIME RECORDS VIEW
   ═══════════════════════════════════════════════════════ */
function AllTimeRecordsView({ userId }: { userId?: string }) {
  const [records, setRecords] = useState<AllTimeRecord[]>([]);
  const [loading, setLoading] = useState(true);

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
      <div className="text-center py-16">
        <div className="inline-block w-6 h-6 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin mb-3" />
        <p className="text-xs font-bold" style={{ color: '#9ca3af' }}>Loading records...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Hall of Fame */}
      <div className="mb-5">
        <div
          className="text-[11px] font-extrabold uppercase mb-2"
          style={{ color: '#9ca3af', letterSpacing: '0.1em' }}
        >
          Hall of Fame
        </div>
        <motion.div
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="overflow-hidden"
          style={{
            background: '#ffffff',
            border: '1.5px solid #fde68a',
            borderRadius: '16px',
          }}
        >
          <div
            className="h-[3px]"
            style={{ background: 'linear-gradient(90deg, #f59e0b, #fde68a)' }}
          />
          <div
            className="mx-3 my-3 rounded-xl p-3"
            style={{ background: '#fffbeb', border: '1px solid #fef3c7' }}
          >
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
        </motion.div>
      </div>

      {/* By Game Mode */}
      <div>
        <div
          className="text-[11px] font-extrabold uppercase mb-2"
          style={{ color: '#9ca3af', letterSpacing: '0.1em' }}
        >
          By Game Mode
        </div>
        <div className="space-y-3">
          {GAME_MODES_ORDERED.map((mode, idx) => {
            const color = MODE_COLORS[mode];
            const modeRecords = modeRecordsMap.get(mode) || [];

            return (
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + idx * 0.06 }}
                className="overflow-hidden"
                style={{
                  background: '#ffffff',
                  border: '1.5px solid #ede9f6',
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
                    <ModeIcon mode={mode} color={color} />
                  </div>
                  <div className="font-black text-sm" style={{ color: '#1a1a2e' }}>
                    {MODE_LABELS[mode]}
                  </div>
                </div>
                <div
                  className="mx-3 mb-3 rounded-xl p-3"
                  style={{ background: '#f9fafb', border: '1px solid #f3f4f6' }}
                >
                  {modeRecords.length === 0 ? (
                    <div className="py-5 text-center">
                      <Trophy
                        className="w-7 h-7 mx-auto mb-1.5"
                        style={{ color: '#d1d5db' }}
                      />
                      <p className="text-[11px] font-extrabold" style={{ color: '#9ca3af' }}>
                        No records yet
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {PER_MODE_RECORD_TYPES.map((rt) => {
                        const record = modeRecords.find((r) => r.record_type === rt);
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
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════ */
export default function RecordsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'daily' | 'alltime'>('daily');

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#f8f7ff' }}>
      <AppHeader />

      <div className="max-w-lg mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-4"
        >
          <h1
            className="text-3xl font-black bg-clip-text text-transparent tracking-tight"
            style={{
              backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)',
            }}
          >
            RECORDS
          </h1>
          <p className="text-xs font-bold mt-1" style={{ color: '#9ca3af' }}>
            The best of the best across Wordocious
          </p>
        </motion.div>

        {/* Daily / All-Time Toggle */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setActiveTab('daily')}
            className="flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all"
            style={{
              background: activeTab === 'daily'
                ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
                : '#f3f0ff',
              border: activeTab === 'daily' ? '1.5px solid #7c3aed' : '1.5px solid #ede9f6',
              color: activeTab === 'daily' ? '#ffffff' : '#9ca3af',
              boxShadow: activeTab === 'daily' ? '0 3px 0 #4c1d95' : 'none',
            }}
          >
            Daily
          </button>
          <button
            onClick={() => setActiveTab('alltime')}
            className="flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all"
            style={{
              background: activeTab === 'alltime'
                ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
                : '#f3f0ff',
              border: activeTab === 'alltime' ? '1.5px solid #7c3aed' : '1.5px solid #ede9f6',
              color: activeTab === 'alltime' ? '#ffffff' : '#9ca3af',
              boxShadow: activeTab === 'alltime' ? '0 3px 0 #4c1d95' : 'none',
            }}
          >
            All-Time
          </button>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'daily' ? (
            <DailyRecordsView key="daily" userId={user?.id} />
          ) : (
            <AllTimeRecordsView key="alltime" userId={user?.id} />
          )}
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  );
}
