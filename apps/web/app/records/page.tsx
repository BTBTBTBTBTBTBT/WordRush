'use client';

import { useState, useEffect } from 'react';
import { Trophy, Clock, Target, Flame, Crown, Zap } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { fetchAllTimeRecords, type AllTimeRecord } from '@/lib/daily-service';

const RECORD_LABELS: Record<string, { label: string; icon: typeof Trophy; format: (v: number) => string; category: string }> = {
  fastest_win: { label: 'Fastest Win', icon: Clock, format: (v) => `${v}s`, category: 'Speed' },
  fewest_guesses: { label: 'Fewest Guesses', icon: Target, format: (v) => `${v} guesses`, category: 'Efficiency' },
  most_games_played: { label: 'Most Games Played', icon: Zap, format: (v) => `${v} games`, category: 'Endurance' },
  longest_streak: { label: 'Longest Streak', icon: Flame, format: (v) => `${v} wins`, category: 'Endurance' },
  most_gold_medals: { label: 'Most Gold Medals', icon: Crown, format: (v) => `${v} golds`, category: 'Collection' },
  highest_level: { label: 'Highest Level', icon: Trophy, format: (v) => `Level ${v}`, category: 'Endurance' },
  most_daily_completions: { label: 'Most Dailies Completed', icon: Target, format: (v) => `${v} dailies`, category: 'Collection' },
};

const MODE_LABELS: Record<string, string> = {
  DUEL: 'Classic',
  QUORDLE: 'QuadWord',
  OCTORDLE: 'OctoWord',
  SEQUENCE: 'Succession',
  RESCUE: 'Deliverance',
  GAUNTLET: 'Gauntlet',
};

const CATEGORIES = ['Speed', 'Efficiency', 'Endurance', 'Collection'];

export default function RecordsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AllTimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('Speed');

  useEffect(() => {
    fetchAllTimeRecords().then((data) => {
      setRecords(data);
      setLoading(false);
    });
  }, []);

  const filteredRecords = records.filter((r) => {
    const config = RECORD_LABELS[r.record_type];
    return config?.category === activeCategory;
  });

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#0d0a1a' }}>
      <AppHeader />

      <div className="max-w-lg mx-auto px-4">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-black text-white">All-Time Records</h1>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-4">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="px-3.5 py-2 rounded-lg text-xs font-extrabold whitespace-nowrap transition-all"
              style={{
                background: activeCategory === cat ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                border: activeCategory === cat ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.08)',
                color: activeCategory === cat ? '#fff' : 'rgba(255,255,255,0.4)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Records List */}
        {loading ? (
          <div className="text-center py-12 text-xs font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Loading records...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-xs font-bold">No records set yet in this category.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRecords.map((record) => {
              const config = RECORD_LABELS[record.record_type];
              if (!config) return null;
              const Icon = config.icon;
              const isCurrentUser = user && record.holder_id === user.id;

              return (
                <div
                  key={record.id}
                  className="flex items-center gap-3 p-4"
                  style={{
                    background: isCurrentUser ? 'rgba(251,191,36,0.08)' : '#13102a',
                    border: isCurrentUser ? '1px solid rgba(251,191,36,0.25)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: isCurrentUser ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)' }}
                  >
                    <Icon className="w-5 h-5" style={{ color: isCurrentUser ? '#fbbf24' : 'rgba(255,255,255,0.4)' }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-white font-extrabold text-xs">
                      {config.label}
                      {record.game_mode && (
                        <span style={{ color: 'rgba(255,255,255,0.3)' }}> — {MODE_LABELS[record.game_mode] || record.game_mode}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Link
                        href={`/profile/${record.holder_id}`}
                        className="text-[10px] font-bold hover:opacity-80 transition-opacity"
                        style={{ color: 'rgba(255,255,255,0.4)' }}
                      >
                        {record.holder_username || 'Unknown'}
                      </Link>
                      {isCurrentUser && <Crown className="w-3 h-3" style={{ color: '#fbbf24' }} />}
                    </div>
                  </div>

                  <div className="text-white font-black text-base">{config.format(record.record_value)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
