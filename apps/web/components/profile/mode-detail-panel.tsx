'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Swords } from 'lucide-react';
import { PROFILE_MODES, type ModeConfig } from './mode-picker';
import { ModeStatsCard } from './mode-stats-card';
import { ProInsightsCard } from './pro-insights-card';
import { GuessDistribution } from './guess-distribution';
import { SolveTimeChart } from './solve-time-chart';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';
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
}

interface ModeDetailPanelProps {
  userId: string;
  gameMode: string;
  isPro: boolean;
  stats: { wins: number; losses: number; total_games: number; best_score: number; fastest_time: number } | null;
}

export function ModeDetailPanel({ userId, gameMode, isPro, stats }: ModeDetailPanelProps) {
  const [tab, setTab] = useState<'solo' | 'vs'>('solo');
  const [data, setData] = useState<ModeData | null>(null);
  const [loading, setLoading] = useState(true);
  const cacheRef = useRef<Map<string, ModeData>>(new Map());

  const mode = PROFILE_MODES.find((m) => m.dbKey === gameMode);
  const accentColor = mode?.accentColor || '#7c3aed';
  const Icon = mode?.icon;

  useEffect(() => {
    const cached = cacheRef.current.get(gameMode);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      fetchGuessDistribution(userId, gameMode),
      fetchSolveTimeHistory(userId, 30, gameMode),
      fetchModeWinStreak(userId, gameMode),
      fetchTimeOfDayHeatmap(userId, gameMode),
      fetchImprovementTrend(userId, gameMode),
      fetchPersonalBests(userId, gameMode),
      fetchPerfectGameCount(userId, gameMode),
      fetchConsistencyScore(userId, gameMode),
      fetchHeadToHeadRecord(userId, gameMode),
    ]).then(([guessDist, solveHistory, winStreak, timeOfDay, improvement, personalBests, perfectGames, consistency, headToHead]) => {
      const modeData: ModeData = { guessDist, solveHistory, winStreak, timeOfDay, improvement, personalBests, perfectGames, consistency, headToHead };
      cacheRef.current.set(gameMode, modeData);
      setData(modeData);
      setLoading(false);
    });
  }, [userId, gameMode]);

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
