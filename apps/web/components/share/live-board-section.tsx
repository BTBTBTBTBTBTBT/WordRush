'use client';

// LIVE BOARD section of the /s/ share landing page (LEADERBOARD SHARE
// Layer 2). Leaderboard share cards are snapshots of a live board, stamped
// "as of h:mm AM" — when a recipient opens the link while that board is still
// TODAY, staleness is the hook: show the CURRENT top 5 beneath the shared
// image so they see the board moving. Once the day has passed (or for the
// Podium kind, which is settled by definition) nothing is fetched — a single
// "final" line flows into the page's Play-today CTA instead.
//
// Day comparison uses the RECIPIENT'S local date (same getTodayLocal rule the
// daily boards run on), so everything here is gated behind a mounted state —
// the server renders nothing and the section appears client-side only, which
// also means any fetch failure can simply render nothing extra.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Crown, Medal } from 'lucide-react';
import {
  fetchDailyLeaderboard,
  fetchDailySweepLeaderboard,
  getTodayLocal,
  type LeaderboardEntry,
  type SweepEntry,
} from '@/lib/daily-service';
import { boardDayStatus, type LeaderboardShareKind } from '@/lib/share-page-copy';
import { formatScore } from '@/lib/composite-scoring';
import { formatShortTime as formatTime } from '@/lib/format';
import { MODES } from '@/lib/modes.generated';

interface LiveBoardSectionProps {
  kind: LeaderboardShareKind;
  /** ShareMode of the shared board ('Classic', 'Six', …) from ?lm= / the key. */
  lbMode?: string;
  /** The board's day (yyyy-mm-dd) from the storage-key path. */
  date?: string;
}

const TOP_N = 5;

// Same rank iconography as the /daily and /records boards (crown gold,
// silver/bronze medals, plain number below the podium).
function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-5 h-5" style={{ color: '#d97706' }} />;
  if (rank === 2) return <Medal className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />;
  if (rank === 3) return <Medal className="w-5 h-5" style={{ color: '#b45309' }} />;
  return (
    <span className="text-xs font-black w-5 text-center" style={{ color: 'var(--color-text-muted)' }}>
      {rank}
    </span>
  );
}

function SkeletonRows() {
  return (
    <div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5 animate-pulse">
          <div className="w-5 h-5 rounded-full" style={{ background: 'var(--color-border)' }} />
          <div className="flex-1 h-3 rounded" style={{ background: 'var(--color-border)' }} />
          <div className="w-12 h-3 rounded" style={{ background: 'var(--color-border)' }} />
        </div>
      ))}
    </div>
  );
}

// One board row — records-page styling (RankIcon · name · score over subline)
// so the live section reads as the same board the shared card snapshotted.
function BoardRow({ entry, rank, vs }: { entry: LeaderboardEntry; rank: number; vs: boolean }) {
  // W-L like the shared card's subline; vs_losses excludes draws, with the
  // games-minus-wins fallback for older rows.
  const losses = entry.vs_losses ?? Math.max(0, entry.vs_games - entry.vs_wins);
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5"
      style={{
        background: rank <= 3 ? 'var(--color-surface-alt)' : 'transparent',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <RankIcon rank={rank} />
      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${entry.user_id}`}
          className="text-xs font-extrabold truncate block hover:opacity-80 transition-opacity"
          style={{ color: 'var(--color-text)' }}
        >
          {entry.username}
        </Link>
      </div>
      <div className="text-right">
        <div className="font-black text-xs" style={{ color: 'var(--color-text)' }}>
          {formatScore(entry.composite_score)}
        </div>
        <div
          className="flex items-center justify-end gap-1.5 text-[10px] font-bold"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {vs ? (
            <span>{entry.vs_wins}-{losses} today</span>
          ) : (
            <>
              <span>
                {entry.guess_count}G · {formatTime(entry.time_seconds)}
                {entry.total_boards > 1 && ` · ${entry.boards_solved}/${entry.total_boards}`}
              </span>
              <span
                className="text-[9px] font-extrabold px-1.5 py-0.5 rounded"
                style={{
                  background: entry.completed ? 'var(--color-win-bg)' : 'var(--color-loss-bg)',
                  color: entry.completed ? 'var(--color-win-text)' : 'var(--color-loss-text)',
                }}
              >
                {entry.completed ? 'Win' : 'Loss'}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// SWEEP SHARE (§231): the live Sweep board row — rank/name/score with the
// same time · won · Sweep/Flawless subline the shared card carries.
function SweepBoardRow({ entry }: { entry: SweepEntry }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5"
      style={{
        background: entry.rank <= 3 ? 'var(--color-surface-alt)' : 'transparent',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <RankIcon rank={entry.rank} />
      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${entry.user_id}`}
          className="text-xs font-extrabold truncate block hover:opacity-80 transition-opacity"
          style={{ color: 'var(--color-text)' }}
        >
          {entry.username}
        </Link>
      </div>
      <div className="text-right">
        <div className="font-black text-xs" style={{ color: 'var(--color-text)' }}>
          {formatScore(entry.total_score)}
        </div>
        <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
          {formatTime(entry.total_time)} · {entry.modes_won}/9 · {entry.is_flawless ? 'Flawless' : 'Sweep'}
        </div>
      </div>
    </div>
  );
}

export default function LiveBoardSection({ kind, lbMode, date }: LiveBoardSectionProps) {
  // Mounted gate: today's date is the RECIPIENT'S local day, so it can only be
  // computed client-side — the server (and first client paint) render nothing,
  // which keeps hydration byte-identical.
  const [today, setToday] = useState<string | null>(null);
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);
  const [sweepRows, setSweepRows] = useState<SweepEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setToday(getTodayLocal());
  }, []);

  const status = today ? boardDayStatus(kind, date, today) : null;
  // The key's mode segment is the ShareMode (modes.generated title); the
  // leaderboard query wants the DB key ('DUEL', 'DUEL_6', …).
  const dbMode = MODES.find((m) => m.title === lbMode)?.dbKey ?? null;
  const playType = kind === 'VsLeaderboard' ? 'vs' : 'solo';
  // FRIENDS (§207): the recipient has different friends than the sharer, so a
  // "here's now" refetch of the GLOBAL board would contradict the card. No
  // live section — a friends-flavored invite line renders instead. The weekly
  // race (§234) is the same private-circle situation, so it joins this gate.
  const friendsKind = kind === 'FriendsBoard' || kind === 'FriendsPodium' || kind === 'WeeklyRace';
  // SWEEP SHARE (§231): the Sweep board is global (no mode key) — a live
  // SweepBoard refetches the sweep RPC; SweepPodium is final by definition.
  const sweepKind = kind === 'SweepBoard' || kind === 'SweepPodium';

  useEffect(() => {
    if (friendsKind || status !== 'live' || !date) return;
    let active = true;
    if (sweepKind) {
      fetchDailySweepLeaderboard(date, TOP_N)
        .then((r) => { if (active) setSweepRows(r); })
        .catch(() => { if (active) setFailed(true); });
    } else if (dbMode) {
      fetchDailyLeaderboard(dbMode, playType, date, TOP_N)
        .then((r) => { if (active) setRows(r); })
        .catch(() => { if (active) setFailed(true); });
    }
    return () => { active = false; };
  }, [friendsKind, sweepKind, status, dbMode, playType, date]);

  if (!status) return null;

  if (friendsKind) {
    return (
      <section style={{ width: 'min(92vw, 480px)', textAlign: 'center' }}>
        <p className="text-sm font-extrabold" style={{ color: 'var(--color-text)' }}>
          {kind === 'FriendsPodium'
            ? 'Their friends podium is settled'
            : kind === 'WeeklyRace'
              ? 'A private weekly race between friends'
              : 'A private race between friends'}
        </p>
        <p className="text-xs font-bold mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Add your friends on Wordocious and start your own
        </p>
      </section>
    );
  }

  if (status === 'final') {
    return (
      <section style={{ width: 'min(92vw, 480px)', textAlign: 'center' }}>
        <p className="text-sm font-extrabold" style={{ color: 'var(--color-text)' }}>
          {kind === 'Podium' || kind === 'SweepPodium' ? 'This podium is final' : 'This board is final'}
        </p>
        <p className="text-xs font-bold mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Today’s boards are open
        </p>
      </section>
    );
  }

  // Live board, but nothing to show: unknown mode (can't fetch), the fetch
  // failed, or the board came back empty — the page already stands on its own,
  // so render nothing rather than any error state.
  if (failed) return null;
  if (sweepKind ? sweepRows?.length === 0 : (!dbMode || rows?.length === 0)) return null;

  return (
    <section style={{ width: 'min(92vw, 480px)' }}>
      <p className="text-sm font-extrabold mb-2" style={{ color: 'var(--color-text)', textAlign: 'center' }}>
        That was the board at the time — here’s now
      </p>
      <div
        className="overflow-hidden"
        style={{
          background: 'var(--color-surface)',
          border: '1.5px solid var(--color-border)',
          borderRadius: 16,
        }}
      >
        {sweepKind
          ? (sweepRows === null
              ? <SkeletonRows />
              : sweepRows.slice(0, TOP_N).map((entry) => (
                  <SweepBoardRow key={entry.user_id} entry={entry} />
                )))
          : (rows === null
              ? <SkeletonRows />
              : rows.slice(0, TOP_N).map((entry, i) => (
                  <BoardRow key={entry.user_id} entry={entry} rank={i + 1} vs={playType === 'vs'} />
                )))}
      </div>
    </section>
  );
}
