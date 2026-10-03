'use client';

import { CompletedDailyBoard } from '@/components/game/completed-daily-board';
import { CandySegment } from '@/components/ui/candy-segment';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Users, User, Swords } from 'lucide-react';
import { Icon3D, WinLossBadge } from '@/components/ui/icon3d';
import { HeaderGlyph } from '@/components/ui/header-glyph';
import { CandyLink } from '@/components/ui/candy-button';
import { SoftNum } from '@/components/ui/soft-number';
import { GameArt } from '@/components/ui/game-art';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { formatScore, tieAwareScoreLabels, formatHintsLabel } from '@/lib/composite-scoring';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { modeByKey } from '@/components/profile/mode-picker';
import { RecordsBanner, type RecordsTab } from '@/components/leaderboard/records-banner';
import { GAME_TITLE_ART_HEIGHT, PAGE_SCENES, gameTitleArtForDbKey, gameTitleArtLabel, type GameTitleArtName } from '@/lib/art';
import { ArtTitle } from '@/components/ui/art-title';
import {
  BoardAvatar, BoardCard, BoardRow, DisclosureHeader, ResultCard, RowBadge, SECTION_LABEL, SWEEP_BADGE_COL, SegmentedPill, SweepBadge, YOUR_ROW,
} from '@/components/leaderboard/board-rows';
import { boardAvatarFor } from '@/components/leaderboard/board-rows';
import { Podium, STAGE_GOLD, type PodiumPlace } from '@/components/leaderboard/podium';
import { rowBadge, solvedLine, splitPodium } from '@/lib/leaderboard-podium';
import { cardBarStyle, softCard } from '@/lib/soft-surface';
import { GameTileChip, GameTileGlyph } from '@/components/ui/game-tile';
import { SoftCompletedCards } from '@/components/game/collapsible-completed-card';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { guessRowLabel } from '@/lib/mode-stats';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { RankDeltaBadge } from '@/components/ui/rank-delta';
import { supabase } from '@/lib/supabase-client';
import { fetchBlockedIds, isBlocked } from '@/lib/moderation-service';
import { loadFriends, getFriendIds, onFriendsChange } from '@/lib/friends-service';
import { shareDailyLeaderboardCard, shareYesterdayPodiumCard } from '@/lib/leaderboard-share-flow';
import { SweepModeDots, sweepStatsText } from '@/components/leaderboard/sweep-mode-dots';
import {
  fetchAllTimeRecords,
  fetchDailyLeaderboard,
  fetchDailySweepLeaderboard,
  fetchSweepModeDetails,
  fetchFlawlessStreaks,
  fetchAllTimeSweepLeaderboard,
  getDailyPlayerCount,
  getUserDailyRank,
  getUserSweepRank,
  getTodayLocal,
  getYesterdayLocal,
  type AllTimeRecord,
  type LeaderboardEntry,
  type SweepEntry,
  type SweepDetails,
  type AllTimeSweepEntry,
} from '@/lib/daily-service';

const getMode = modeByKey;

// Stale-while-revalidate cache for the Daily records view — same pattern as
// lbCache on /daily, with playType in the key (this view has a Solo/VS
// toggle). Mode/toggle taps repaint instantly; skeleton = first load. BI19:
// persisted per user across reloads (lib/page-cache.ts); a failed fetch keeps it.
const recordsLbCache = persistentMap<{
  lb: LeaderboardEntry[];
  count: number;
  rank: { rank: number; totalPlayers: number } | null;
}>('records-lb', dayInKey);
// Same for the synthetic Sweep board, keyed day:user.
const recordsSweepCache = persistentMap<{
  lb: SweepEntry[];
  count: number;
  rank: { rank: number; totalPlayers: number } | null;
  details: Map<string, SweepDetails>;
}>('records-sweep', dayInKey);
const NO_DETAILS = new Map<string, SweepDetails>();

// Which board the fetched state belongs to (mode · Solo/VS · All/Friends · viewer).
// A tile tap changes the view in one render but the fetch — and its cache paint —
// runs in an effect after it, so that render showed the new mode's header over the
// previous mode's rows, count and rank (founder, 2026-09-29 screen recording; iOS
// 3edd33c2 parity). While the fetched state belongs to another view, the render
// paints this view's cached board, or the skeleton when there is none.
const recordsViewKey = (mode: string, playType: string, friends: boolean, userId: string | undefined) =>
  mode === 'SWEEP' ? `SWEEP|${userId ?? 'anon'}` : `${mode}|${playType}|${friends ? 'friends' : 'all'}|${userId ?? 'anon'}`;

// Yesterday's podium per mode · play type · day: settled, so the cache is exact.
const podiumCache = persistentMap<LeaderboardEntry[]>('records-podium');
// The lifetime Sweep board (persisted, BI19).
const allTimeSweepStore = persistentMap<AllTimeSweepEntry[]>('records-alltime-sweep');

import {
  fetchAllTimeRecordsShared, peekAllTimeRecords, RECORD_LABELS, recordValue, recordLabel,
  PER_MODE_RECORD_TYPES, GLOBAL_RECORD_TYPES, formatRecordTime as formatTime,
} from '@/lib/records-ui';
import { PageBackground } from '@/components/ui/page-background';
import { BrandEmptyState } from '@/components/ui/brand-empty-state';
import { dayInKey, persistentMap, sameData } from '@/lib/page-cache';

// Caps section labels (records-redesign §2); the text stays mixed-case in the
// source so scripts/records-fold.test.ts can still find the sections.
const CAPS_LABEL: React.CSSProperties = { ...SECTION_LABEL, textTransform: 'uppercase' };

/**
 * One record (records-redesign §2; FINISH_SPEC A1, A2): a card tinted in the
 * game's color (no plain white) — the record's icon in a tile chip, the record
 * name (caps 10 / 900), the value big in soft numbers, the holder's avatar +
 * name, and a small gold crown (and your soft-gold ring) on records you hold.
 */
function RecordCard({
  recordType,
  record,
  accentColor,
  isCurrentUser,
}: {
  recordType: string;
  record?: AllTimeRecord;
  accentColor: string;
  isCurrentUser: boolean;
}) {
  const config = RECORD_LABELS[recordType];
  if (!config) return null;
  const Icon = config.icon;
  const hasRecord = !!record;

  return (
    // BJ7: one top line (chip + name top-aligned), the value 4 under it; hugs its content.
    <div className="relative flex flex-col gap-1 px-3 py-2.5" style={isCurrentUser && hasRecord ? { ...softCard(accentColor), ...YOUR_ROW, borderRadius: 18 } : softCard(accentColor)}>
      {isCurrentUser && hasRecord && (
        <Icon3D name="crown" size={14} label="Your record" className="absolute top-2.5 right-2.5" />
      )}
      <div className="flex items-start gap-2 min-w-0">
        <GameTileChip accent={accentColor} width={28}>
          <Icon className="w-3.5 h-3.5" style={{ color: hasRecord ? accentColor : 'var(--color-text-muted)' }} />
        </GameTileChip>
        <span className="text-[10px] font-black uppercase leading-tight min-w-0 pr-4 line-clamp-2" style={{ color: 'var(--color-text-secondary)', letterSpacing: 0.6, minHeight: '2.5em' }}>
          {config.label}
        </span>
      </div>
      <div className="leading-tight">
        {hasRecord
          ? <SoftNum size={20}>{recordValue(record!.record_type, record!.record_value, record!.game_mode)}</SoftNum>
          : <span className="font-black" style={{ fontSize: 20, color: 'var(--color-text-muted)' }}>—</span>}
        {/* §254: hints on the record, same wording as the leaderboard rows. */}
        {hasRecord && record!.hints_used != null && record!.game_mode && (() => {
          const h = formatHintsLabel(record!.game_mode, record!.hints_used!);
          return h ? <span className="font-bold text-xs" style={{ color: 'var(--color-text-muted)' }}> · {h}</span> : null;
        })()}
      </div>
      {hasRecord && (
        <Link
          href={`/profile/${record!.holder_id}`}
          className="flex items-center gap-1.5 min-w-0 hover:opacity-80 transition-opacity"
        >
          <BoardAvatar url={record!.holder_avatar_url} name={record!.holder_username || '?'} userId={record!.holder_id} size={20} {...boardAvatarFor({ ...record!.holder_avatar, accent_color: record!.holder_accent })} />
          <span className="text-[11px] font-extrabold truncate" style={{ color: isCurrentUser ? '#d97706' : 'var(--color-text)' }}>
            {record!.holder_username || 'Unknown'}
          </span>
        </Link>
      )}
    </div>
  );
}

/**
 * The game card header (FINISH_SPEC C2's Play card look): tinted in the game's
 * color with its 10 px top bar, the title art (or, without one, the game's 3D
 * icon + name), the sub line, and the right-hand control.
 */
function GameHeaderCard({ accent, glyph, title, titleArt = null, sub, right, children }: {
  accent: string;
  glyph: React.ReactNode;
  title: React.ReactNode;
  /** ART_SPEC §10: the game's title art, drawn in place of the name text. */
  titleArt?: GameTitleArtName | null;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden mb-4" style={softCard(accent, { radius: 18 })}>
      <div aria-hidden="true" style={cardBarStyle(accent)} />
      <div style={{ padding: '10px 12px 12px' }}>
        <div className="flex items-center gap-3">
          {!titleArt && glyph}
          <div className="flex-1 min-w-0">
            {titleArt ? (
              <ArtTitle name={titleArt} label={gameTitleArtLabel(titleArt)} maxHeight={GAME_TITLE_ART_HEIGHT.playCard} maxWidth={2000} align="left" as="div" level={2} priority={false} motion="none" className="mb-0.5" />
            ) : (
              <div className="font-black truncate" style={{ fontSize: 17, color: 'var(--color-text)' }}>{title}</div>
            )}
            {sub != null && (
              <div className="flex items-center gap-1.5 text-[12px] font-extrabold" style={{ color: 'var(--color-text-secondary)' }}>{sub}</div>
            )}
          </div>
          {right}
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Skeleton loaders ── */
function LeaderboardSkeleton() {
  return (
    <div className="space-y-0">
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

function AllTimeSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{ background: 'var(--color-border)', borderRadius: 14, height: i === 1 ? '140px' : '100px' }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   DAILY RECORDS VIEW
   ═══════════════════════════════════════════════════════ */
function DailyRecordsView({ userId, selectedMode }: { userId?: string; selectedMode: string }) {
  const [playType, setPlayType] = useState<'solo' | 'vs'>('solo');
  // FRIENDS (§207): All|Friends filter — dense friend ranks, same query
  // restricted to friends∪me. Ghost rows live on /daily (the primary board).
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [friendsVersion, setFriendsVersion] = useState(0);
  useEffect(() => {
    if (!userId) {
      setFriendsOnly(false);
      return;
    }
    loadFriends().then(() => setFriendsVersion((v) => v + 1));
    return onFriendsChange(() => setFriendsVersion((v) => v + 1));
  }, [userId]);
  // Fetched board state — read through `board` below.
  const [lbState, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [sweepLbState, setSweepLeaderboard] = useState<SweepEntry[]>([]);
  // §232: dot-strip + guess/hint detail — daily-board parity (founder ask).
  const [sweepDetailsState, setSweepDetails] = useState<Map<string, SweepDetails>>(new Map());
  // §248: current flawless streaks for FLAWLESS rows.
  const [flawlessStreaks, setFlawlessStreaks] = useState<Map<string, number>>(new Map());
  const [countState, setPlayerCount] = useState(0);
  const [rankState, setUserRank] = useState<{ rank: number; totalPlayers: number } | null>(null);
  const [loadingState, setLoading] = useState(true);
  const [boardFor, setBoardFor] = useState<string | null>(null);

  const today = getTodayLocal();
  const viewKey = recordsViewKey(selectedMode, playType, friendsOnly && !!userId, userId);
  const board = (() => {
    if (boardFor === viewKey) {
      return { lb: lbState, sweep: sweepLbState, details: sweepDetailsState, count: countState, rank: rankState, loading: loadingState };
    }
    // Same cache keys as loadData.
    if (selectedMode === 'SWEEP') {
      const c = recordsSweepCache.get(`${today}:${userId ?? 'anon'}`);
      return { lb: [] as LeaderboardEntry[], sweep: c?.lb ?? [], details: c?.details ?? NO_DETAILS, count: c?.count ?? 0, rank: c?.rank ?? null, loading: !c };
    }
    const c = recordsLbCache.get(`${selectedMode}:${playType}:${today}:${userId ?? 'anon'}${friendsOnly && userId ? ':friends' : ''}`);
    return { lb: c?.lb ?? [], sweep: [] as SweepEntry[], details: NO_DETAILS, count: c?.count ?? 0, rank: c?.rank ?? null, loading: !c };
  })();
  const leaderboard = board.lb;
  const sweepLeaderboard = board.sweep;
  const sweepDetails = board.details;
  const playerCount = board.count;
  const userRank = board.rank;
  const loading = board.loading;
  // Drops late responses from a previous mode/toggle so a slow fetch can't
  // overwrite the selection the user has since switched to.
  const loadSeq = useRef(0);

  const loadData = useCallback(async () => {
    const seq = ++loadSeq.current;

    // Synthetic Sweep board — cross-mode daily sweep ranking (no Solo/VS split).
    if (selectedMode === 'SWEEP') {
      const sweepKey = `${today}:${userId ?? 'anon'}`;
      const cachedSweep = recordsSweepCache.get(sweepKey);
      setBoardFor(recordsViewKey('SWEEP', playType, false, userId));
      if (cachedSweep) {
        setSweepLeaderboard(cachedSweep.lb);
        setSweepDetails(cachedSweep.details);
        setPlayerCount(cachedSweep.count);
        setUserRank(cachedSweep.rank);
        setLoading(false);
      } else {
        setLoading(true);
        setUserRank(null);
        setSweepLeaderboard([]);
        setSweepDetails(new Map());
      }
      // Rank runs alongside the board; details and streaks load together (founder, 2026-09-29).
      const rankP = userId ? getUserSweepRank(userId, today) : Promise.resolve(null);
      let lb: SweepEntry[];
      try {
        lb = await fetchDailySweepLeaderboard(today, 50, 0, { throwOnError: true });
      } catch {
        // BI19: outage — keep the cached board, never blank it.
        if (seq === loadSeq.current) setLoading(false);
        return;
      }
      if (seq !== loadSeq.current) return;
      setSweepLeaderboard((prev) => (sameData(prev, lb) ? prev : lb));
      setLoading(false);
      // §248: only rows already FLAWLESS today can be on a live streak.
      const [details, streaks, rank] = await Promise.all([
        fetchSweepModeDetails(today, lb.map((e) => e.user_id)),
        fetchFlawlessStreaks(today, lb.filter((e) => e.is_flawless).map((e) => e.user_id)),
        rankP,
      ]);
      if (seq === loadSeq.current) { setSweepDetails(details); setFlawlessStreaks(streaks); if (userId) setUserRank(rank); }
      const count = rank?.totalPlayers ?? lb.length;
      if (seq === loadSeq.current) setPlayerCount(count);
      recordsSweepCache.set(sweepKey, { lb, count, rank, details });
      return;
    }

    const friends = friendsOnly && !!userId;
    const cacheKey = `${selectedMode}:${playType}:${today}:${userId ?? 'anon'}${friends ? ':friends' : ''}`;
    const cached = recordsLbCache.get(cacheKey);
    setBoardFor(recordsViewKey(selectedMode, playType, friends, userId));
    if (cached) {
      setLeaderboard(cached.lb);
      setPlayerCount(cached.count);
      setUserRank(cached.rank);
      setLoading(false);
    } else {
      setLoading(true);
      setUserRank(null);
      setLeaderboard([]);
    }

    // Friends board: one fetch holds the whole board, dense-ranked below.
    if (friends) {
      const ids = [...new Set([...getFriendIds(), userId!])];
      let lb: LeaderboardEntry[];
      try {
        lb = await fetchDailyLeaderboard(selectedMode, playType, today, 50, 0, ids, { throwOnError: true });
      } catch {
        if (seq === loadSeq.current) setLoading(false);
        return;
      }
      if (seq !== loadSeq.current) return;
      setLeaderboard((prev) => (sameData(prev, lb) ? prev : lb));
      setPlayerCount(lb.length);
      setLoading(false);
      const idx = lb.findIndex((e) => e.user_id === userId);
      const rank = idx >= 0 ? { rank: idx + 1, totalPlayers: lb.length } : null;
      setUserRank(rank);
      recordsLbCache.set(cacheKey, { lb, count: lb.length, rank });
      return;
    }

    let lb: LeaderboardEntry[];
    let count: number;
    try {
      [lb, count] = await Promise.all([
        fetchDailyLeaderboard(selectedMode, playType, today, 50, 0, undefined, { throwOnError: true }),
        getDailyPlayerCount(selectedMode, today, { throwOnError: true }),
      ]);
    } catch {
      // BI19: outage — keep the cached board, never blank it.
      if (seq === loadSeq.current) setLoading(false);
      return;
    }
    if (seq !== loadSeq.current) return;
    // Paint the rows the moment they arrive — the rank banner fills in on its
    // own instead of holding the whole list behind its extra queries.
    setLeaderboard((prev) => (sameData(prev, lb) ? prev : lb));
    setPlayerCount(count);
    setLoading(false);

    let rank: { rank: number; totalPlayers: number } | null = null;
    if (userId) {
      rank = await getUserDailyRank(userId, selectedMode, playType, today, lb, 50);
      if (seq === loadSeq.current) setUserRank(rank);
    }
    recordsLbCache.set(cacheKey, { lb, count, rank });
  }, [selectedMode, playType, userId, today, friendsOnly, friendsVersion]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const mode = getMode(selectedMode);
  const color = mode.accentColor;
  const Icon = mode.icon;
  const isSweep = selectedMode === 'SWEEP';

  // LEADERBOARD SHARE — this view owns the Solo/VS toggle, so its share button
  // is where the VS Battle card variant comes from. Sweep has no card design.
  const [sharingLb, setSharingLb] = useState(false);
  const handleShareLeaderboard = async () => {
    if (sharingLb || loading || isSweep) return;
    setSharingLb(true);
    try {
      await shareDailyLeaderboardCard({
        dbMode: selectedMode,
        playType,
        day: today,
        yesterday: getYesterdayLocal(),
        ranked: leaderboard
          .map((entry, index) => ({ entry, rank: index + 1 }))
          .filter(({ entry }) => !isBlocked(entry.user_id)),
        userId,
        userRank,
        userEntry: userId ? leaderboard.find((e) => e.user_id === userId) ?? null : null,
        friendIds: friendsOnly && userId ? [...getFriendIds()] : undefined,
      });
    } finally {
      setSharingLb(false);
    }
  };

  // TIE-AWARE score display: rows sharing a whole number render the decimals
  // that rank them (daily-page parity) — everything else stays integer.
  const lbScoreLabels = tieAwareScoreLabels(leaderboard.map((e) => e.composite_score));
  const sweepScoreLabels = tieAwareScoreLabels(sweepLeaderboard.map((e) => e.total_score));

  // One Sweep row — the daily board's shell (§232 parity): total score, the
  // words-not-codes stats (§246: wrap, never truncate), the dot strip under
  // them, and the GOLD "FLAWLESS" / VIOLET "SWEEP" pill in the badge column (C2a).
  const renderSweepRow = (entry: SweepEntry, rank: number, i: number) => {
    const det = sweepDetails.get(entry.user_id);
    return (
      <BoardRow
        key={entry.user_id}
        rank={rank}
        userId={entry.user_id}
        avatar={boardAvatarFor(entry)}
        username={entry.username}
        avatarUrl={entry.avatar_url}
        isMe={!!userId && entry.user_id === userId}
        stats={<span className="leading-snug">{sweepStatsText(entry, det, today)}</span>}
        below={<SweepModeDots details={det} day={today} />}
        badge={<SweepBadge flawless={entry.is_flawless} streak={flawlessStreaks.get(entry.user_id) ?? 0} />}
        badgeWidth={SWEEP_BADGE_COL}
        score={sweepScoreLabels.get(entry.total_score) ?? formatScore(entry.total_score)}
        stripe={i % 2 === 0}
        divider={i > 0}
      />
    );
  };

  // Your result card: your own row on the board in hand.
  const myEntry = userId && !isSweep ? leaderboard.find((r) => r.user_id === userId) ?? null : null;
  const mySweepEntry = userId && isSweep ? sweepLeaderboard.find((r) => r.user_id === userId) ?? null : null;
  const myPoints = mySweepEntry
    ? sweepScoreLabels.get(mySweepEntry.total_score) ?? formatScore(mySweepEntry.total_score)
    : myEntry ? lbScoreLabels.get(myEntry.composite_score) ?? formatScore(myEntry.composite_score) : null;
  const mySolved = (() => {
    if (mySweepEntry) return `${mySweepEntry.is_flawless ? 'Flawless' : 'Swept'} · ${sweepStatsText(mySweepEntry, sweepDetails.get(mySweepEntry.user_id), today)}`;
    if (!myEntry) return null;
    if (playType === 'vs') return `${myEntry.vs_wins}W / ${myEntry.vs_games}G`;
    const meta = MODE_BY_DBKEY[selectedMode];
    const line = solvedLine(meta?.guessSemantics ?? 'guesses', meta?.guessBase ?? 1, myEntry.guess_count, myEntry.time_seconds, myEntry.completed);
    const h = formatHintsLabel(selectedMode, myEntry.hints_used);
    return h ? `${line} · ${h}` : line;
  })();

  // C2: the podium for the top three, the rest as rows. Blocked users are
  // hidden client-side; ranks keep their original positions (holes where
  // blocked rows were). The sweep service already filters blocked users and
  // its RPC rank is authoritative.
  const lbSplit = splitPodium(
    leaderboard
      .map((entry, index) => ({ entry, rank: index + 1 }))
      .filter(({ entry }) => !isBlocked(entry.user_id)),
  );
  const sweepSplit = splitPodium(sweepLeaderboard.map((entry) => ({ entry, rank: entry.rank })));
  const lbPodium: PodiumPlace[] = lbSplit.podium.map(({ entry, rank }) => ({
    avatar: boardAvatarFor(entry),
    key: entry.user_id, rank, userId: entry.user_id, username: entry.username,
    avatarUrl: entry.avatar_url, avatarEmoji: entry.avatar_emoji, isMe: !!userId && entry.user_id === userId,
    points: lbScoreLabels.get(entry.composite_score) ?? formatScore(entry.composite_score),
    badge: rowBadge(entry, playType) ? <WinLossBadge won={entry.completed} size={15} /> : undefined,
    extra: <span className="text-[10px] font-bold text-center leading-tight" style={{ color: 'var(--color-text-secondary)' }}>{recordsStatsText(entry, selectedMode, playType)}</span>,
  }));
  const sweepPodium: PodiumPlace[] = sweepSplit.podium.map(({ entry, rank }) => ({
    avatar: boardAvatarFor(entry),
    key: entry.user_id, rank, userId: entry.user_id, username: entry.username,
    avatarUrl: entry.avatar_url, isMe: !!userId && entry.user_id === userId,
    points: sweepScoreLabels.get(entry.total_score) ?? formatScore(entry.total_score),
    extra: (
      <div className="flex flex-col items-center gap-1 max-w-full">
        <SweepBadge flawless={entry.is_flawless} streak={flawlessStreaks.get(entry.user_id) ?? 0} />
        <span className="text-[10px] font-bold text-center leading-tight" style={{ color: 'var(--color-text-secondary)' }}>
          {sweepStatsText(entry, sweepDetails.get(entry.user_id), today)}
        </span>
        <SweepModeDots details={sweepDetails.get(entry.user_id)} day={today} />
      </div>
    ),
  }));

  return (
    <div>
      <PullToRefresh onRefresh={loadData} accentColor={color}>
      {/* Per-game board card (records-redesign §2, C2 look): the tinted game
          card with the Solo | VS and Everyone | Friends pills and the bare
          3D share icon. */}
      <GameHeaderCard
        accent={color}
        glyph={<GameArt id={isSweep ? 'sweep' : mode.id} size={44} fallback={<GameTileGlyph accent={color} icon={Icon} romanNumeral={mode.romanNumeral} />} />}
        title={isSweep ? 'Daily Sweep' : mode.title}
        titleArt={isSweep ? null : gameTitleArtForDbKey(selectedMode)}
        sub={
          <>
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {isSweep
                ? `${playerCount} swept today`
                : `${playerCount} player${playerCount !== 1 ? 's' : ''} today`}
            </span>
          </>
        }
        right={
          // Share is per-mode only — Sweep has no card design here.
          !isSweep && !loading && leaderboard.length > 0 ? (
            <HeaderGlyph
              icon="share"
              size={20}
              label="Share leaderboard"
              onClick={handleShareLeaderboard}
              disabled={sharingLb}
              className="shrink-0"
              style={{ minWidth: 40, opacity: sharingLb ? 0.4 : 1 }}
            />
          ) : null
        }
      >
        {/* Solo/VS + Friends (per-mode only — Sweep is solo-only, cross-mode). */}
        {!isSweep && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {/* The candy toggle (night art 10-03 sprites, proposal 4). */}
            <CandySegment<'solo' | 'vs'>
              label="Solo or VS"
              value={playType}
              onChange={setPlayType}
              height={36}
              style={{ width: 150 }}
              options={[
                { key: 'solo', label: <><User className="w-3.5 h-3.5" aria-hidden="true" />Solo</> },
                { key: 'vs', label: <><Swords className="w-3.5 h-3.5" aria-hidden="true" />VS</> },
              ]}
            />
            {/* FRIENDS (§207). */}
            {userId && (
              <SegmentedPill
                label="Everyone or Friends"
                accent={color}
                value={friendsOnly}
                onChange={setFriendsOnly}
                options={[[false, 'Everyone'], [true, 'Friends']] as const}
              />
            )}
          </div>
        )}
      </GameHeaderCard>

      {/* C2: the ONE result card on gold, as on the Leaderboard. */}
      {userRank && (
        <ResultCard
          rank={userRank.rank}
          ofLine={`OF ${userRank.totalPlayers} TODAY${userRank.totalPlayers > 1 ? ` · TOP ${Math.max(1, Math.round((userRank.rank / userRank.totalPlayers) * 100))}%` : ''}`}
          solved={mySolved}
          points={myPoints}
          delta={!isSweep ? <RankDeltaBadge mode={selectedMode} playType={playType} pageKey={friendsOnly && userId ? 'records-daily-friends' : 'records-daily'} currentRank={userRank.rank} /> : null}
        />
      )}

      {/* §254/§255: your finished board, collapsible under the result. */}
      {!isSweep && (
        <SoftCompletedCards>
          <CompletedDailyBoard modeId={selectedMode} />
        </SoftCompletedCards>
      )}

      <div className="mb-2 px-1" style={SECTION_LABEL}>TODAY&apos;S BOARD</div>
      {/* No fade on a mode switch: the new board is simply there in the tap's
          frame (founder, 2026-09-29; iOS/Android parity). */}
      <BoardCard key={`${selectedMode}-${playType}`}>
        {loading ? (
          <LeaderboardSkeleton />
        ) : isSweep ? (
          sweepLeaderboard.length === 0 ? (
            <BrandEmptyState
              scene={PAGE_SCENES.empty}
              artHeight={96}
              accent="leaderboard"
              className="py-6"
              title="NO SWEEPS TODAY"
              line="Nobody's swept today. Be the first!"
              actionLabel="Play today's dailies"
              actionHref="/daily"
              actionColor="amber"
              actionIcon="play"
            />
          ) : (
            <div>
              <Podium places={sweepPodium} label="Top three sweepers" />
              {sweepSplit.rest.map(({ entry, rank }, i) => renderSweepRow(entry, rank, i + (sweepPodium.length > 0 ? 1 : 0)))}
            </div>
          )
        ) : leaderboard.length === 0 ? (
          <BrandEmptyState
            scene={PAGE_SCENES.empty}
            artHeight={96}
            accent="leaderboard"
            className="py-6"
            title="NO RESULTS YET"
            line="Nobody's finished today's puzzle. Be the first!"
            actionLabel="Play today's dailies"
            actionHref="/daily"
            actionColor="amber"
            actionIcon="play"
          />
        ) : (
          <div>
            <Podium places={lbPodium} accent={color} />
            {lbSplit.rest.map(({ entry, rank }, i) => (
              <BoardRow
                key={entry.user_id}
                rank={rank}
                userId={entry.user_id}
                avatar={boardAvatarFor(entry)}
                username={entry.username}
                avatarUrl={entry.avatar_url}
                avatarEmoji={entry.avatar_emoji}
                isMe={!!userId && entry.user_id === userId}
                stats={<span className="truncate">{recordsStatsText(entry, selectedMode, playType)}</span>}
                badge={<RowBadge kind={rowBadge(entry, playType)} />}
                score={lbScoreLabels.get(entry.composite_score) ?? formatScore(entry.composite_score)}
                stripe={(i + (lbPodium.length > 0 ? 1 : 0)) % 2 === 0}
                divider={i > 0 || lbPodium.length > 0}
              />
            ))}
          </div>
        )}
      </BoardCard>

      {/* Yesterday's podium */}
      <YesterdayPodium mode={selectedMode} playType={playType} userId={userId} />
      </PullToRefresh>
    </div>
  );
}

/**
 * A records row's stats line: solo guesses · time · boards · hints, or VS
 * W/G. The W / L badge is not here (C2a: it has its own column).
 */
function recordsStatsText(entry: LeaderboardEntry, mode: string, playType: 'solo' | 'vs'): string {
  if (playType === 'vs') return `${entry.vs_wins}W / ${entry.vs_games}G`;
  let s = `${guessRowLabel(MODE_BY_DBKEY[mode]?.guessSemantics ?? 'guesses', MODE_BY_DBKEY[mode]?.guessBase ?? 1, entry.guess_count)} · ${formatTime(entry.time_seconds)}`;
  if (entry.total_boards > 1) s += ` · ${entry.boards_solved}/${entry.total_boards}`;
  // §254: hints ride this row exactly as on the daily leaderboard — the
  // founder wants the two pages to match.
  const h = formatHintsLabel(mode, entry.hints_used);
  return h ? `${s} · ${h}` : s;
}

/* ═══════════════════════════════════════════════════════
   YESTERDAY'S PODIUM (collapsible)
   ═══════════════════════════════════════════════════════ */
function YesterdayPodium({ mode, playType, userId }: { mode: string; playType: 'solo' | 'vs'; userId?: string }) {
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [, setLanded] = useState(0);
  const yesterday = getYesterdayLocal();
  // Read by key in the render: a mode switch used to keep the previous mode's
  // podium on screen until this mode's fetch landed (founder, 2026-09-29).
  const podiumKey = `${mode}:${playType}:${yesterday}`;

  useEffect(() => {
    let active = true;
    fetchDailyLeaderboard(mode, playType, yesterday, 5, 0, undefined, { throwOnError: true }).then((r) => {
      podiumCache.set(podiumKey, r);
      if (active) setLanded((v) => v + 1);
    }).catch(() => { /* keep the cached podium */ });
    return () => { active = false; };
  }, [mode, playType, yesterday, podiumKey]);

  const cachedTop3 = podiumCache.get(podiumKey);
  const top3 = cachedTop3 ?? [];
  if (cachedTop3 && top3.length === 0) return null;
  const podiumScoreLabels = tieAwareScoreLabels(top3.map((e) => e.composite_score));
  const accent = modeByKey(mode)?.accentColor ?? STAGE_GOLD;
  const ySplit = splitPodium(
    top3
      .map((entry, index) => ({ entry, rank: index + 1 }))
      .filter(({ entry }) => !isBlocked(entry.user_id)),
  );
  const yPodium: PodiumPlace[] = ySplit.podium.map(({ entry, rank }) => ({
    avatar: boardAvatarFor(entry),
    key: entry.user_id, rank, userId: entry.user_id, username: entry.username,
    avatarUrl: entry.avatar_url, avatarEmoji: entry.avatar_emoji, isMe: !!userId && entry.user_id === userId,
    points: podiumScoreLabels.get(entry.composite_score) ?? formatScore(entry.composite_score),
    badge: rowBadge(entry, playType) ? <WinLossBadge won={entry.completed} size={15} /> : undefined,
    extra: <span className="text-[10px] font-bold text-center leading-tight" style={{ color: 'var(--color-text-secondary)' }}>{recordsStatsText(entry, mode, playType)}</span>,
  }));

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await shareYesterdayPodiumCard({
        dbMode: mode,
        playType,
        day: yesterday,
        ranked: top3
          .map((entry, index) => ({ entry, rank: index + 1 }))
          .filter(({ entry }) => !isBlocked(entry.user_id)),
        userId: userId ?? null,
      });
    } finally {
      setSharing(false);
    }
  };

  // Identical to the Leaderboard's YESTERDAY'S WINNERS (records-redesign §2).
  return (
    <>
      <DisclosureHeader
        label={<>YESTERDAY&apos;S WINNERS</>}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        right={
          // Settled-podium share — only once the podium is open.
          open && top3.length > 0 ? (
            <HeaderGlyph
              icon="share"
              size={20}
              label="Share yesterday's podium"
              onClick={handleShare}
              disabled={sharing}
              style={{ minWidth: 40, opacity: sharing ? 0.4 : 1 }}
            />
          ) : null
        }
      />
      {open && (
        <BoardCard className="mb-4">
          {!cachedTop3 ? (
            <LeaderboardSkeleton />
          ) : (
            // BJ4: yesterday's top three on the podium (open spots when fewer), the rest as rows.
            <div>
              <Podium places={yPodium} accent={accent} label="Yesterday's top three" />
              {ySplit.rest.map(({ entry, rank }, i) => (
                <BoardRow
                  key={entry.user_id}
                  rank={rank}
                  userId={entry.user_id}
                  avatar={boardAvatarFor(entry)}
                  username={entry.username}
                  avatarUrl={entry.avatar_url}
                  avatarEmoji={entry.avatar_emoji}
                  isMe={!!userId && entry.user_id === userId}
                  stats={<span className="truncate">{recordsStatsText(entry, mode, playType)}</span>}
                  badge={<RowBadge kind={rowBadge(entry, playType)} />}
                  score={podiumScoreLabels.get(entry.composite_score) ?? formatScore(entry.composite_score)}
                  stripe={(i + (yPodium.length > 0 ? 1 : 0)) % 2 === 0}
                  divider={i > 0 || yPodium.length > 0}
                />
              ))}
            </div>
          )}
        </BoardCard>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   ALL-TIME RECORDS VIEW
   ═══════════════════════════════════════════════════════ */
function AllTimeRecordsView({ userId, selectedMode, onCount }: { userId?: string; selectedMode: string; onCount: (n: number) => void }) {
  // The shared list paints in the first render when it already landed this
  // session — no skeleton frame on every Daily → All-Time switch.
  const [records, setRecords] = useState<AllTimeRecord[]>(() => peekAllTimeRecords() ?? []);
  const [loading, setLoading] = useState(() => peekAllTimeRecords() === null);
  // §245: one trophy-case card render/upload at a time.
  const [sharingShelf, setSharingShelf] = useState(false);
  const [sweepBoard, setSweepBoard] = useState<AllTimeSweepEntry[] | null>(() => allTimeSweepStore.get('all') ?? null);

  useEffect(() => {
    fetchAllTimeRecordsShared().then((data) => {
      setRecords(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  // The banner's "THE BEST EVER · N RECORDS" — the count of what's loaded.
  useEffect(() => {
    if (!loading) onCount(records.length);
  }, [loading, records.length, onCount]);

  // Lazily load the all-time Sweep board the first time SWEEP is selected.
  // The skeleton shows only until the first load; later visits paint the board
  // in hand while it refreshes (it used to drop to the skeleton on every tap).
  useEffect(() => {
    if (selectedMode !== 'SWEEP') return;
    let active = true;
    fetchAllTimeSweepLeaderboard(50).then((rows) => {
      // An empty read during an outage never replaces a board we have.
      if (rows.length === 0 && (allTimeSweepStore.get('all')?.length ?? 0) > 0) return;
      allTimeSweepStore.set('all', rows);
      if (active) setSweepBoard((b) => (sameData(b, rows) ? b : rows));
    }).catch(() => { if (active) setSweepBoard((b) => b ?? []); });
    return () => { active = false; };
  }, [selectedMode]);

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

  if (loading) {
    return (
      <div>
        <AllTimeSkeleton />
      </div>
    );
  }

  const mode = getMode(selectedMode);
  const color = mode.accentColor;
  const Icon = mode.icon;
  const isSweep = selectedMode === 'SWEEP';
  const modeRecords = modeRecordsMap.get(selectedMode) || [];

  return (
    <div>
      {/* Hall of Fame — each record a tinted card (records-redesign §2, A1). */}
      <div className="mb-3">
        <div className="mb-1.5 px-1" style={CAPS_LABEL}>Hall of Fame</div>
        <div className="grid grid-cols-2 gap-2.5">
          {GLOBAL_RECORD_TYPES.map((rt) => {
            const record = globalRecords.find((r) => r.record_type === rt);
            return (
              <RecordCard
                key={rt}
                recordType={rt}
                record={record}
                accentColor="#d97706"
                isCurrentUser={!!userId && record?.holder_id === userId}
              />
            );
          })}
        </div>
      </div>

      {/* By Game Mode — the game picked in the picker: the tinted game card
          header, then its records (or the all-time Sweep board) below. */}
      <div>
        <div className="mb-2 px-1" style={CAPS_LABEL}>By Game Mode</div>

        <GameHeaderCard
          key={selectedMode}
          accent={color}
          glyph={<GameArt id={isSweep ? 'sweep' : mode.id} size={44} fallback={<GameTileGlyph accent={color} icon={Icon} romanNumeral={mode.romanNumeral} />} />}
          title={isSweep ? 'Sweep · All-Time' : mode.title}
          titleArt={isSweep ? null : gameTitleArtForDbKey(selectedMode)}
          sub={isSweep ? 'Lifetime sweeps' : 'All-time bests'}
        />

        {isSweep ? (
          // All-time Sweep leaderboard — lifetime sweep count, flawless count,
          // and best (fastest) sweep time.
          <BoardCard>
            {sweepBoard === null ? (
              <LeaderboardSkeleton />
            ) : sweepBoard.length === 0 ? (
              <BrandEmptyState
                scene={PAGE_SCENES.empty}
                artHeight={80}
                accent="leaderboard"
                title="NO SWEEPS YET"
                line="Finish every daily in one day to land here."
              />
            ) : (
              // Service already filters blocked; the RPC rank is authoritative.
              // C2a: no single W / L here — the badge column stays, empty, so the totals line up.
              sweepBoard.map((entry, i) => (
                <BoardRow
                  key={entry.user_id}
                  rank={entry.rank}
                  userId={entry.user_id}
                  avatar={boardAvatarFor(entry)}
                  username={entry.username}
                  avatarUrl={entry.avatar_url}
                  isMe={!!userId && entry.user_id === userId}
                  stats={<span className="truncate">{entry.flawless_count} flawless{entry.best_sweep_time ? ` · best ${formatTime(entry.best_sweep_time)}` : ''}</span>}
                  score={`${entry.sweep_count} sweep${entry.sweep_count !== 1 ? 's' : ''}`}
                  stripe={i % 2 === 0}
                  divider={i > 0}
                />
              ))
            )}
          </BoardCard>
        ) : modeRecords.length === 0 ? (
          <BrandEmptyState
            scene={PAGE_SCENES.empty}
            artHeight={80}
            accent="leaderboard"
            title="NO RECORDS YET"
            line="Play this game and the first records are up for grabs."
          />
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {PER_MODE_RECORD_TYPES.map((rt) => {
              // A mode can have both a solo and a VS record per type; the
              // per-mode card represents solo play, so prefer the solo row
              // (else fall back to whatever exists). Otherwise e.g. Classic
              // "Most Games Played" could show the tiny VS count.
              const candidates = modeRecords.filter((r) => r.record_type === rt);
              const record = candidates.find((r) => r.play_type === 'solo') ?? candidates[0];
              return (
                <RecordCard
                  key={rt}
                  recordType={rt}
                  record={record}
                  accentColor={color}
                  isCurrentUser={!!userId && record?.holder_id === userId}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════ */
export default function RecordsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<RecordsTab>('daily');
  // Each view keeps its own game selection (the banner shows the active one).
  const [dailyMode, setDailyMode] = useState('DUEL');
  const [allTimeMode, setAllTimeMode] = useState('DUEL');
  const [recordsCount, setRecordsCount] = useState<number | null>(() => peekAllTimeRecords()?.length ?? null);
  // The local day on the client only (the banner's title waits for it).
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    setToday(getTodayLocal());
  }, []);

  // Load the signed-in user's block list (session-cached) so blocked users'
  // rows can be filtered out of the leaderboard renders below. The state bump
  // just forces a re-render (which cascades to the tab views) once it arrives.
  const [, setBlockedLoaded] = useState(false);
  useEffect(() => {
    if (user) fetchBlockedIds(user.id).then(() => setBlockedLoaded(true));
  }, [user]);

  const selectedMode = activeTab === 'daily' ? dailyMode : allTimeMode;
  const setSelectedMode = activeTab === 'daily' ? setDailyMode : setAllTimeMode;

  return (
    <PageBackground tint="leaderboard" className="min-h-screen pb-20">
      <AppHeader />

      <div className="max-w-lg mx-auto px-4">
        {/* A6 + C2: the ALL-TIME RECORDS headline, then the one game picker
            card (sub line + DAILY | ALL-TIME switch on top, the WORDOCIOUS row
            with the Sweep broom tile, then PUZZLES). */}
        <div className="mb-4">
          <RecordsBanner
            tab={activeTab}
            onTab={setActiveTab}
            today={today}
            recordsCount={recordsCount}
            selectedMode={selectedMode}
            onSelect={setSelectedMode}
          />
        </div>

        {/* Tab Content */}
        {activeTab === 'daily' ? (
          <DailyRecordsView key="daily" userId={user?.id} selectedMode={dailyMode} />
        ) : (
          <AllTimeRecordsView key="alltime" userId={user?.id} selectedMode={allTimeMode} onCount={setRecordsCount} />
        )}

        {/* A8: the two way-outs as quiet candy pills. */}
        <div className="flex flex-col items-center gap-2 mt-6">
          <CandyLink href="/daily" size="sm" color="peach">
            Today&apos;s boards → Leaderboard
          </CandyLink>
          {/* D2 step 3 (2026-09-26): your own records live on the Stats tab now. */}
          <CandyLink href="/stats?view=all-time" size="sm" color="peach">
            Your personal records → Stats
          </CandyLink>
        </div>
      </div>

      <BottomNav />
    </PageBackground>
  );
}
