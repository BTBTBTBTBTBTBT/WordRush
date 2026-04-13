'use client';

import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Trophy, Clock, Medal, Crown, Users, Calendar, ChevronDown, ChevronUp, Swords } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AuthModal } from '@/components/auth/auth-modal';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import {
  fetchDailyLeaderboard,
  getUserDailyRank,
  getDailyPlayerCount,
  getSecondsUntilMidnightUTC,
  getTodayUTC,
  type LeaderboardEntry,
} from '@/lib/daily-service';
import { CompletedDailyBoard } from '@/components/game/completed-daily-board';

const GAME_MODES = [
  { id: 'DUEL', label: 'Classic', href: '/practice' },
  { id: 'QUORDLE', label: 'QuadWord', href: '/quordle' },
  { id: 'OCTORDLE', label: 'OctoWord', href: '/octordle' },
  { id: 'SEQUENCE', label: 'Succession', href: '/sequence' },
  { id: 'RESCUE', label: 'Deliverance', href: '/rescue' },
  { id: 'GAUNTLET', label: 'Gauntlet', href: '/gauntlet' },
  { id: 'PROPERNOUNDLE', label: 'ProperNoundle', href: '/propernoundle' },
];

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
    <span className="font-mono text-xs font-bold" style={{ color: '#9ca3af' }}>
      <Clock className="w-3 h-3 inline mr-1" />
      {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
    </span>
  );
}

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-5 h-5" style={{ color: '#d97706' }} />;
  if (rank === 2) return <Medal className="w-5 h-5" style={{ color: '#9ca3af' }} />;
  if (rank === 3) return <Medal className="w-5 h-5" style={{ color: '#b45309' }} />;
  return <span className="text-xs font-black w-5 text-center" style={{ color: '#9ca3af' }}>{rank}</span>;
}

export default function DailyPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState('DUEL');
  const [playType, setPlayType] = useState<'solo' | 'vs'>('solo');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<{ rank: number; totalPlayers: number } | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showYesterday, setShowYesterday] = useState(false);
  const [yesterdayLeaderboard, setYesterdayLeaderboard] = useState<LeaderboardEntry[]>([]);

  const today = getTodayUTC();
  const yesterday = useMemo(() => {
    return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [lb, count] = await Promise.all([
        fetchDailyLeaderboard(selectedMode, playType, today, 50),
        getDailyPlayerCount(selectedMode, today),
      ]);
      setLeaderboard(lb);
      setPlayerCount(count);

      if (user) {
        const rank = await getUserDailyRank(user.id, selectedMode, playType, today);
        setUserRank(rank);
      }
      setLoading(false);
    }
    load();
  }, [selectedMode, playType, user, today]);

  useEffect(() => {
    if (showYesterday) {
      fetchDailyLeaderboard(selectedMode, playType, yesterday, 3).then(setYesterdayLeaderboard);
    }
  }, [showYesterday, selectedMode, playType, yesterday]);

  const modeConfig = GAME_MODES.find(m => m.id === selectedMode)!;

  const handlePlayDaily = () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    router.push(`${modeConfig.href}?daily=true`);
  };

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#f8f7ff' }}>
      <AppHeader />

      <div className="max-w-lg mx-auto px-4">
        {/* Title */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-black" style={{ color: '#1a1a2e' }}>Daily Challenge</h1>
          <div className="flex items-center justify-center gap-3 mt-1">
            <span className="text-xs font-bold" style={{ color: '#9ca3af' }}>
              <Calendar className="w-3 h-3 inline mr-1" />
              {new Date(today + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <CountdownTimer />
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-3">
          {GAME_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setSelectedMode(mode.id)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-extrabold whitespace-nowrap transition-all"
              style={{
                background: selectedMode === mode.id ? '#ffffff' : '#f3f0ff',
                border: selectedMode === mode.id ? '1.5px solid #7c3aed' : '1.5px solid #ede9f6',
                color: selectedMode === mode.id ? '#7c3aed' : '#9ca3af',
              }}
            >
              {mode.label}
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

        {/* Play CTA + Player Count */}
        <div
          className="flex items-center justify-between p-3.5 mb-4"
          style={{
            background: '#ffffff',
            border: '1.5px solid #ede9f6',
            borderRadius: '16px',
          }}
        >
          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: '#9ca3af' }}>
            <Users className="w-3.5 h-3.5" />
            <span>{playerCount} player{playerCount !== 1 ? 's' : ''} today</span>
          </div>
          <button
            onClick={handlePlayDaily}
            className="btn-3d px-4 py-2 rounded-lg text-white font-black text-xs"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              boxShadow: '0 3px 0 #92400e',
            }}
          >
            Play {modeConfig.label}
          </button>
        </div>

        {/* Completed Board Preview */}
        <CompletedDailyBoard modeId={selectedMode} />

        {/* User Rank */}
        {userRank && (
          <div
            className="text-center p-3 mb-4"
            style={{
              background: 'linear-gradient(135deg, #fffbeb, #fff7ed)',
              border: '1.5px solid #fde68a',
              borderRadius: '16px',
            }}
          >
            <span className="text-xs font-bold" style={{ color: '#92400e' }}>You're ranked </span>
            <span className="font-black text-lg" style={{ color: '#d97706' }}>#{userRank.rank}</span>
            <span className="text-xs font-bold" style={{ color: '#92400e' }}> of {userRank.totalPlayers}</span>
          </div>
        )}

        {/* Leaderboard */}
        <div className="section-header mb-2">LEADERBOARD</div>
        <div
          className="overflow-hidden"
          style={{
            background: '#ffffff',
            border: '1.5px solid #ede9f6',
            borderRadius: '16px',
          }}
        >
          {loading ? (
            <div className="p-8 text-center text-xs font-bold" style={{ color: '#9ca3af' }}>Loading...</div>
          ) : leaderboard.length === 0 ? (
            <div className="p-8 text-center text-xs font-bold" style={{ color: '#9ca3af' }}>
              No results yet. Be the first!
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
                      background: isCurrentUser ? '#fffbeb' : rank <= 3 ? '#fafafa' : 'transparent',
                      borderBottom: '1px solid #ede9f6',
                    }}
                  >
                    <MedalIcon rank={rank} />
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
                            {entry.guess_count} Guesses · {formatTime(entry.time_seconds)}
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
        </div>

        {/* Yesterday's Winners */}
        <button
          onClick={() => setShowYesterday(!showYesterday)}
          className="w-full mt-4 flex items-center justify-center gap-1.5 text-xs font-extrabold py-2 transition-colors"
          style={{ color: '#9ca3af' }}
        >
          Yesterday's Winners
          {showYesterday ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showYesterday && (
          <div
            className="overflow-hidden mb-4"
            style={{
              background: '#ffffff',
              border: '1.5px solid #ede9f6',
              borderRadius: '16px',
            }}
          >
            {yesterdayLeaderboard.length === 0 ? (
              <div className="p-6 text-center text-xs font-bold" style={{ color: '#9ca3af' }}>
                No results from yesterday
              </div>
            ) : (
              <div>
                {yesterdayLeaderboard.map((entry, index) => (
                  <div
                    key={entry.user_id}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: '1px solid #ede9f6' }}
                  >
                    <MedalIcon rank={index + 1} />
                    <span className="text-xs font-extrabold flex-1 truncate" style={{ color: '#1a1a2e' }}>{entry.username}</span>
                    <span className="text-xs font-black" style={{ color: '#9ca3af' }}>{entry.composite_score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <BottomNav />
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </div>
  );
}
