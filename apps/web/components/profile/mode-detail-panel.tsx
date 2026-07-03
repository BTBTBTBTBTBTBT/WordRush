'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { User, Swords, Share2, Copy, Check } from 'lucide-react';
import { PROFILE_MODES, type ModeConfig } from './mode-picker';
import { ModeStatsCard } from './mode-stats-card';
import { ProInsightsCard } from './pro-insights-card';
import { TopWordsCard } from './top-words-card';
import { GuessDistribution } from './guess-distribution';
import { SolveTimeChart } from './solve-time-chart';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';
import { createInvite, vsHrefForMode } from '@/lib/invite-service';
import { useAuth } from '@/lib/auth-context';
import { ProDeepModeCard } from './pro-insights-deep';
import { fetchModeDetail } from '@/lib/stats-service';

interface ModeData {
  guessDist: Array<{ guesses: number; count: number }>;
  solveHistory: Array<{ date: string; timeSeconds: number; mode: string }>;
  winStreak: { current: number; best: number };
  timeOfDay: Array<{ hour: number; gamesPlayed: number; gamesWon: number }>;
  improvement: { recentAvg: number; overallAvg: number; percentChange: number; improving: boolean };
  personalBests: { fastestWin: { time: number; date: string } | null; fewestGuesses: { count: number; date: string } | null };
  perfectGames: number;
  consistency: { score: number; sampleSize: number };
  headToHead: { wins: number; losses: number; total: number; winRate: number };
  topWords: Array<{ word: string; count: number; wins: number }>;
  wordInsights: {
    nemesis: { word: string; losses: number } | null;
    luckyWord: { word: string; time: number } | null;
    avgGuesses: number;
    firstTryRate: number;
  };
}

interface ModeDetailPanelProps {
  userId: string;
  gameMode: string;
  isPro: boolean;
  stats: { wins: number; losses: number; total_games: number; best_score: number; fastest_time: number } | null;
  /** Driven by the page-level Solo/VS/VS CPU toggle — the panel has no toggle
      of its own (the old inner Solo/VS pair was redundant and confusing). */
  playType?: 'solo' | 'vs' | 'vs_cpu';
}

export function ModeDetailPanel({ userId, gameMode, isPro, stats, playType = 'solo' }: ModeDetailPanelProps) {
  const { user } = useAuth();
  const tab = playType;
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const mode = PROFILE_MODES.find((m) => m.dbKey === gameMode);
  const accentColor = mode?.accentColor || '#7c3aed';
  const Icon = mode?.icon;
  const isOwnProfile = user?.id === userId;

  const { data, isLoading: loading } = useSWR(
    ['mode-detail', userId, gameMode, playType],
    async () => {
      // Every per-game stat is scoped to the page-level play-type toggle
      // (restat B1) — previously these silently mixed solo + VS matches.
      // P6: one consolidated matches read replaces the old 11-fetcher burst.
      return (await fetchModeDetail(userId, gameMode, playType)) as ModeData;
    },
    { revalidateOnFocus: true },
  );

  useEffect(() => {
    setInviteCopied(false);
  }, [gameMode]);

  const handleChallenge = async () => {
    if (!user || inviteLoading) return;
    setInviteLoading(true);
    try {
      const { invite, error } = await createInvite({ inviterId: user.id, gameMode });
      if (invite?.invite_code) {
        const url = `${window.location.origin}/vs/join/${invite.invite_code}`;
        if (navigator.share) {
          await navigator.share({ title: `Challenge me in ${mode?.title}!`, url });
        } else {
          await navigator.clipboard.writeText(url);
          setInviteCopied(true);
          setTimeout(() => setInviteCopied(false), 2000);
        }
      }
    } catch {}
    setInviteLoading(false);
  };

  return (
    <div className="space-y-3">
      {/* Mode Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${accentColor}15` }}
          >
            {mode?.romanNumeral ? (
              <span className="text-[11px] font-black leading-none" style={{ color: accentColor }}>{mode.romanNumeral}</span>
            ) : Icon ? (
              <Icon className="w-4 h-4" style={{ color: accentColor }} />
            ) : null}
          </div>
          <span className="text-sm font-black" style={{ color: accentColor }}>{mode?.title || gameMode}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Challenge button (Pro only, own profile only) */}
          {isPro && isOwnProfile && (
            <button
              onClick={handleChallenge}
              disabled={inviteLoading}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold transition-all"
              style={{
                background: `${accentColor}15`,
                border: `1.5px solid ${accentColor}`,
                color: accentColor,
                opacity: inviteLoading ? 0.6 : 1,
              }}
            >
              {inviteCopied ? (
                <><Check className="w-3 h-3" /> Copied!</>
              ) : (
                <><Swords className="w-3 h-3" /> Challenge</>
              )}
            </button>
          )}

          {/* Play-type chip — reflects the page-level toggle (no inner toggle). */}
          <span
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold"
            style={{ background: `${accentColor}15`, color: accentColor }}
          >
            {tab === 'solo' ? <User className="w-3 h-3" /> : <Swords className="w-3 h-3" />}
            {tab === 'solo' ? 'Solo' : tab === 'vs' ? 'VS' : 'VS CPU'}
          </span>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          {/* Stats card skeleton — 4×2 grid */}
          <div className="p-4" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}>
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="h-5 w-8 rounded" style={{ background: 'var(--color-border)' }} />
                  <div className="h-2 w-10 rounded" style={{ background: 'var(--color-border)' }} />
                </div>
              ))}
            </div>
          </div>
          {/* Guess distribution skeleton — bars */}
          <div className="p-4" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}>
            <div className="h-2.5 w-24 rounded mb-3" style={{ background: 'var(--color-border)' }} />
            <div className="space-y-2">
              {[75, 100, 55, 30, 15, 8].map((w, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded" style={{ background: 'var(--color-border)' }} />
                  <div className="h-3 rounded-full" style={{ background: 'var(--color-border)', width: `${w}%` }} />
                </div>
              ))}
            </div>
          </div>
          {/* Chart skeleton */}
          <div className="p-4" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}>
            <div className="h-2.5 w-28 rounded mb-3" style={{ background: 'var(--color-border)' }} />
            <div className="h-[80px] rounded" style={{ background: 'var(--color-border)', opacity: 0.5 }} />
          </div>
        </div>
      )}

      {!loading && stats && (
        <>
          {/* Stats Card */}
          <ModeStatsCard
            wins={stats.wins}
            losses={stats.losses}
            totalGames={stats.total_games}
            bestScore={stats.best_score}
            fastestTime={stats.fastest_time}
            accentColor={accentColor}
            winStreak={data?.winStreak}
          />

          {/* Guess Distribution */}
          {/* Gauntlet: up to 50 guesses across 21 boards — a histogram is meaningless. */}
          {data && gameMode !== 'GAUNTLET' && <GuessDistribution data={data.guessDist} accentColor={accentColor} />}

          {/* Solve Time Trend */}
          {data && data.solveHistory.length >= 2 && (
            <SolveTimeChart data={data.solveHistory} accentColor={accentColor} />
          )}

          {/* Top Words */}
          {data && data.topWords.length > 0 && (
            <TopWordsCard words={data.topWords} accentColor={accentColor} />
          )}

          {/* Pro Insights */}
          {data && (
            <ProInsightsCard
              isPro={isPro}
              accentColor={accentColor}
              showVs={tab === 'vs'}
              personalBests={data.personalBests}
              winStreak={data.winStreak}
              timeOfDay={data.timeOfDay}
              consistency={data.consistency}
              improvement={data.improvement}
              perfectGames={data.perfectGames}
              headToHead={tab === 'vs' ? data.headToHead : null}
              wordInsights={data.wordInsights}
            />
          )}

          {/* Deep Insights (restat R4): opener yield, position accuracy,
              stage breakdown (Gauntlet), hints, Word Almanac. */}
          <ProDeepModeCard userId={userId} gameMode={gameMode} isPro={isPro} accentColor={accentColor} playType={playType} />

          {/* CPU practice writes aggregate totals only — per-game charts have
              no data to draw from, so say so instead of showing blanks. */}
          {playType === 'vs_cpu' && (
            <p className="text-[11px] font-bold text-center py-2" style={{ color: 'var(--color-text-muted)' }}>
              CPU practice records totals only — per-game charts track Solo and VS matches.
            </p>
          )}
        </>
      )}

      {!loading && !stats && (
        <div
          className="p-6 text-center"
          style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
        >
          <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
            No {tab === 'solo' ? 'solo' : tab === 'vs' ? 'VS' : 'VS CPU'} games played in this mode yet
          </p>
        </div>
      )}
    </div>
  );
}
