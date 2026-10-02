'use client';

import { useState } from 'react';
import { ChevronDown, Zap } from 'lucide-react';
import { WIN_FG } from '@/lib/tile-theme';
import { MODES, MODE_BY_DBKEY } from '@/lib/modes.generated';
import { MODE_CHROME } from '@/components/home/mode-chrome';
import { formatGuessStat } from '@/lib/format';
import type { Database } from '@/lib/database.types';
import { MascotEmptyState } from '@/components/ui/mascot';
import type { MascotId } from '@/lib/mascots';

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
  /** A host over the empty-state line (docs/MASCOT_SPEC.md §2, §6). */
  emptyHost?: MascotId;
  /** Today's Games: fold each game's Unlimited replays into one expandable row (founder, 2026-09-29). */
  groupUnlimited?: boolean;
}

/** Whether a match's `created_at` (UTC ISO-8601) falls on the viewer's local calendar day today. */
export function isPlayedToday(createdAt: string): boolean {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return false;
  return d.toDateString() === new Date().toDateString();
}

export function RecentMatchesList({ matches, opponentNames, profileId, loading, limit = 5, onSeeAll, emptyText = 'No games played yet.', emptyHost, groupUnlimited = false }: Props) {
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
    if (emptyHost) return <MascotEmptyState id={emptyHost} line={emptyText} className="py-6" />;
    return <div className="text-center py-8 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>{emptyText}</div>;
  }
  const shown = showAll && !onSeeAll ? matches : matches.slice(0, limit);
  return (
    <div className="space-y-2">
      {groupUnlimited
        ? groupToday(shown).map((it) => it.kind === 'row'
          ? <MatchRow key={it.match.id} match={it.match} opponentNames={opponentNames} profileId={profileId} />
          : <UnlimitedGroup key={`u-${it.mode}`} mode={it.mode} matches={it.matches} opponentNames={opponentNames} profileId={profileId} />)
        : shown.map((match) => <MatchRow key={match.id} match={match} opponentNames={opponentNames} profileId={profileId} />)}
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

function MatchRow({ match, opponentNames, profileId }: { match: Match; opponentNames: Record<string, string>; profileId: string }) {
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
}

type TodayItem = { kind: 'row'; match: Match } | { kind: 'group'; mode: string; matches: Match[] };

/** A solo Unlimited game (seed not daily); VS and dailies — and rows without a seed — stay individual. */
export const isUnlimitedSolo = (m: Pick<Match, 'player2_id' | 'seed'>) => !m.player2_id && typeof m.seed === 'string' && !m.seed.startsWith('daily-');

/** Newest-first rows with each game's Unlimited replays folded into one group at its newest game's place. */
function groupToday(matches: Match[]): TodayItem[] {
  const groups = new Map<string, Match[]>();
  for (const m of matches) if (isUnlimitedSolo(m)) groups.set(m.game_mode, [...(groups.get(m.game_mode) ?? []), m]);
  const out: TodayItem[] = [];
  const placed = new Set<string>();
  for (const m of matches) {
    const g = isUnlimitedSolo(m) ? groups.get(m.game_mode)! : null;
    if (!g || g.length < 2) { out.push({ kind: 'row', match: m }); continue; }
    if (placed.has(m.game_mode)) continue;
    placed.add(m.game_mode);
    out.push({ kind: 'group', mode: m.game_mode, matches: g });
  }
  return out;
}

function UnlimitedGroup({ mode, matches, opponentNames, profileId }: { mode: string; matches: Match[]; opponentNames: Record<string, string>; profileId: string }) {
  const [open, setOpen] = useState(false);
  const cfg = gameModeIcons[mode];
  const wins = matches.filter((m) => m.winner_id === profileId);
  const best = wins.map((m) => m.player1_time).filter((t) => t > 0).reduce((a, b) => Math.min(a, b), Infinity);
  return (
    <div className="space-y-2">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 p-3 text-left" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '12px' }} aria-expanded={open}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: cfg ? `${cfg.color}15` : 'var(--color-bg)' }}>
          {cfg?.romanNumeral ? <span className="text-[11px] font-black" style={{ color: cfg.color }}>{cfg.romanNumeral}</span>
            : cfg?.icon ? (() => { const Icon = cfg.icon!; return <Icon className="w-4 h-4" style={{ color: cfg.color }} />; })()
            : <Zap className="w-4 h-4" style={{ color: cfg?.color ?? '#d97706' }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-extrabold truncate" style={{ color: 'var(--color-text)' }}>{gameModeTitles[mode] || mode} Unlimited</div>
          <div className="text-[10px] font-bold truncate" style={{ color: 'var(--color-text-muted)' }}>
            {matches.length} played · {wins.length} win{wins.length === 1 ? '' : 's'}{Number.isFinite(best) ? ` · best ${formatDuration(best)}` : ''}
          </div>
        </div>
        <ChevronDown className="w-4 h-4 flex-shrink-0 transition-transform" style={{ color: 'var(--color-text-muted)', transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open && (
        <div className="space-y-2 pl-4">
          {matches.map((m) => <MatchRow key={m.id} match={m} opponentNames={opponentNames} profileId={profileId} />)}
        </div>
      )}
    </div>
  );
}
