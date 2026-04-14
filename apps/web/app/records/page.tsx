'use client';

import { useState, useEffect, useMemo } from 'react';
import { Trophy, Clock, Target, Flame, Crown, Zap, TrendingUp, Skull, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';
import { fetchAllTimeRecords, type AllTimeRecord } from '@/lib/daily-service';

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
  QUORDLE: null,
  OCTORDLE: null,
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
const PER_MODE_RECORD_TYPES = ['fastest_win', 'fewest_guesses', 'most_games_played', 'longest_streak'];
const GLOBAL_RECORD_TYPES = ['highest_level', 'most_gold_medals', 'most_daily_completions'];

/* ── record row component ── */
function RecordRow({
  record,
  accentColor,
  isCurrentUser,
}: {
  record: AllTimeRecord;
  accentColor: string;
  isCurrentUser: boolean;
}) {
  const config = RECORD_LABELS[record.record_type];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <div
      className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all"
      style={{
        background: isCurrentUser ? '#fffbeb' : 'transparent',
        border: isCurrentUser ? '1.5px solid #fde68a' : '1.5px solid transparent',
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: isCurrentUser ? '#fef9ec' : `${accentColor}15` }}
      >
        <Icon className="w-4 h-4" style={{ color: isCurrentUser ? '#d97706' : accentColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-extrabold text-xs" style={{ color: '#1a1a2e' }}>{config.label}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Link
            href={`/profile/${record.holder_id}`}
            className="text-[10px] font-bold hover:opacity-80 transition-opacity truncate"
            style={{ color: '#9ca3af' }}
          >
            {record.holder_username || 'Unknown'}
          </Link>
          {isCurrentUser && <Crown className="w-3 h-3 flex-shrink-0" style={{ color: '#d97706' }} />}
        </div>
      </div>
      <div className="font-black text-sm flex-shrink-0" style={{ color: '#1a1a2e' }}>
        {config.format(record.record_value)}
      </div>
    </div>
  );
}

/* ── empty record placeholder ── */
function EmptyRecordRow({ recordType }: { recordType: string }) {
  const config = RECORD_LABELS[recordType];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl opacity-40">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: '#f3f0ff' }}
      >
        <Icon className="w-4 h-4" style={{ color: '#c4b5fd' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-extrabold text-xs" style={{ color: '#9ca3af' }}>{config.label}</div>
        <div className="text-[10px] font-bold" style={{ color: '#c4b5fd' }}>No record yet</div>
      </div>
      <div className="font-black text-sm" style={{ color: '#c4b5fd' }}>—</div>
    </div>
  );
}

/* ── mode icon renderer ── */
function ModeIcon({ mode, color }: { mode: string; color: string }) {
  const Icon = MODE_ICONS[mode];
  const roman = MODE_ROMAN[mode];

  if (roman) {
    return (
      <span className="text-[11px] font-black leading-none" style={{ color }}>{roman}</span>
    );
  }
  if (Icon) {
    return <Icon className="w-4.5 h-4.5" style={{ color }} />;
  }
  return <Trophy className="w-4 h-4" style={{ color }} />;
}

/* ── main page ── */
export default function RecordsPage() {
  const { user } = useAuth();
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

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#f8f7ff' }}>
      <AppHeader />

      <div className="max-w-lg mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-5"
        >
          <h1 className="text-2xl font-black" style={{ color: '#1a1a2e' }}>All-Time Records</h1>
          <p className="text-xs font-bold mt-1" style={{ color: '#9ca3af' }}>
            The best of the best across Spellstrike
          </p>
        </motion.div>

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block w-6 h-6 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin mb-3" />
            <p className="text-xs font-bold" style={{ color: '#9ca3af' }}>Loading records...</p>
          </div>
        ) : (
          <>
            {/* ── Hall of Fame ── */}
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
                {/* Gold accent bar */}
                <div
                  className="h-[3px]"
                  style={{ background: 'linear-gradient(90deg, #f59e0b, #fde68a)' }}
                />
                <div className="p-2 space-y-0.5">
                  {GLOBAL_RECORD_TYPES.map((rt) => {
                    const record = globalRecords.find((r) => r.record_type === rt);
                    if (record) {
                      return (
                        <RecordRow
                          key={rt}
                          record={record}
                          accentColor="#d97706"
                          isCurrentUser={!!user && record.holder_id === user.id}
                        />
                      );
                    }
                    return <EmptyRecordRow key={rt} recordType={rt} />;
                  })}
                </div>
              </motion.div>
            </div>

            {/* ── By Game Mode ── */}
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
                      {/* Mode accent bar */}
                      <div
                        className="h-[3px]"
                        style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }}
                      />

                      {/* Mode header */}
                      <div className="flex items-center gap-2.5 px-4 pt-3 pb-1">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${color}15` }}
                        >
                          <ModeIcon mode={mode} color={color} />
                        </div>
                        <div>
                          <div className="font-black text-sm" style={{ color: '#1a1a2e' }}>
                            {MODE_LABELS[mode]}
                          </div>
                        </div>
                      </div>

                      {/* Records for this mode */}
                      <div className="px-1 pb-2 space-y-0.5">
                        {PER_MODE_RECORD_TYPES.map((rt) => {
                          const record = modeRecords.find((r) => r.record_type === rt);
                          if (record) {
                            return (
                              <RecordRow
                                key={rt}
                                record={record}
                                accentColor={color}
                                isCurrentUser={!!user && record.holder_id === user.id}
                              />
                            );
                          }
                          return <EmptyRecordRow key={rt} recordType={rt} />;
                        })}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
