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
import {
  fetchGuessDistribution,
  fetchSolveTimeHistory,
  fetchModeWinStreak,
  fetchTimeOfDayHeatmap,
  fetchImprovementTrend,
  fetchPersonalBests,
  fetchPerfectGameCount,
  fetchConsistencyScore,
  fetchHeadToHeadRecord,
  fetchTopWords,
  fetchWordInsights,
} from '@/lib/stats-service';

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
}

export function ModeDetailPanel({ userId, gameMode, isPro, stats }: ModeDetailPanelProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<'solo' | 'vs'>('solo');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const mode = PROFILE_MODES.find((m) => m.dbKey === gameMode);
  const accentColor = mode?.accentColor || '#7c3aed';
  const Icon = mode?.icon;
  const isOwnProfile = user?.id === userId;

  const { data, isLoading: loading } = useSWR(
    ['mode-detail', userId, gameMode],
    async () => {
      const [guessDist, solveHistory, winStreak, timeOfDay, improvement, personalBests, perfectGames, consistency, headToHead, topWords, wordInsights] = await Promise.all([
        fetchGuessDistribution(userId, gameMode),
        fetchSolveTimeHistory(userId, 30, gameMode),
        fetchModeWinStreak(userId, gameMode),
        fetchTimeOfDayHeatmap(userId, gameMode),
        fetchImprovementTrend(userId, gameMode),
        fetchPersonalBests(userId, gameMode),
        fetchPerfectGameCount(userId, gameMode),
        fetchConsistencyScore(userId, gameMode),
        fetchHeadToHeadRecord(userId, gameMode),
        fetchTopWords(userId, gameMode, 5),
        fetchWordInsights(userId, gameMode),
      ]);
      return { guessDist, solveHistory, winStreak, timeOfDay, improvement, personalBests, perfectGames, consistency, headToHead, topWords, wordInsights } as ModeData;
    },
    { revalidateOnFocus: false },
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

          {/* Solo / VS toggle */}
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ border: '1.5px solid var(--color-border)' }}
          >
            {(['solo', 'vs'] as const).map((t) => (
              <button
                key={t}
                className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-extrabold transition-all"
                style={{
                  background: tab === t ? `${accentColor}15` : 'var(--color-surface)',
                  color: tab === t ? accentColor : 'var(--color-text-muted)',
                }}
                onClick={() => setTab(t)}
              >
                {t === 'solo' ? <User className="w-3 h-3" /> : <Swords className="w-3 h-3" />}
                {t === 'solo' ? 'Solo' : 'VS'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{ background: 'var(--color-border)', borderRadius: '16px', height: i === 1 ? '120px' : '80px' }}
            />
          ))}
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
          {data && <GuessDistribution data={data.guessDist} accentColor={accentColor} />}

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
        </>
      )}

      {!loading && !stats && (
        <div
          className="p-6 text-center"
          style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
        >
          <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
            No {tab} games played in this mode yet
          </p>
        </div>
      )}
    </div>
  );
}
