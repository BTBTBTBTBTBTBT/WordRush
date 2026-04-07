'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Clock, Target, Flame, ArrowLeft, Crown, Zap } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-orange-700 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-yellow-400 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-pink-500 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400">
            ALL-TIME RECORDS
          </h1>
          <div className="w-6" />
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Records List */}
        {loading ? (
          <div className="text-center text-white/40 py-12">Loading records...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center text-white/40 py-12">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No records set yet in this category.</p>
            <p className="text-sm mt-1">Play games to set the first records!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((record, index) => {
              const config = RECORD_LABELS[record.record_type];
              if (!config) return null;
              const Icon = config.icon;
              const isCurrentUser = user && record.holder_id === user.id;

              return (
                <motion.div
                  key={record.id}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-white/5 backdrop-blur-sm rounded-xl p-4 border ${
                    isCurrentUser ? 'border-yellow-400/40 bg-yellow-500/10' : 'border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isCurrentUser ? 'bg-yellow-500/20' : 'bg-white/10'
                    }`}>
                      <Icon className={`w-5 h-5 ${isCurrentUser ? 'text-yellow-400' : 'text-white/60'}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-white font-bold text-sm">
                        {config.label}
                        {record.game_mode && (
                          <span className="text-white/40 ml-1">
                            — {MODE_LABELS[record.game_mode] || record.game_mode}
                          </span>
                        )}
                        {record.play_type && (
                          <span className="text-white/30 ml-1">({record.play_type})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Link
                          href={`/profile/${record.holder_id}`}
                          className="text-white/60 text-xs hover:text-yellow-400 transition-colors"
                        >
                          {record.holder_username || 'Unknown'}
                        </Link>
                        {isCurrentUser && (
                          <Crown className="w-3 h-3 text-yellow-400" />
                        )}
                        <span className="text-white/30 text-xs">
                          {new Date(record.achieved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-white font-black text-lg">{config.format(record.record_value)}</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
