'use client';

import { useState } from 'react';
import { Zap } from 'lucide-react';
import { WIN_FG } from '@/lib/tile-theme';
import { MODES, MODE_BY_DBKEY } from '@/lib/modes.generated';
import { MODE_CHROME } from '@/components/home/mode-chrome';
import { formatGuessStat } from '@/lib/format';
import type { Database } from '@/lib/database.types';

type Match = Database['public']['Tables']['matches']['Row'];

// Recent games — one row per match (solo and VS, daily and unlimited alike),
// newest first: the mode's icon, the stat through the mode's semantics, the
// time, the opponent, Win/Loss, date and time. Founder (2026-09-26): the same
// rows sit on the Today page ("the most recent games played, even the
// unlimited games") capped at five, and on All-time as the full list.

const gameModeTitles: Record<string, string> = {
  ...Object.fromEntries(MODES.filter((m) => m.dbKey).map((m) => [m.dbKey as string, m.title])),
  MULTI_DUEL: 'Multi Duel',
  TOURNAMENT: 'Tournament',
};
const gameModeIcons: Record<string, { icon: React.ComponentType<any> | null; romanNumeral?: string; color: string }> = Object.fromEntries(
  MODES.filter((m) => m.dbKey).map((m) => [
    m.dbKey as string,
    { icon: MODE_CHROME[m.id]?.icon ?? null, romanNumeral: m.romanNumeral ?? undefined, color: m.accentHex },
  ]),
);
const matchStat = (gameMode: string, score: number): string => {
  const meta = MODE_BY_DBKEY[gameMode];
  return formatGuessStat(meta?.guessSemantics ?? 'guesses', meta?.guessBase ?? 1, score);
};
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

interface Props {
  matches: Match[];
  opponentNames: Record<string, string>;
  profileId: string;
  loading: boolean;
  /** Rows shown before "View all" (Today: 5, no expander — `onSeeAll` instead). */
  limit?: number;
  /** Today's page: a "See all →" link instead of expanding in place. */
  onSeeAll?: () => void;
  /** Empty-state line (Today: "No games yet today…"). */
  emptyText?: string;
}

/** Whether a match's `created_at` (UTC ISO-8601) falls on the viewer's local calendar day today. */
export function isPlayedToday(createdAt: string): boolean {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return false;
  return d.toDateString() === new Date().toDateString();
}

export function RecentMatchesList({ matches, opponentNames, profileId, loading, limit = 5, onSeeAll, emptyText = 'No games played yet.' }: Props) {
  const [showAll, setShowAll] = useState(false);
  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].slice(0, limit).map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 animate-pulse" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '12px' }}>
            <div className="w-9 h-9 rounded-lg flex-shrink-0" style={{ background: 'var(--color-border)' }} />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="h-3 w-20 rounded" style={{ background: 'var(--color-border)' }} />
              <div className="h-2.5 w-28 rounded" style={{ background: 'var(--color-surface-hover)' }} />
            </div>
            <div className="flex-shrink-0 space-y-1.5 text-right">
              <div className="h-3 w-10 rounded ml-auto" style={{ background: 'var(--color-border)' }} />
              <div className="h-2.5 w-16 rounded ml-auto" style={{ background: 'var(--color-surface-hover)' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (matches.length === 0) {
    return <div className="text-center py-8 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>{emptyText}</div>;
  }
  const shown = showAll && !onSeeAll ? matches : matches.slice(0, limit);
  return (
    <div className="space-y-2">
      {shown.map((match) => {
        const isWinner = match.winner_id === profileId;
        const isPlayer1 = match.player1_id === profileId;
        const score = isPlayer1 ? match.player1_score : (match.player2_score ?? 0);
        const playerTime = isPlayer1 ? match.player1_time : (match.player2_time ?? 0);
        const matchDate = new Date(match.created_at);
        const cfg = gameModeIcons[match.game_mode];
        const opponentId = match.player2_id ? (isPlayer1 ? match.player2_id : match.player1_id) : null;
        const opponentName = opponentId ? (opponentNames[opponentId] ?? 'Unknown') : null;
        return (
          <div key={match.id} className="flex items-center gap-3 p-3" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '12px' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: cfg ? `${cfg.color}15` : 'var(--color-bg)' }}>
              {(() => {
                if (!cfg) return <Zap className="w-4 h-4" style={{ color: '#d97706' }} />;
                if (cfg.romanNumeral) return <span className="text-[11px] font-black" style={{ color: cfg.color }}>{cfg.romanNumeral}</span>;
                if (cfg.icon) { const Icon = cfg.icon; return <Icon className="w-4 h-4" style={{ color: cfg.color }} />; }
                return <Zap className="w-4 h-4" style={{ color: cfg.color }} />;
              })()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold truncate" style={{ color: 'var(--color-text)' }}>{gameModeTitles[match.game_mode] || match.game_mode}</span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded" style={{ background: match.player2_id ? '#ede9f6' : '#eff6ff', color: match.player2_id ? '#7c3aed' : '#2563eb' }}>
                  {match.player2_id ? 'VS' : 'Solo'}
                </span>
                {(match as any).forfeit && (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded" style={{ background: '#fef3c7', color: '#b45309' }}>FORFEIT</span>
                )}
              </div>
              <div className="text-[10px] font-bold truncate" style={{ color: 'var(--color-text-muted)' }}>
                {matchStat(match.game_mode, score)} · {playerTime > 0 ? formatDuration(playerTime) : '—'}
                {opponentName ? ` · vs ${opponentName}` : ''}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xs font-extrabold" style={{ color: isWinner ? WIN_FG : '#dc2626' }}>{isWinner ? 'Win' : 'Loss'}</div>
              <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                {matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {matchDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </div>
            </div>
          </div>
        );
      })}
      {matches.length > limit && (
        onSeeAll ? (
          <button onClick={onSeeAll} className="w-full mt-1 py-1 text-[11px] font-extrabold" style={{ color: '#7c3aed' }}>
            See all {matches.length} in All-time →
          </button>
        ) : (
          <button onClick={() => setShowAll((v) => !v)} className="w-full mt-2 py-1 text-[11px] font-extrabold" style={{ color: '#7c3aed' }}>
            {showAll ? 'Show less' : `View all ${matches.length} →`}
          </button>
        )
      )}
    </div>
  );
}
