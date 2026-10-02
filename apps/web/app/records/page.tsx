'use client';

import { CompletedDailyBoard } from '@/components/game/completed-daily-board';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Users, User, Swords, ChevronDown, ChevronUp, Share } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { formatScore, tieAwareScoreLabels, formatHintsLabel } from '@/lib/composite-scoring';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { modeByKey } from '@/components/profile/mode-picker';
import { RecordsBanner, type RecordsTab } from '@/components/leaderboard/records-banner';
import { Mascot } from '@/components/ui/mascot';
import { PAGE_HOSTS } from '@/lib/mascots';
import { BoardAvatar, BoardRow, RankIcon, SECTION_LABEL, SOFT_CARD, SegmentedPill, YOUR_ROW, YourRankCard } from '@/components/leaderboard/board-rows';
import { GameTileBar, GameTileChip, GameTileGlyph, gameTileSurface } from '@/components/ui/game-tile';
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

// Session-lived stale-while-revalidate cache for the Daily records view —
// same pattern as lbCache on /daily, with playType in the key (this view has
// a Solo/VS toggle). Mode/toggle taps repaint instantly; skeleton = first load.
const recordsLbCache = new Map<string, {
  lb: LeaderboardEntry[];
  count: number;
  rank: { rank: number; totalPlayers: number } | null;
}>();
// Same for the synthetic Sweep board, keyed day:user.
const recordsSweepCache = new Map<string, {
  lb: SweepEntry[];
  count: number;
  rank: { rank: number; totalPlayers: number } | null;
  details: Map<string, SweepDetails>;
}>();
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
const podiumCache = new Map<string, LeaderboardEntry[]>();
// The lifetime Sweep board, once loaded this session.
let allTimeSweepCache: AllTimeSweepEntry[] | null = null;

import {
  fetchAllTimeRecordsShared, peekAllTimeRecords, RECORD_LABELS, recordValue, recordLabel,
  PER_MODE_RECORD_TYPES, GLOBAL_RECORD_TYPES, formatRecordTime as formatTime,
} from '@/lib/records-ui';

// Caps section labels (records-redesign §2); the text stays mixed-case in the
// source so scripts/records-fold.test.ts can still find the sections.
const CAPS_LABEL: React.CSSProperties = { ...SECTION_LABEL, textTransform: 'uppercase' };

/**
 * One record (records-redesign §2): a soft white card — the record's icon in a
 * tile chip of the game's color, the record name (caps 10 / 900 gray), the value
 * big (20 / 900), the holder's avatar + name, and a small gold crown on records
 * you hold.
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
    <div className="relative flex flex-col gap-1.5 p-3" style={isCurrentUser && hasRecord ? { ...SOFT_CARD, ...YOUR_ROW, borderRadius: 14 } : SOFT_CARD}>
      {isCurrentUser && hasRecord && (
        <Icon3D name="crown" size={14} label="Your record" className="absolute top-2.5 right-2.5" />
      )}
      <div className="flex items-center gap-2 min-w-0">
        <GameTileChip accent={accentColor} width={28}>
          <Icon className="w-3.5 h-3.5" style={{ color: hasRecord ? accentColor : 'var(--color-text-muted)' }} />
        </GameTileChip>
        <span className="text-[10px] font-black uppercase leading-tight min-w-0" style={{ color: 'var(--color-text-secondary)', letterSpacing: 0.6 }}>
          {config.label}
        </span>
      </div>
      <div className="font-black leading-tight" style={{ fontSize: 20, color: hasRecord ? 'var(--color-record-value)' : 'var(--color-text-muted)' }}>
        {hasRecord ? recordValue(record!.record_type, record!.record_value, record!.game_mode) : '—'}
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
          <BoardAvatar url={record!.holder_avatar_url} name={record!.holder_username || '?'} size={20} />
          <span className="text-[11px] font-extrabold truncate" style={{ color: isCurrentUser ? '#d97706' : 'var(--color-text)' }}>
            {record!.holder_username || 'Unknown'}
          </span>
        </Link>
      )}
    </div>
  );
}

/** The game-tile CARD header (tint, border, top bar, chip, 15 / 900 name). */
function GameHeaderCard({ accent, glyph, title, sub, right, children }: {
  accent: string;
  glyph: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden mb-4" style={gameTileSurface(accent)}>
      <GameTileBar accent={accent} />
      <div className="px-3 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <GameTileChip accent={accent}>{glyph}</GameTileChip>
          <div className="flex-1 min-w-0">
            <div className="font-black truncate" style={{ fontSize: 15, color: 'var(--color-text)' }}>{title}</div>
            {sub != null && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{sub}</div>
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
      const lb = await fetchDailySweepLeaderboard(today, 50);
      if (seq !== loadSeq.current) return;
      setSweepLeaderboard(lb);
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
      const lb = await fetchDailyLeaderboard(selectedMode, playType, today, 50, 0, ids);
      if (seq !== loadSeq.current) return;
      setLeaderboard(lb);
      setPlayerCount(lb.length);
      setLoading(false);
      const idx = lb.findIndex((e) => e.user_id === userId);
      const rank = idx >= 0 ? { rank: idx + 1, totalPlayers: lb.length } : null;
      setUserRank(rank);
      recordsLbCache.set(cacheKey, { lb, count: lb.length, rank });
      return;
    }

    const [lb, count] = await Promise.all([
      fetchDailyLeaderboard(selectedMode, playType, today, 50),
      getDailyPlayerCount(selectedMode, today),
    ]);
    if (seq !== loadSeq.current) return;
    // Paint the rows the moment they arrive — the rank banner fills in on its
    // own instead of holding the whole list behind its extra queries.
    setLeaderboard(lb);
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

  // One Sweep row — records style (py-2.5); total score · total time ·
  // modes-won, with a GOLD "FLAWLESS" / VIOLET "SWEEP" pill.
  const renderSweepRow = (entry: SweepEntry, rank: number) => {
    const isCurrentUser = !!userId && entry.user_id === userId;
    const pillColor = entry.is_flawless ? '#d97706' : '#a78bfa';
    const det = sweepDetails.get(entry.user_id);
    return (
      <div key={entry.user_id} className="flex items-center gap-3 px-3 py-2.5" style={isCurrentUser ? YOUR_ROW : undefined}>
        <RankIcon rank={rank} />
        <BoardAvatar url={entry.avatar_url} name={entry.username} />
        {/* §236: same shell as the daily board's sweep row — score on the
            NAME line, stats owning the full width, dots + pill beneath. */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/profile/${entry.user_id}`}
              className="text-xs font-extrabold truncate block hover:opacity-80 transition-opacity flex-1 min-w-0"
              style={{ color: 'var(--color-text)' }}
            >
              {entry.username}
              {isCurrentUser && <span style={{ color: '#d97706' }}> (you)</span>}
            </Link>
            <span className="font-black text-[13px] shrink-0 tabular-nums" style={{ color: 'var(--color-text)' }}>
              {sweepScoreLabels.get(entry.total_score) ?? formatScore(entry.total_score)}
            </span>
          </div>
          {/* §232: daily-board parity — words-not-codes stats + the dot strip
              with the pill beside it (founder ask, Aug 24). */}
          {/* §246: wrap, never truncate — the hints segment fell off the end. */}
          <div className="text-[10px] font-bold leading-snug" style={{ color: 'var(--color-text-muted)' }}>
            {sweepStatsText(entry, det, today)}
          </div>
          <div className="flex items-center gap-1.5">
            <SweepModeDots details={det} day={today} />
            <span
              className="text-[9px] font-extrabold px-1.5 py-0.5 rounded shrink-0 mt-1"
              style={{ background: `${pillColor}22`, color: pillColor }}
            >
              {entry.is_flawless
                ? ((flawlessStreaks.get(entry.user_id) ?? 0) >= 2 ? `FLAWLESS ×${flawlessStreaks.get(entry.user_id)}` : 'FLAWLESS')
                : 'SWEEP'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Your rank card's points: your own row on the board in hand.
  const myPoints = (() => {
    if (!userId) return null;
    if (isSweep) {
      const e = sweepLeaderboard.find((r) => r.user_id === userId);
      return e ? sweepScoreLabels.get(e.total_score) ?? formatScore(e.total_score) : null;
    }
    const e = leaderboard.find((r) => r.user_id === userId);
    return e ? lbScoreLabels.get(e.composite_score) ?? formatScore(e.composite_score) : null;
  })();

  return (
    <div>
      <PullToRefresh onRefresh={loadData} accentColor={color}>
      {/* Per-game board card (records-redesign §2): the game-tile CARD header
          with the Solo | VS and Everyone | Friends pills and a bare share icon. */}
      <GameHeaderCard
        accent={color}
        glyph={<GameTileGlyph accent={color} icon={Icon} romanNumeral={mode.romanNumeral} />}
        title={mode.title}
        sub={
          <>
            <Users className="w-3 h-3 shrink-0" />
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
            <button
              onClick={handleShareLeaderboard}
              disabled={sharingLb}
              aria-label="Share leaderboard"
              className="p-1 -my-1 shrink-0 active:scale-95 transition-transform"
              style={{ color: 'var(--color-text-secondary)', opacity: sharingLb ? 0.4 : 1 }}
            >
              <Share className="w-4 h-4" />
            </button>
          ) : null
        }
      >
        {/* Solo/VS + Friends (per-mode only — Sweep is solo-only, cross-mode). */}
        {!isSweep && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <SegmentedPill
              label="Solo or VS"
              accent={color}
              value={playType}
              onChange={setPlayType}
              options={[
                ['solo', <><User className="w-3 h-3" />Solo</>],
                ['vs', <><Swords className="w-3 h-3" />VS</>],
              ] as const}
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

      {/* §254/§255: the completed-daily dropdown, in the soft card style. */}
      {!isSweep && (
        <SoftCompletedCards>
          <CompletedDailyBoard modeId={selectedMode} />
        </SoftCompletedCards>
      )}

      {/* Your rank, as on the Leaderboard. */}
      {userRank && (
        <YourRankCard
          rank={userRank.rank}
          ofLine={`OF ${userRank.totalPlayers} TODAY${userRank.totalPlayers > 1 ? ` · TOP ${Math.max(1, Math.round((userRank.rank / userRank.totalPlayers) * 100))}%` : ''}`}
          points={myPoints}
          delta={!isSweep ? <RankDeltaBadge mode={selectedMode} playType={playType} pageKey={friendsOnly && userId ? 'records-daily-friends' : 'records-daily'} currentRank={userRank.rank} /> : null}
        />
      )}

      <div className="mb-2 px-1" style={SECTION_LABEL}>TODAY&apos;S BOARD</div>
      {/* No fade on a mode switch: the new board is simply there in the tap's
          frame (founder, 2026-09-29; iOS/Android parity). */}
      <div key={`${selectedMode}-${playType}`} className="overflow-hidden p-1.5" style={SOFT_CARD}>
        {loading ? (
          <LeaderboardSkeleton />
        ) : isSweep ? (
          sweepLeaderboard.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
              <div className="flex justify-center mb-2"><Mascot id={PAGE_HOSTS.empty} size={96} motion="bob" /></div>
              <p className="text-xs font-bold">Nobody&apos;s swept today. Be the first!</p>
            </div>
          ) : (
            // Service already filters blocked; the RPC rank is authoritative.
            <div>{sweepLeaderboard.map((entry) => renderSweepRow(entry, entry.rank))}</div>
          )
        ) : leaderboard.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
            <div className="flex justify-center mb-2"><Mascot id={PAGE_HOSTS.empty} size={96} motion="bob" /></div>
            <p className="text-xs font-bold">No results yet today. Be the first!</p>
          </div>
        ) : (
          <div>
            {/* Blocked users are hidden client-side; ranks keep their
                original positions (holes where blocked rows were). */}
            {leaderboard
              .map((entry, index) => ({ entry, rank: index + 1 }))
              .filter(({ entry }) => !isBlocked(entry.user_id))
              .map(({ entry, rank }) => (
                <BoardRow
                  key={entry.user_id}
                  rank={rank}
                  userId={entry.user_id}
                  username={entry.username}
                  avatarUrl={entry.avatar_url}
                  avatarEmoji={entry.avatar_emoji}
                  isMe={!!userId && entry.user_id === userId}
                  stats={<RecordsRowStats entry={entry} mode={selectedMode} playType={playType} />}
                  score={lbScoreLabels.get(entry.composite_score) ?? formatScore(entry.composite_score)}
                />
              ))}
          </div>
        )}
      </div>

      {/* Yesterday's podium */}
      <YesterdayPodium mode={selectedMode} playType={playType} userId={userId} />
      </PullToRefresh>
    </div>
  );
}

/** A records row's stats line: solo guesses · time · boards · hints + W/L, or VS W/G. */
function RecordsRowStats({ entry, mode, playType }: { entry: LeaderboardEntry; mode: string; playType: 'solo' | 'vs' }) {
  if (playType === 'vs') return <span className="truncate">{entry.vs_wins}W / {entry.vs_games}G</span>;
  return (
    <>
      <span className="truncate">
        {guessRowLabel(MODE_BY_DBKEY[mode]?.guessSemantics ?? 'guesses', MODE_BY_DBKEY[mode]?.guessBase ?? 1, entry.guess_count)} · {formatTime(entry.time_seconds)}
        {entry.total_boards > 1 && ` · ${entry.boards_solved}/${entry.total_boards}`}
        {/* §254: hints ride this row exactly as on the daily leaderboard —
            the founder wants the two pages to match. */}
        {(() => {
          const h = formatHintsLabel(mode, entry.hints_used);
          return h ? ` · ${h}` : '';
        })()}
      </span>
      <span
        className="text-[9px] font-extrabold px-1.5 py-0.5 rounded shrink-0"
        style={{
          background: entry.completed ? 'var(--color-win-bg)' : 'var(--color-loss-bg)',
          color: entry.completed ? 'var(--color-win-text)' : 'var(--color-loss-text)',
        }}
      >
        {entry.completed ? 'Win' : 'Loss'}
      </span>
    </>
  );
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
    fetchDailyLeaderboard(mode, playType, yesterday, 5).then((r) => {
      podiumCache.set(podiumKey, r);
      if (active) setLanded((v) => v + 1);
    });
    return () => { active = false; };
  }, [mode, playType, yesterday, podiumKey]);

  const cachedTop3 = podiumCache.get(podiumKey);
  const top3 = cachedTop3 ?? [];
  if (cachedTop3 && top3.length === 0) return null;
  const podiumScoreLabels = tieAwareScoreLabels(top3.map((e) => e.composite_score));

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
      <div className="w-full mt-5 mb-2 flex items-center gap-1.5 px-1">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex-1 flex items-center gap-1.5 text-left"
          style={SECTION_LABEL}
        >
          YESTERDAY&apos;S WINNERS
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {/* Settled-podium share — only once the podium is open. */}
        {open && top3.length > 0 && (
          <button
            onClick={handleShare}
            disabled={sharing}
            aria-label="Share yesterday's podium"
            className="p-1 -my-1 active:scale-95 transition-transform"
            style={{ color: 'var(--color-text-secondary)', opacity: sharing ? 0.4 : 1 }}
          >
            <Share className="w-4 h-4" />
          </button>
        )}
      </div>
      {open && (
        <div className="overflow-hidden mb-4 p-1.5" style={SOFT_CARD}>
          {!cachedTop3 ? (
            <LeaderboardSkeleton />
          ) : (
            top3
              .map((entry, index) => ({ entry, rank: index + 1 }))
              .filter(({ entry }) => !isBlocked(entry.user_id))
              .map(({ entry, rank }) => (
                <BoardRow
                  key={entry.user_id}
                  rank={rank}
                  userId={entry.user_id}
                  username={entry.username}
                  avatarUrl={entry.avatar_url}
                  avatarEmoji={entry.avatar_emoji}
                  isMe={!!userId && entry.user_id === userId}
                  stats={<RecordsRowStats entry={entry} mode={mode} playType={playType} />}
                  score={podiumScoreLabels.get(entry.composite_score) ?? formatScore(entry.composite_score)}
                />
              ))
          )}
        </div>
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
  const [sweepBoard, setSweepBoard] = useState<AllTimeSweepEntry[] | null>(allTimeSweepCache);

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
      allTimeSweepCache = rows;
      if (active) setSweepBoard(rows);
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
      {/* Hall of Fame — each record a soft card (records-redesign §2). */}
      <div className="mb-5">
        <div className="mb-2 px-1" style={CAPS_LABEL}>Hall of Fame</div>
        <div className="grid grid-cols-2 gap-3">
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

      {/* By Game Mode — the game picked in the banner: a game-tile CARD header,
          then its records (or the all-time Sweep board) below. */}
      <div>
        <div className="mb-2 px-1" style={CAPS_LABEL}>By Game Mode</div>

        <GameHeaderCard
          key={selectedMode}
          accent={color}
          glyph={<GameTileGlyph accent={color} icon={Icon} romanNumeral={mode.romanNumeral} />}
          title={isSweep ? 'Sweep · All-Time' : mode.title}
          sub={isSweep ? 'Lifetime sweeps' : 'All-time bests'}
        />

        {isSweep ? (
          // All-time Sweep leaderboard — lifetime sweep count, flawless count,
          // and best (fastest) sweep time.
          <div className="overflow-hidden p-1.5" style={SOFT_CARD}>
            {sweepBoard === null ? (
              <LeaderboardSkeleton />
            ) : sweepBoard.length === 0 ? (
              <div className="py-5 text-center">
                <div className="flex justify-center mb-1.5"><Mascot id={PAGE_HOSTS.empty} size={96} motion="bob" /></div>
                <p className="text-[11px] font-extrabold" style={{ color: 'var(--color-text-muted)' }}>No sweeps yet</p>
              </div>
            ) : (
              // Service already filters blocked; the RPC rank is authoritative.
              sweepBoard.map((entry) => (
                <BoardRow
                  key={entry.user_id}
                  rank={entry.rank}
                  userId={entry.user_id}
                  username={entry.username}
                  avatarUrl={entry.avatar_url}
                  isMe={!!userId && entry.user_id === userId}
                  stats={<span className="truncate">{entry.flawless_count} flawless{entry.best_sweep_time ? ` · best ${formatTime(entry.best_sweep_time)}` : ''}</span>}
                  score={`${entry.sweep_count} sweep${entry.sweep_count !== 1 ? 's' : ''}`}
                />
              ))
            )}
          </div>
        ) : modeRecords.length === 0 ? (
          <div className="py-5 text-center" style={SOFT_CARD}>
            <div className="flex justify-center mb-1.5"><Mascot id={PAGE_HOSTS.empty} size={96} motion="bob" /></div>
            <p className="text-[11px] font-extrabold" style={{ color: 'var(--color-text-muted)' }}>No records yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
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
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--color-bg)' }}>
      <AppHeader />

      <div className="max-w-lg mx-auto px-4">
        {/* The Records banner (records-redesign §1): title, sub line, the
            DAILY | ALL-TIME switch and the game rows. Replaces the old header,
            toggle row and mode picker. */}
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

        <div className="flex flex-col items-center gap-2 mt-6">
          <Link href="/daily" className="text-[11px] font-black" style={{ color: '#7c3aed' }}>
            Today&apos;s boards → Leaderboard
          </Link>
          {/* D2 step 3 (2026-09-26): your own records live on the Stats tab now. */}
          <Link href="/stats?view=all-time" className="text-[11px] font-black" style={{ color: '#7c3aed' }}>
            Your personal records → Stats
          </Link>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
