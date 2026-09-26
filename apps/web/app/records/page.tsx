'use client';

import { CompletedDailyBoard } from '@/components/game/completed-daily-board';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Trophy, Clock, Target, Flame, Crown, Zap, Medal, Users, User, Swords, Sparkles, TrendingUp, ChevronDown, Star, Share } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { formatScore, tieAwareScoreLabels, formatHintsLabel } from '@/lib/composite-scoring';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ModePicker, PROFILE_MODES, SWEEP_MODE, modeByKey } from '@/components/profile/mode-picker';
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

import {
  fetchAllTimeRecordsShared, RECORD_LABELS, recordValue, recordLabel,
  PER_MODE_RECORD_TYPES, GLOBAL_RECORD_TYPES, formatRecordTime as formatTime,
} from '@/lib/records-ui';

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-5 h-5" style={{ color: '#d97706' }} />;
  if (rank === 2) return <Medal className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />;
  if (rank === 3) return <Medal className="w-5 h-5" style={{ color: '#b45309' }} />;
  return <span className="text-xs font-black w-5 text-center" style={{ color: 'var(--color-text-muted)' }}>{rank}</span>;
}

function StatCell({
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
    <div
      className="flex items-start gap-2.5 p-2 rounded-lg"
      style={
        isCurrentUser && hasRecord
          ? { background: 'var(--color-highlight-gold)', border: '1px solid var(--color-gold-border)' }
          : { border: '1px solid transparent' }
      }
    >
      <Icon
        className="w-4 h-4 shrink-0 mt-0.5"
        style={{ color: hasRecord ? accentColor : 'var(--color-text-muted)' }}
      />
      <div className="min-w-0 flex-1">
        <div
          className="font-black text-base leading-tight"
          style={{ color: hasRecord ? 'var(--color-text)' : 'var(--color-text-muted)' }}
        >
          {hasRecord ? recordValue(record!.record_type, record!.record_value, record!.game_mode) : '—'}
          {/* §254: hints on the record cell, same wording as the leaderboard rows. */}
          {hasRecord && record!.hints_used != null && record!.game_mode && (() => {
            const h = formatHintsLabel(record!.game_mode, record!.hints_used!);
            return h ? <span className="font-bold text-xs" style={{ color: 'var(--color-text-muted)' }}> · {h}</span> : null;
          })()}
        </div>
        <div
          className="text-[10px] font-bold leading-tight mt-0.5"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {config.label}
        </div>
        {hasRecord && (
          <Link
            href={`/profile/${record!.holder_id}`}
            className="text-[10px] font-extrabold leading-tight mt-1 flex items-center gap-1 hover:opacity-80 transition-opacity"
            style={{ color: isCurrentUser ? '#d97706' : accentColor }}
          >
            <span className="truncate">{record!.holder_username || 'Unknown'}</span>
            {isCurrentUser && <Crown className="w-2.5 h-2.5 shrink-0" />}
          </Link>
        )}
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
          style={{ background: 'var(--color-border)', borderRadius: '16px', height: i === 1 ? '140px' : '100px' }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   DAILY RECORDS VIEW
   ═══════════════════════════════════════════════════════ */
function DailyRecordsView({ userId }: { userId?: string }) {
  const [selectedMode, setSelectedMode] = useState('DUEL');
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
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [sweepLeaderboard, setSweepLeaderboard] = useState<SweepEntry[]>([]);
  // §232: dot-strip + guess/hint detail — daily-board parity (founder ask).
  const [sweepDetails, setSweepDetails] = useState<Map<string, SweepDetails>>(new Map());
  // §248: current flawless streaks for FLAWLESS rows.
  const [flawlessStreaks, setFlawlessStreaks] = useState<Map<string, number>>(new Map());
  const [playerCount, setPlayerCount] = useState(0);
  const [userRank, setUserRank] = useState<{ rank: number; totalPlayers: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const today = getTodayLocal();
  // Drops late responses from a previous mode/toggle so a slow fetch can't
  // overwrite the selection the user has since switched to.
  const loadSeq = useRef(0);

  const loadData = useCallback(async () => {
    const seq = ++loadSeq.current;

    // Synthetic Sweep board — cross-mode daily sweep ranking (no Solo/VS split).
    if (selectedMode === 'SWEEP') {
      setLoading(true);
      setUserRank(null);
      const lb = await fetchDailySweepLeaderboard(today, 50);
      if (seq !== loadSeq.current) return;
      setSweepLeaderboard(lb);
      setLoading(false);
      const details = await fetchSweepModeDetails(today, lb.map((e) => e.user_id));
      if (seq === loadSeq.current) setSweepDetails(details);
      // §248: only rows already FLAWLESS today can be on a live streak.
      const streaks = await fetchFlawlessStreaks(today, lb.filter((e) => e.is_flawless).map((e) => e.user_id));
      if (seq === loadSeq.current) setFlawlessStreaks(streaks);
      let rank: { rank: number; totalPlayers: number } | null = null;
      if (userId) {
        rank = await getUserSweepRank(userId, today);
        if (seq === loadSeq.current) setUserRank(rank);
      }
      if (seq === loadSeq.current) setPlayerCount(rank?.totalPlayers ?? lb.length);
      return;
    }

    const friends = friendsOnly && !!userId;
    const cacheKey = `${selectedMode}:${playType}:${today}:${userId ?? 'anon'}${friends ? ':friends' : ''}`;
    const cached = recordsLbCache.get(cacheKey);
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
      <div
        key={entry.user_id}
        className="flex items-center gap-3 px-4 py-2.5"
        style={{
          background: isCurrentUser ? 'var(--color-highlight-gold)' : rank <= 3 ? 'var(--color-surface-alt)' : 'transparent',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <RankIcon rank={rank} />
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
            <span className="font-black text-xs shrink-0" style={{ color: 'var(--color-text)' }}>
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

  return (
    <div className="animate-fade-in-up">
      {/* Mode Picker */}
      <div className="mb-3">
        <ModePicker
          grid
          includeSweep
          showAll={false}
          selectedMode={selectedMode}
          onSelectMode={(m) => setSelectedMode(m || 'DUEL')}
        />
      </div>

      <PullToRefresh onRefresh={loadData} accentColor={color}>
      {/* Leaderboard Card */}
      <div
        key={`${selectedMode}-${playType}`}
        className="overflow-hidden animate-fade-in"
        style={{
          background: 'var(--color-surface)',
          border: '1.5px solid var(--color-border)',
          borderRadius: '16px',
        }}
      >
        {/* Mode accent bar */}
        <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />

        {/* Card header: mode info + solo/vs toggle */}
        <div className="px-4 pt-3 pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}15` }}
              >
                {mode.romanNumeral ? (
                  <span className="text-[11px] font-black leading-none" style={{ color }}>{mode.romanNumeral}</span>
                ) : Icon ? (
                  <Icon className="w-4 h-4" style={{ color }} />
                ) : null}
              </div>
              <div>
                <div className="font-black text-sm" style={{ color: 'var(--color-text)' }}>
                  {mode.title}
                </div>
                <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                  Today
                </div>
              </div>
            </div>

            {/* Share + Solo/VS toggle (per-mode only — Sweep is solo-only, cross-mode) */}
            {!isSweep && (
            <div className="flex items-center gap-2">
              {!loading && leaderboard.length > 0 && (
                <button
                  onClick={handleShareLeaderboard}
                  disabled={sharingLb}
                  aria-label="Share leaderboard"
                  className="p-1 active:scale-95 transition-transform"
                  style={{ color: 'var(--color-text-muted)', opacity: sharingLb ? 0.4 : 1 }}
                >
                  <Share className="w-3.5 h-3.5" />
                </button>
              )}
              {/* FRIENDS toggle (§207) — same segmented shell as Solo/VS. */}
              {userId && (
                <div
                  className="flex rounded-lg overflow-hidden"
                  style={{ border: '1.5px solid var(--color-border)' }}
                >
                  {([false, true] as const).map((f) => (
                    <button
                      key={String(f)}
                      className="px-3 py-1.5 text-[10px] font-extrabold transition-all"
                      style={{
                        background: friendsOnly === f ? `${color}15` : 'var(--color-surface)',
                        color: friendsOnly === f ? color : 'var(--color-text-muted)',
                      }}
                      onClick={() => setFriendsOnly(f)}
                    >
                      {f ? 'Friends' : 'All'}
                    </button>
                  ))}
                </div>
              )}
              <div
                className="flex rounded-lg overflow-hidden"
                style={{ border: '1.5px solid var(--color-border)' }}
              >
                {(['solo', 'vs'] as const).map((t) => (
                  <button
                    key={t}
                    className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-extrabold transition-all"
                    style={{
                      background: playType === t ? `${color}15` : 'var(--color-surface)',
                      color: playType === t ? color : 'var(--color-text-muted)',
                    }}
                    onClick={() => setPlayType(t)}
                  >
                    {t === 'solo' ? <User className="w-3 h-3" /> : <Swords className="w-3 h-3" />}
                    {t === 'solo' ? 'Solo' : 'VS'}
                  </button>
                ))}
              </div>
            </div>
            )}
          </div>

          {/* Player count + user rank */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
              <Users className="w-3.5 h-3.5" />
              <span>
                {isSweep
                  ? `${playerCount} swept today`
                  : `${playerCount} player${playerCount !== 1 ? 's' : ''} today`}
              </span>
            </div>
            {userRank && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Your rank:</span>
                <span className="font-black text-xs" style={{ color: '#d97706' }}>#{userRank.rank}</span>
                {!isSweep && <RankDeltaBadge mode={selectedMode} playType={playType} pageKey="records-daily" currentRank={userRank.rank} />}
                <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                  of {userRank.totalPlayers}
                  {userRank.totalPlayers > 1 && ` · top ${Math.max(1, Math.round((userRank.rank / userRank.totalPlayers) * 100))}%`}
                </span>
              </div>
            )}
          </div>

          {/* §254/§255: the completed-daily dropdown — a full-width block
              beneath the count/rank row, as on the daily leaderboard page.
              (First cut mounted it INSIDE that flex row, where it was squeezed
              between "7 players today" and "Your rank" — founder screenshot.) */}
          {!isSweep && (
            <div className="mt-2">
              <CompletedDailyBoard modeId={selectedMode} />
            </div>
          )}
        </div>

        {/* Leaderboard rows */}
        {loading ? (
          <LeaderboardSkeleton />
        ) : isSweep ? (
          sweepLeaderboard.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-bold">Nobody&apos;s swept today. Be the first!</p>
            </div>
          ) : (
            // Service already filters blocked; the RPC rank is authoritative.
            <div>{sweepLeaderboard.map((entry) => renderSweepRow(entry, entry.rank))}</div>
          )
        ) : leaderboard.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs font-bold">No results yet today. Be the first!</p>
          </div>
        ) : (
          <div>
            {/* Blocked users are hidden client-side; ranks keep their
                original positions (holes where blocked rows were). */}
            {leaderboard
              .map((entry, index) => ({ entry, rank: index + 1 }))
              .filter(({ entry }) => !isBlocked(entry.user_id))
              .map(({ entry, rank }) => {
              const isCurrentUser = !!userId && entry.user_id === userId;
              return (
                <div
                  key={entry.user_id}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{
                    background: isCurrentUser ? 'var(--color-highlight-gold)' : rank <= 3 ? 'var(--color-surface-alt)' : 'transparent',
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
                      {isCurrentUser && <span style={{ color: '#d97706' }}> (you)</span>}
                    </Link>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-xs" style={{ color: 'var(--color-text)' }}>{lbScoreLabels.get(entry.composite_score) ?? formatScore(entry.composite_score)}</div>
                    <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                      {playType === 'solo' ? (
                        <>
                          <span>
                            {guessRowLabel(MODE_BY_DBKEY[selectedMode]?.guessSemantics ?? 'guesses', MODE_BY_DBKEY[selectedMode]?.guessBase ?? 1, entry.guess_count)} · {formatTime(entry.time_seconds)}
                            {entry.total_boards > 1 && ` · ${entry.boards_solved}/${entry.total_boards}`}
                            {/* §254: hints ride this row exactly as on the daily
                                leaderboard — the founder wants the two pages to match. */}
                            {(() => {
                              const h = formatHintsLabel(selectedMode, entry.hints_used);
                              return h ? ` · ${h}` : '';
                            })()}
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

      {/* Yesterday's podium */}
      <YesterdayPodium mode={selectedMode} playType={playType} color={color} userId={userId} />
      </PullToRefresh>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   YESTERDAY'S PODIUM (collapsible)
   ═══════════════════════════════════════════════════════ */
function YesterdayPodium({ mode, playType, color, userId }: { mode: string; playType: 'solo' | 'vs'; color: string; userId?: string }) {
  const [top3, setTop3] = useState<LeaderboardEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const yesterday = getYesterdayLocal();

  useEffect(() => {
    let active = true;
    fetchDailyLeaderboard(mode, playType, yesterday, 5).then((r) => { if (active) setTop3(r); });
    return () => { active = false; };
  }, [mode, playType, yesterday]);

  if (top3.length === 0) return null;
  const podiumScoreLabels = tieAwareScoreLabels(top3.map((e) => e.composite_score));
  const medalColor = ['#d97706', '#9ca3af', '#b45309'];

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

  return (
    <div
      className="overflow-hidden mt-3"
      style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
    >
      <div className="w-full flex items-center justify-between px-4 py-2.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 flex-1 min-w-0"
        >
          <Crown className="w-3.5 h-3.5" style={{ color: '#d97706' }} />
          <span className="text-[11px] font-black uppercase tracking-wide" style={{ color: 'var(--color-text)' }}>Yesterday&apos;s Podium</span>
        </button>
        <div className="flex items-center gap-2">
          {/* Settled-podium share — only once the podium is open. */}
          {open && (
            <button
              onClick={handleShare}
              disabled={sharing}
              aria-label="Share yesterday's podium"
              className="p-1 -my-1 active:scale-95 transition-transform"
              style={{ color: 'var(--color-text-muted)', opacity: sharing ? 0.4 : 1 }}
            >
              <Share className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => setOpen((o) => !o)} aria-label="Toggle yesterday's podium">
            <ChevronDown className="w-4 h-4 transition-transform" style={{ color: 'var(--color-text-muted)', transform: open ? 'rotate(180deg)' : 'none' }} />
          </button>
        </div>
      </div>
      {open && (
        <div style={{ borderTop: '1px solid var(--color-border)' }}>
          {top3.filter((e) => !isBlocked(e.user_id)).map((e, i, arr) => (
            <div key={e.user_id} className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
              <Medal className="w-4 h-4 shrink-0" style={{ color: medalColor[i] }} />
              <Link href={`/profile/${e.user_id}`} className="flex-1 min-w-0 text-xs font-extrabold truncate hover:opacity-80" style={{ color: 'var(--color-text)' }}>{e.username}</Link>
              <span className="font-black text-xs" style={{ color }}>{podiumScoreLabels.get(e.composite_score) ?? formatScore(e.composite_score)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ALL-TIME RECORDS VIEW
   ═══════════════════════════════════════════════════════ */
function AllTimeRecordsView({ userId }: { userId?: string }) {
  const [records, setRecords] = useState<AllTimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState('DUEL');
  // §245: one trophy-case card render/upload at a time.
  const [sharingShelf, setSharingShelf] = useState(false);
  const [sweepBoard, setSweepBoard] = useState<AllTimeSweepEntry[]>([]);
  const [sweepLoading, setSweepLoading] = useState(false);

  useEffect(() => {
    fetchAllTimeRecordsShared().then((data) => {
      setRecords(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Lazily load the all-time Sweep board the first time SWEEP is selected.
  useEffect(() => {
    if (selectedMode !== 'SWEEP') return;
    let active = true;
    setSweepLoading(true);
    fetchAllTimeSweepLeaderboard(50).then((rows) => {
      if (!active) return;
      setSweepBoard(rows);
      setSweepLoading(false);
    }).catch(() => { if (active) setSweepLoading(false); });
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
      <div className="animate-fade-in-up">
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
    <div className="animate-fade-in-up">
      {/* Hall of Fame */}
      <div className="mb-5">
        <div
          className="text-[10px] font-black uppercase tracking-wider mb-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Hall of Fame
        </div>
        <div
          className="overflow-hidden animate-fade-in-scale"
          style={{
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-gold-border)',
            borderRadius: '16px',
          }}
        >
          <div
            className="h-[3px]"
            style={{ background: 'linear-gradient(90deg, #f59e0b, var(--color-gold-border))' }}
          />
          <div className="px-4 pt-2 pb-4">
            <div className="grid grid-cols-2 gap-3">
              {GLOBAL_RECORD_TYPES.map((rt) => {
                const record = globalRecords.find((r) => r.record_type === rt);
                return (
                  <StatCell
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
        </div>
      </div>

      {/* By Game Mode */}
      <div>
        <div
          className="text-[10px] font-black uppercase tracking-wider mb-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          By Game Mode
        </div>

        <div className="mb-3">
          <ModePicker
            grid
            includeSweep
            showAll={false}
            selectedMode={selectedMode}
            onSelectMode={(m) => setSelectedMode(m || 'DUEL')}
          />
        </div>

        <div
          key={selectedMode}
          className="overflow-hidden animate-fade-in"
          style={{
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            borderRadius: '16px',
          }}
        >
          <div
            className="h-[3px]"
            style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }}
          />
          <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}15` }}
            >
              {mode.romanNumeral ? (
                <span className="text-[11px] font-black leading-none" style={{ color }}>{mode.romanNumeral}</span>
              ) : Icon ? (
                <Icon className="w-4 h-4" style={{ color }} />
              ) : null}
            </div>
            <div className="font-black text-sm" style={{ color: 'var(--color-text)' }}>
              {isSweep ? 'Sweep · All-Time' : mode.title}
            </div>
          </div>
          {isSweep ? (
            // All-time Sweep leaderboard — lifetime sweep count, flawless count,
            // and best (fastest) sweep time.
            sweepLoading ? (
              <LeaderboardSkeleton />
            ) : sweepBoard.length === 0 ? (
              <div className="py-5 text-center">
                <Trophy className="w-7 h-7 mx-auto mb-1.5" style={{ color: 'var(--color-text-muted)' }} />
                <p className="text-[11px] font-extrabold" style={{ color: 'var(--color-text-muted)' }}>No sweeps yet</p>
              </div>
            ) : (
              <div style={{ borderTop: '1px solid var(--color-border)' }}>
                {/* Service already filters blocked; the RPC rank is authoritative. */}
                {sweepBoard.map((entry) => {
                  const isCurrentUser = !!userId && entry.user_id === userId;
                  return (
                    <div
                      key={entry.user_id}
                      className="flex items-center gap-3 px-4 py-2.5"
                      style={{
                        background: isCurrentUser ? 'var(--color-highlight-gold)' : entry.rank <= 3 ? 'var(--color-surface-alt)' : 'transparent',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <RankIcon rank={entry.rank} />
                      {/* Leaderboard-row shape (Doug's Aug-16 feedback): stats
                          under the name so the name keeps the flexible width. */}
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/profile/${entry.user_id}`}
                          className="text-xs font-extrabold truncate block hover:opacity-80 transition-opacity"
                          style={{ color: 'var(--color-text)' }}
                        >
                          {entry.username}
                          {isCurrentUser && <span style={{ color: '#d97706' }}> (you)</span>}
                        </Link>
                        <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                          {entry.flawless_count} flawless{entry.best_sweep_time ? ` · best ${formatTime(entry.best_sweep_time)}` : ''}
                        </div>
                      </div>
                      <div className="font-black text-xs text-right shrink-0" style={{ color: 'var(--color-text)' }}>
                        {entry.sweep_count} sweep{entry.sweep_count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
          <div className="px-4 pb-4">
            {modeRecords.length === 0 ? (
              <div className="py-5 text-center">
                <Trophy
                  className="w-7 h-7 mx-auto mb-1.5"
                  style={{ color: 'var(--color-text-muted)' }}
                />
                <p className="text-[11px] font-extrabold" style={{ color: 'var(--color-text-muted)' }}>
                  No records yet
                </p>
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
                    <StatCell
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
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════ */
export default function RecordsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'daily' | 'alltime'>('daily');

  // Load the signed-in user's block list (session-cached) so blocked users'
  // rows can be filtered out of the leaderboard renders below. The state bump
  // just forces a re-render (which cascades to the tab views) once it arrives.
  const [, setBlockedLoaded] = useState(false);
  useEffect(() => {
    if (user) fetchBlockedIds(user.id).then(() => setBlockedLoaded(true));
  }, [user]);

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--color-bg)' }}>
      <AppHeader />

      <div className="max-w-lg mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-4 animate-fade-in-up">
          <h1
            className="text-3xl font-black bg-clip-text text-transparent tracking-tight"
            style={{
              backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)',
            }}
          >
            RECORDS
          </h1>
          <p className="text-xs font-bold mt-1" style={{ color: 'var(--color-text-muted)' }}>
            The best of the best across Wordocious · <Link href="/daily" style={{ color: '#7c3aed' }}>today&apos;s boards</Link>
          </p>
        </div>

        {/* Daily / All-Time / You Toggle */}
        <div className="flex gap-2 mb-5">
          {([['daily', 'Daily'], ['alltime', 'All-Time']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all"
              style={{
                background: activeTab === key ? 'var(--color-surface)' : 'var(--color-surface-hover)',
                border: activeTab === key ? '1.5px solid #7c3aed' : '1.5px solid var(--color-border)',
                color: activeTab === key ? '#7c3aed' : 'var(--color-text-muted)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'daily' ? (
          <DailyRecordsView key="daily" userId={user?.id} />
        ) : (
          <AllTimeRecordsView key="alltime" userId={user?.id} />
        )}

        {/* D2 step 3 (2026-09-26): your own records live on the Stats tab now. */}
        <Link href="/stats?view=all-time" className="block text-center text-[11px] font-black mt-6" style={{ color: '#7c3aed' }}>
          Your personal records → Stats
        </Link>
      </div>

      <BottomNav />
    </div>
  );
}
