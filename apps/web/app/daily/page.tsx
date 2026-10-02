'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { useDailyCompletions } from '@/lib/daily-completions-context';
import { CandyButton } from '@/components/ui/candy-button';
import { Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Icon3D, WinLossBadge } from '@/components/ui/icon3d';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { formatScore, tieAwareScoreLabels } from '@/lib/composite-scoring';
import { formatShortTime as formatTime } from '@/lib/format';
import { AuthModal } from '@/components/auth/auth-modal';
import { AppHeader } from '@/components/ui/app-header';
import { BottomNav } from '@/components/ui/bottom-nav';
import { ModeLimitModal } from '@/components/modals/mode-limit-modal';
import { PROFILE_MODES, modeByKey } from '@/components/profile/mode-picker';
import { LeaderboardBanner } from '@/components/leaderboard/leaderboard-banner';
import { Mascot } from '@/components/ui/mascot';
import { MASCOT_LINES, gameHost } from '@/lib/mascots';
import { ArtScene } from '@/components/ui/art-scene';
import { GAME_TITLE_ART_HEIGHT, PAGE_SCENES, gameTitleArtForDbKey, gameTitleArtLabel } from '@/lib/art';
import { ArtTitle } from '@/components/ui/art-title';
import { GameTileBar, GameTileChip, GameTileGlyph, gameTileSurface } from '@/components/ui/game-tile';
import { SoftCompletedCards } from '@/components/game/collapsible-completed-card';
import { BoardAvatar, BoardRow, RankIcon, SECTION_LABEL, SOFT_CARD, SegmentedPill, YOUR_ROW, YourRankCard } from '@/components/leaderboard/board-rows';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { RankDeltaBadge } from '@/components/ui/rank-delta';
import {
  fetchDailyLeaderboard,
  fetchRankWindow,
  competitionRank,
  fetchDailySweepLeaderboard,
  fetchSweepModeDetails,
  fetchFlawlessStreaks,
  getUserDailyRank,
  getUserSweepRank,
  getDailyPlayerCount,
  getTodayLocal,
  getYesterdayLocal,
  formatHintsLabel,
  type LeaderboardEntry,
  type SweepEntry,
  type SweepDetails,
} from '@/lib/daily-service';
import { requiredSweepCount } from '@/lib/daily-modes';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { guessRowLabel } from '@/lib/mode-stats';
import { hasPlayedModeToday } from '@/lib/play-limit-service';
import { fetchBlockedIds, isBlocked } from '@/lib/moderation-service';
import {
  loadFriends,
  getFriendIds,
  getFriends,
  getMeDigest,
  onFriendsChange,
  sendTaunt,
  type FriendProfile,
} from '@/lib/friends-service';
import { FRIEND_TAUNTS } from '@/lib/friends-taunts';
import {
  shareDailyLeaderboardCard,
  shareDailySweepCard,
  shareYesterdayPodiumCard,
  shareYesterdaySweepPodiumCard,
} from '@/lib/leaderboard-share-flow';
import { CompletedDailyBoard } from '@/components/game/completed-daily-board';
import { SweepModeDots } from '@/components/leaderboard/sweep-mode-dots';
import { PageBackground } from '@/components/ui/page-background';

const getMode = modeByKey;

// Session-lived stale-while-revalidate cache, keyed mode:day:user. A mode-chip
// tap or a return visit paints the last-known rows instantly while the fresh
// fetch swaps in silently — the skeleton only ever shows on a true first load.
const lbCache = new Map<string, {
  lb: LeaderboardEntry[];
  count: number;
  rank: { rank: number; totalPlayers: number } | null;
  // "Your neighborhood" rows when the user ranks past the top-50 list.
  win: { startRank: number; entries: LeaderboardEntry[] } | null;
}>();

// Same stale-while-revalidate cache for the synthetic Sweep board, keyed
// day:user (no per-mode dimension — Sweep is cross-mode).
const sweepCache = new Map<string, {
  lb: SweepEntry[];
  count: number;
  rank: { rank: number; totalPlayers: number } | null;
  details: Map<string, SweepDetails>;
}>();

// Which board the fetched state below belongs to: mode · All/Friends · viewer.
// A mode tile or the All|Friends toggle changes the view in one render, but the
// fetch (and its cache paint) runs in an effect after it — so for that render the
// page used to show the new mode's header over the previous mode's rows, count and
// rank (founder, 2026-09-29 screen recording; iOS 3edd33c2 parity). While the
// fetched state belongs to another view, the render paints this view's cached
// board instead, or the skeleton when there is none.
const boardViewKey = (mode: string, friends: boolean, userId: string | undefined) =>
  `${mode}|${mode !== 'SWEEP' && friends ? 'friends' : 'all'}|${userId ?? 'anon'}`;

// Yesterday's Winners: settled boards, so a session-lived cache is exact. Keyed
// by mode · day · All/Friends(viewer) — a mode switch with the dropdown open
// paints that mode's podium (or a skeleton), never the previous mode's rows.
const yesterdayCache = new Map<string, {
  lb?: LeaderboardEntry[];
  sweep?: SweepEntry[];
  details?: Map<string, SweepDetails>;
  streaks?: Map<string, number>;
}>();
const NO_DETAILS = new Map<string, SweepDetails>();
const NO_STREAKS = new Map<string, number>();

// Layout effect on the client (applies ?mode= before the first paint), plain
// effect on the server (where layout effects warn and do nothing).
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function LeaderboardSkeleton() {
  return (
    <div className="space-y-0">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
          <div className="w-5 h-5 rounded-full" style={{ background: 'var(--color-border)' }} />
          <div className="flex-1 h-3 rounded" style={{ background: 'var(--color-border)' }} />
          <div className="w-12 h-3 rounded" style={{ background: 'var(--color-border)' }} />
        </div>
      ))}
    </div>
  );
}

export default function DailyPage() {
  const { user, profile, isProActive } = useAuth();
  const { todayDailies, dailiesDay } = useDailyCompletions();
  const router = useRouter();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState('DUEL');
  // §214: /daily?mode=QUORDLE preselects a board — the post-game "View
  // Leaderboard" button lands on the mode you just played. Read from
  // window (not useSearchParams) to skip the Suspense-boundary dance. Applied
  // before the first paint, so the page never shows Classic for a frame first.
  useIsomorphicLayoutEffect(() => {
    const m = new URLSearchParams(window.location.search).get('mode');
    if (m && (m === 'SWEEP' || PROFILE_MODES.some((pm) => pm.dbKey === m))) setSelectedMode(m);
  }, []);
  // Fetched board state — shown through `board` below, which swaps in the cached
  // board for the view on screen while this state still belongs to another view.
  const [lbState, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [sweepLbState, setSweepLeaderboard] = useState<SweepEntry[]>([]);
  const [rankState, setUserRank] = useState<{ rank: number; totalPlayers: number } | null>(null);
  const [rankWindowState, setRankWindow] = useState<{ startRank: number; entries: LeaderboardEntry[] } | null>(null);
  const [countState, setPlayerCount] = useState(0);
  const [loadingState, setLoading] = useState(true);
  const [boardFor, setBoardFor] = useState<string | null>(null);
  const [showYesterday, setShowYesterday] = useState(false);
  // §223: per-user mode detail behind the sweep dot strips + guess/hint totals.
  const [sweepDetailsState, setSweepDetails] = useState<Map<string, SweepDetails>>(new Map());
  // §248: current flawless streaks for FLAWLESS rows — "FLAWLESS ×4" pills.
  const [flawlessStreaks, setFlawlessStreaks] = useState<Map<string, number>>(new Map());
  // Bumped when a Yesterday's Winners fetch lands in yesterdayCache.
  const [, setYesterdayVersion] = useState(0);

  const isPro = isProActive;

  // `today` must be derived on the client, not at SSR time. Next.js
  // renders the initial HTML on Vercel's UTC servers — if we computed
  // getTodayLocal() at module top-level, a user whose local day differs
  // from Vercel's UTC day would see the wrong day baked into the SSR HTML.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    setToday(getTodayLocal());
  }, []);

  // Load the signed-in user's block list (session-cached) so blocked users'
  // rows can be filtered out of the leaderboard render below. The state bump
  // just forces a re-render once the list arrives.
  const [, setBlockedLoaded] = useState(false);
  useEffect(() => {
    if (user) fetchBlockedIds(user.id).then(() => setBlockedLoaded(true));
  }, [user]);

  // FRIENDS (§207): the All|Friends toggle. Friends boards are the same
  // query restricted to friends∪me, dense-ranked #1..N — plus grayed "ghost"
  // rows for friends who haven't played this mode today (taunt bell lives
  // there). friendsVersion bumps when the session cache changes so ghost
  // rows and the toggle react without a page reload.
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [friendsVersion, setFriendsVersion] = useState(0);
  useEffect(() => {
    if (!user) {
      setFriendsOnly(false);
      return;
    }
    loadFriends().then(() => setFriendsVersion((v) => v + 1));
    return onFriendsChange(() => setFriendsVersion((v) => v + 1));
  }, [user]);

  const isSweep = selectedMode === 'SWEEP';
  const viewKey = boardViewKey(selectedMode, friendsOnly && !!user, user?.id);
  const board = (() => {
    if (boardFor === viewKey) {
      return { lb: lbState, sweep: sweepLbState, count: countState, rank: rankState, win: rankWindowState, details: sweepDetailsState, loading: loadingState };
    }
    // Same cache keys as loadLeaderboard.
    const day = getTodayLocal();
    const uid = user?.id ?? 'anon';
    if (isSweep) {
      const c = sweepCache.get(`SWEEP:${day}:${uid}`);
      return { lb: [] as LeaderboardEntry[], sweep: c?.lb ?? [], count: c?.count ?? 0, rank: c?.rank ?? null, win: null, details: c?.details ?? NO_DETAILS, loading: !c };
    }
    const c = lbCache.get(`${selectedMode}:${day}:${uid}${friendsOnly && user ? ':friends' : ''}`);
    return { lb: c?.lb ?? [], sweep: [] as SweepEntry[], count: c?.count ?? 0, rank: c?.rank ?? null, win: c?.win ?? null, details: NO_DETAILS, loading: !c };
  })();
  const fetchedLeaderboard = board.lb;
  const fetchedPlayerCount = board.count;
  const fetchedUserRank = board.rank;
  const rankWindow = board.win;
  const sweepLeaderboard = board.sweep;
  const sweepDetails = board.details;
  const loading = board.loading;

  // The player's own daily row on the board at once (founder, 2026-09-29 — iOS/Android parity):
  // the board paints a cached copy (often from before they played) and the refetch can race the
  // result's insert, while today's completion is already on hand. Placed by the server's order
  // (score desc, time asc) whenever the rows in hand lack it; not past a full top 50 (that is the
  // rank window's job). The fetched rows, count and rank stay server-only in the cache.
  const mine = (() => {
    const c = todayDailies.get(selectedMode);
    if (selectedMode === 'SWEEP' || !c || !(c.score > 0) || !profile || dailiesDay !== getTodayLocal()) return null;
    if (fetchedLeaderboard.some((e) => e.user_id === profile.id)) return null;
    const i = fetchedLeaderboard.findIndex((e) => e.composite_score < c.score || (e.composite_score === c.score && e.time_seconds > c.timeSeconds));
    const at = i < 0 ? fetchedLeaderboard.length : i;
    if (at >= 50) return null;
    const row: LeaderboardEntry = {
      user_id: profile.id, username: profile.username, avatar_url: profile.avatar_url ?? null, avatar_emoji: (profile as { avatar_emoji?: string | null }).avatar_emoji ?? null,
      composite_score: c.score, guess_count: c.guesses, time_seconds: c.timeSeconds, boards_solved: c.won ? 1 : 0, total_boards: 1,
      hints_used: 0, vs_wins: 0, vs_losses: 0, vs_games: 0, completed: c.won,
    };
    const rows = [...fetchedLeaderboard.slice(0, at), row, ...fetchedLeaderboard.slice(at)];
    const total = Math.max(fetchedPlayerCount + 1, rows.length);
    return { rows, total, rank: { rank: at + 1, totalPlayers: total } };
  })();
  const leaderboard = mine?.rows ?? fetchedLeaderboard;
  const playerCount = mine?.total ?? fetchedPlayerCount;
  const userRank = fetchedUserRank ?? mine?.rank ?? null;
  const boardLoading = loading && !mine;

  // Canned-taunt picker (fixed phrases only — §207's no-free-text rule).
  const [tauntTarget, setTauntTarget] = useState<FriendProfile | null>(null);
  const [tauntStatus, setTauntStatus] = useState<string | null>(null);
  const fireTaunt = async (tauntId: string) => {
    if (!tauntTarget) return;
    const r = await sendTaunt(tauntTarget.id, tauntId);
    setTauntStatus(r.sent ? 'Sent 😈' : r.alreadySent ? 'Already taunted them today' : 'Could not send');
    setTimeout(() => {
      setTauntTarget(null);
      setTauntStatus(null);
    }, 1400);
  };
  const yesterday = useMemo(() => getYesterdayLocal(), []);
  // Drops late responses from a previous mode so a slow fetch can't overwrite
  // the rows of the mode the user has since switched to.
  const loadSeq = useRef(0);

  const loadLeaderboard = useCallback(async () => {
    // The fetch keys off the local date directly — the `today` state only
    // gates the SSR-rendered date display, and waiting for its post-hydration
    // effect delayed the first request by a render cycle.
    const day = getTodayLocal();
    const seq = ++loadSeq.current;

    // Synthetic Sweep board — cross-mode ranking, different RPCs and row shape.
    if (selectedMode === 'SWEEP') {
      const sweepKey = `SWEEP:${day}:${user?.id ?? 'anon'}`;
      const cachedSweep = sweepCache.get(sweepKey);
      setBoardFor(boardViewKey('SWEEP', false, user?.id));
      if (cachedSweep) {
        setSweepLeaderboard(cachedSweep.lb);
        setPlayerCount(cachedSweep.count);
        setUserRank(cachedSweep.rank);
        setSweepDetails(cachedSweep.details);
        setRankWindow(null);
        setLoading(false);
      } else {
        setLoading(true);
        setUserRank(null);
        setRankWindow(null);
        setSweepLeaderboard([]);
        setSweepDetails(new Map());
      }

      // The player's rank needs nothing from the board, so it runs alongside it; details and
      // streaks then load together (was four round trips in a row — founder, 2026-09-29).
      const rankP = user ? getUserSweepRank(user.id, day) : Promise.resolve(null);
      const lb = await fetchDailySweepLeaderboard(day, 50);
      if (seq !== loadSeq.current) return;
      setSweepLeaderboard(lb);
      setLoading(false);
      // §248: only rows already FLAWLESS today can be on a live streak.
      const [details, streaks, rank] = await Promise.all([
        fetchSweepModeDetails(day, lb.map((e) => e.user_id)),
        fetchFlawlessStreaks(day, lb.filter((e) => e.is_flawless).map((e) => e.user_id)),
        rankP,
      ]);
      if (seq === loadSeq.current) { setSweepDetails(details); setFlawlessStreaks(streaks); if (user) setUserRank(rank); }
      // No dedicated count RPC — the rank query yields the true total when the
      // user swept; otherwise the (≤50) board length is the best estimate.
      const count = rank?.totalPlayers ?? lb.length;
      if (seq === loadSeq.current) setPlayerCount(count);
      sweepCache.set(sweepKey, { lb, count, rank, details });
      return;
    }

    const friends = friendsOnly && !!user;
    const cacheKey = `${selectedMode}:${day}:${user?.id ?? 'anon'}${friends ? ':friends' : ''}`;
    const cached = lbCache.get(cacheKey);
    setBoardFor(boardViewKey(selectedMode, friends, user?.id));
    if (cached) {
      setLeaderboard(cached.lb);
      setPlayerCount(cached.count);
      setUserRank(cached.rank);
      setRankWindow(cached.win);
      setLoading(false);
    } else {
      setLoading(true);
      setUserRank(null);
      setRankWindow(null);
      setLeaderboard([]);
    }

    // Friends board: same query restricted to friends∪me. The whole board
    // fits in one fetch (it's your friends list), so rank is just the dense
    // index — no rank query, no neighborhood window.
    if (friends) {
      const ids = [...new Set([...getFriendIds(), user!.id])];
      const lb = await fetchDailyLeaderboard(selectedMode, 'solo', day, 50, 0, ids);
      if (seq !== loadSeq.current) return;
      setLeaderboard(lb);
      setPlayerCount(lb.length);
      setLoading(false);
      const idx = lb.findIndex((e) => e.user_id === user!.id);
      // §217: exact (score, time) ties share the rank on the friends board too.
      const rank = idx >= 0 ? { rank: competitionRank(lb, idx), totalPlayers: lb.length } : null;
      setUserRank(rank);
      setRankWindow(null);
      lbCache.set(cacheKey, { lb, count: lb.length, rank, win: null });
      return;
    }

    const [lb, count] = await Promise.all([
      fetchDailyLeaderboard(selectedMode, 'solo', day, 50),
      getDailyPlayerCount(selectedMode, day),
    ]);
    if (seq !== loadSeq.current) return;
    // Paint the rows the moment they arrive — the rank banner fills in on its
    // own instead of holding the whole list behind its extra queries.
    setLeaderboard(lb);
    setPlayerCount(count);
    setLoading(false);

    let rank: { rank: number; totalPlayers: number } | null = null;
    let win: { startRank: number; entries: LeaderboardEntry[] } | null = null;
    if (user) {
      rank = await getUserDailyRank(user.id, selectedMode, 'solo', day, lb, 50);
      if (seq === loadSeq.current) setUserRank(rank);
      // Ranked past the visible list → also show the rows around them.
      if (rank && rank.rank > 50) {
        win = await fetchRankWindow(selectedMode, 'solo', rank.rank, day);
      }
      if (seq === loadSeq.current) setRankWindow(win);
    }
    lbCache.set(cacheKey, { lb, count, rank, win });
  }, [selectedMode, user, friendsOnly, friendsVersion]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const yesterdayKey = isSweep
    ? `SWEEP:${yesterday}`
    : `${selectedMode}:${yesterday}:${friendsOnly && user ? `friends:${user.id}` : 'all'}`;
  useEffect(() => {
    if (!showYesterday) return;
    let live = true;
    const key = yesterdayKey;
    const landed = () => { if (live) setYesterdayVersion((v) => v + 1); };
    if (selectedMode === 'SWEEP') {
      fetchDailySweepLeaderboard(yesterday, 5).then(async (lb) => {
        yesterdayCache.set(key, { ...yesterdayCache.get(key), sweep: lb });
        landed();
        // §248: streaks as they stood at yesterday's settled board.
        const [d, st] = await Promise.all([
          fetchSweepModeDetails(yesterday, lb.map((e) => e.user_id)),
          fetchFlawlessStreaks(yesterday, lb.filter((e) => e.is_flawless).map((e) => e.user_id)),
        ]);
        yesterdayCache.set(key, { sweep: lb, details: d, streaks: st });
        landed();
      });
    } else {
      // Friends toggle carries into Yesterday's Winners: podium among friends.
      const ids = friendsOnly && user ? [...new Set([...getFriendIds(), user.id])] : undefined;
      fetchDailyLeaderboard(selectedMode, 'solo', yesterday, 5, 0, ids).then((lb) => {
        yesterdayCache.set(key, { lb });
        landed();
      });
    }
    return () => { live = false; };
  }, [showYesterday, yesterdayKey, selectedMode, yesterday, friendsOnly, friendsVersion, user]);
  const yesterdayEntry = yesterdayCache.get(yesterdayKey);
  const yesterdayLoading = !yesterdayEntry;
  const yesterdayLeaderboard = yesterdayEntry?.lb ?? [];
  const yesterdaySweep = yesterdayEntry?.sweep ?? [];
  const ySweepDetails = yesterdayEntry?.details ?? NO_DETAILS;
  const yFlawlessStreaks = yesterdayEntry?.streaks ?? NO_STREAKS;

  const mode = getMode(selectedMode);
  const color = mode.accentColor;
  const Icon = mode.icon;
  // ART_SPEC §10: the Play card's title art (null for Sweep).
  const titleArt = isSweep ? null : gameTitleArtForDbKey(selectedMode);
  // URL slugs that differ from internal mode ids (mark scrub 2026-08-11):
  // routes wear the display-name slug; ids stay put (they key play limits,
  // saves, and the shared catalog).
  const modeHref = `/${({ quordle: 'quadword', octordle: 'octoword' } as Record<string, string>)[mode.id] ?? mode.id}`;
  const playLimitKey = mode.id;

  // TIE-AWARE score display: stored scores are fractional (speed carries the
  // decimals) but rows show whole numbers — so when two rows on the same board
  // land on one whole number, exactly those rows render the decimals that rank
  // them (2,328.8 over 2,328.0 instead of a phantom tie). One map per board.
  const lbScoreLabels = tieAwareScoreLabels([
    ...leaderboard.map((e) => e.composite_score),
    ...(rankWindow?.entries.map((e) => e.composite_score) ?? []),
  ]);
  const sweepScoreLabels = tieAwareScoreLabels(sweepLeaderboard.map((e) => e.total_score));
  const yLbScoreLabels = tieAwareScoreLabels(yesterdayLeaderboard.map((e) => e.composite_score));
  const ySweepScoreLabels = tieAwareScoreLabels(yesterdaySweep.map((e) => e.total_score));

  // Your rank card's points: your own row on the board in hand (the top-50 list
  // or the "your neighborhood" window); omitted when the row isn't loaded.
  const myPoints = (() => {
    if (!user) return null;
    if (isSweep) {
      const e = sweepLeaderboard.find((r) => r.user_id === user.id);
      return e ? sweepScoreLabels.get(e.total_score) ?? formatScore(e.total_score) : null;
    }
    const e = leaderboard.find((r) => r.user_id === user.id) ?? rankWindow?.entries.find((r) => r.user_id === user.id);
    return e ? lbScoreLabels.get(e.composite_score) ?? formatScore(e.composite_score) : null;
  })();

  // §212: photo → emoji → initial, left of every username — the boards
  // wear faces, not just names.
  // §212: photo → emoji → initial, left of every username.
  const lbAvatar = (avatarUrl: string | null, avatarEmoji: string | null | undefined, username: string) =>
    <BoardAvatar url={avatarUrl} emoji={avatarEmoji} name={username} />;

  // §216: on the FRIENDS board, the week's points leader wears the crown.
  const crownId = (() => {
    if (!friendsOnly || !user) return null;
    void friendsVersion;
    const entries = getFriends().map((f) => ({ id: f.id, pts: f.weekPoints ?? 0 }));
    entries.push({ id: user.id, pts: getMeDigest()?.weekPoints ?? 0 });
    entries.sort((a, b) => b.pts - a.pts);
    return entries.length > 0 && entries[0].pts > 0 ? entries[0].id : null;
  })();

  // One row of the leaderboard — shared by the top-50 list and the
  // "your neighborhood" rank window so they can never drift apart visually.
  const renderLbRow = (entry: LeaderboardEntry, rank: number, scoreLabels = lbScoreLabels) => {
    const isCurrentUser = !!user && entry.user_id === user.id;
    return (
      // Doug's Aug-16 feedback: name on top, stats underneath, score alone on
      // the right — the name gets the row's flexible width.
      <BoardRow
        key={entry.user_id}
        rank={rank}
        userId={entry.user_id}
        username={entry.username}
        avatarUrl={entry.avatar_url}
        avatarEmoji={entry.avatar_emoji}
        isMe={isCurrentUser}
        nameSuffix={entry.user_id === crownId ? <Icon3D name="crown" size={14} inline label="Leads the week" className="ml-1" /> : null}
        stats={
          <>
            <span className="truncate">
              {/* More Games §11: the number reads through the mode's semantics —
                  "0 Mistakes", "5 Checks", "Par", "Hubbub" — never a bare "Guesses". */}
              {guessRowLabel(MODE_BY_DBKEY[selectedMode]?.guessSemantics ?? 'guesses', MODE_BY_DBKEY[selectedMode]?.guessBase ?? 1, entry.guess_count)} · {formatTime(entry.time_seconds)}
              {entry.total_boards > 1 && ` · ${entry.boards_solved}/${entry.total_boards}`}
              {(() => {
                const h = formatHintsLabel(selectedMode, entry.hints_used);
                return h ? ` · ${h}` : '';
              })()}
            </span>
            {/* §13: the W / L badge art in place of the text chip. */}
            <WinLossBadge won={entry.completed} />
          </>
        }
        score={scoreLabels.get(entry.composite_score) ?? formatScore(entry.composite_score)}
        trailing={
          // Friends board: one-tap canned taunt on any friend's row (§207).
          friendsOnly && user && !isCurrentUser ? (
            <button
              onClick={() =>
                setTauntTarget({ id: entry.user_id, username: entry.username, avatar_url: entry.avatar_url, level: 0 })
              }
              aria-label={`Taunt ${entry.username}`}
              className="p-1 -mr-1 active:scale-95 transition-transform"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Icon3D name="bell" size={17} />
            </button>
          ) : null
        }
      />
    );
  };

  // FRIENDS ghost row — a friend who hasn't played this mode today, in the
  // standard row shell at muted opacity. The taunt bell is the whole point:
  // peer pressure as a game mechanic.
  const renderGhostRow = (f: FriendProfile) => (
    <div
      key={`ghost-${f.id}`}
      className="flex items-center gap-3 px-3 py-2.5"
      style={{ opacity: 0.55 }}
    >
      <span className="text-xs font-black w-[22px] text-center shrink-0" style={{ color: 'var(--color-text-muted)' }}>–</span>
      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${f.id}`}
          className="text-xs font-extrabold truncate block hover:opacity-80 transition-opacity"
          style={{ color: 'var(--color-text)' }}
        >
          {f.username}
        </Link>
        <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
          Hasn&apos;t played yet
        </div>
      </div>
      <button
        onClick={() => setTauntTarget(f)}
        aria-label={`Nudge ${f.username}`}
        className="p-1 -mr-1 active:scale-95 transition-transform"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <Icon3D name="bell" size={17} />
      </button>
    </div>
  );

  // One row of the Sweep board — same shell + RankIcon as renderLbRow, but the
  // three stats are total score · total time · modes-won, and the Win/Loss pill
  // becomes a GOLD "FLAWLESS" (won all 9) vs VIOLET "SWEEP" (completed all 9).
  const renderSweepRow = (entry: SweepEntry, rank: number) => {
    const isCurrentUser = user && entry.user_id === user.id;
    const pillColor = entry.is_flawless ? '#d97706' : '#a78bfa';
    const det = sweepDetails.get(entry.user_id);
    return (
      <div
        key={entry.user_id}
        className="flex items-center gap-3 px-3 py-2.5"
        style={isCurrentUser ? YOUR_ROW : undefined}
      >
        <RankIcon rank={rank} />
        {lbAvatar(entry.avatar_url, null, entry.username)}
        {/* Same shape as renderLbRow (Doug's Aug-16 feedback): stats under the
            name so the name keeps the row's flexible width. */}
        {/* §236 (founder: stats "cut off"): the score rides the NAME line —
            the name truncates harmlessly and the stats line owns the full
            row width, so the words always fit. */}
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
          <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
            {/* §223: guesses (and hints) are the numbers that actually explain
                the ranking — the formula is guess-first, so 9 slow wins can
                trail 8 sharp ones (founder double-take, Aug 18). */}
            {/* §227: full words — "2h" read as hours, not hints. */}
            {/* §246: wrap, never truncate — the hints segment fell off the end. */}
            <span className="leading-snug">
              {formatTime(entry.total_time)} · {entry.modes_won}/{requiredSweepCount(getTodayLocal())}
              {det ? ` · ${det.guesses} guess${det.guesses === 1 ? '' : 'es'}` : ''}
              {det && det.hints > 0 ? ` · ${det.hints} hint${det.hints === 1 ? '' : 's'}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <SweepModeDots details={det} day={getTodayLocal()} />
            <span
              className="text-[9px] font-extrabold px-1.5 py-0.5 rounded shrink-0 mt-1"
              style={{ background: `${pillColor}22`, color: pillColor }}
            >
              {/* §248: a live streak shows its length on the pill. */}
              {entry.is_flawless
                ? ((flawlessStreaks.get(entry.user_id) ?? 0) >= 2 ? `FLAWLESS ×${flawlessStreaks.get(entry.user_id)}` : 'FLAWLESS')
                : 'SWEEP'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Friends who haven't played this mode today — the ghost rows.
  const ghostFriends = useMemo(() => {
    if (!friendsOnly || !user || isSweep) return [];
    void friendsVersion; // re-derive when the friends cache changes
    return getFriends().filter(
      (f) => !leaderboard.some((e) => e.user_id === f.id) && !isBlocked(f.id),
    );
  }, [friendsOnly, user, isSweep, leaderboard, friendsVersion]);

  // ── LEADERBOARD SHARE — today's board card + yesterday's podium card.
  // Single-tap, spoiler-free by construction (names/scores/stats only), so no
  // variant chooser. The Sweep board shares too (§231 — founder: share the
  // Sweep board like every other board), via its own card + podium flows.
  const [sharingLb, setSharingLb] = useState(false);
  const [sharingPodium, setSharingPodium] = useState(false);

  const handleShareLeaderboard = async () => {
    if (sharingLb || loading) return;
    setSharingLb(true);
    try {
      if (isSweep) {
        await shareDailySweepCard({
          day: getTodayLocal(),
          entries: sweepLeaderboard.filter((e) => !isBlocked(e.user_id)),
          userId: user?.id ?? null,
          userRank,
        });
        return;
      }
      // The sharer's row when the page already holds it — the top-50 list or
      // the "your neighborhood" rank window; the flow fetches it otherwise.
      const userEntry = user
        ? leaderboard.find((e) => e.user_id === user.id)
          ?? rankWindow?.entries.find((e) => e.user_id === user.id)
          ?? null
        : null;
      await shareDailyLeaderboardCard({
        dbMode: selectedMode,
        playType: 'solo',
        day: getTodayLocal(),
        yesterday,
        ranked: leaderboard
          .map((entry, index) => ({ entry, rank: competitionRank(leaderboard, index) }))
          .filter(({ entry }) => !isBlocked(entry.user_id)),
        userId: user?.id ?? null,
        userRank,
        userEntry,
        friendIds: friendsOnly && user ? [...getFriendIds()] : undefined,
      });
    } finally {
      setSharingLb(false);
    }
  };

  const handleSharePodium = async () => {
    if (sharingPodium) return;
    setSharingPodium(true);
    try {
      if (isSweep) {
        await shareYesterdaySweepPodiumCard({
          day: yesterday,
          entries: yesterdaySweep.filter((e) => !isBlocked(e.user_id)),
          userId: user?.id ?? null,
        });
        return;
      }
      await shareYesterdayPodiumCard({
        dbMode: selectedMode,
        playType: 'solo',
        day: yesterday,
        ranked: yesterdayLeaderboard
          .map((entry, index) => ({ entry, rank: competitionRank(yesterdayLeaderboard, index) }))
          .filter(({ entry }) => !isBlocked(entry.user_id)),
        userId: user?.id ?? null,
        friends: friendsOnly && !!user,
      });
    } finally {
      setSharingPodium(false);
    }
  };

  const playedSelected = dailiesDay === getTodayLocal() && todayDailies.has(selectedMode);

  const handlePlayDaily = () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (!isPro && hasPlayedModeToday(playLimitKey)) {
      setLimitModalOpen(true);
      return;
    }
    router.push(`${modeHref}?daily=true`);
  };

  return (
    <PageBackground tint="leaderboard" className="min-h-screen pb-20">
      <AppHeader />

      <div className="max-w-lg mx-auto px-4">
        {/* The Leaderboard banner (spec §1): the day's title, date · reset
            clock, All-time link, and the game picker (Wordocious + SWEEP chip,
            then Puzzles). Replaces the old title, date row and mode grid. */}
        <div className="mb-4">
          <LeaderboardBanner today={today} selectedMode={selectedMode} onSelect={setSelectedMode} />
        </div>

        {/* Play card (spec §2.1): the game-tile card style in the game's color. */}
        <div className="relative overflow-hidden mb-4" style={gameTileSurface(color)}>
          <GameTileBar accent={color} />
          <div className="flex items-center gap-3 px-3 pt-4 pb-3">
            <GameTileChip accent={color}>
              <GameTileGlyph accent={color} icon={Icon} romanNumeral={mode.romanNumeral} />
            </GameTileChip>
            <div className="flex-1 min-w-0">
              {/* ART_SPEC §10: the selected game's title art (lettering + host)
                  in place of the game name and the host beside it. */}
              {titleArt ? (
                <ArtTitle name={titleArt} label={gameTitleArtLabel(titleArt)} maxHeight={GAME_TITLE_ART_HEIGHT.playCard} maxWidth={2000} align="left" as="div" priority={false} className="mb-0.5" />
              ) : (
                <div className="font-black truncate" style={{ fontSize: 15, color: 'var(--color-text)' }}>
                  {mode.title}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                <Users className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {isSweep
                    ? `${playerCount} swept today`
                    : `${playerCount} player${playerCount !== 1 ? 's' : ''} today · Daily games only`}
                </span>
              </div>
              {/* §223 microcopy: the sweep board pre-answers "why is a full sweep below
                  a near-miss" — it ranks by points, not wins. */}
              {isSweep && (
                <div className="text-[10px] font-bold mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Ranked by total points across all modes
                </div>
              )}
            </div>
            {/* The selected game's host stands on the card's right side. */}
            {!isSweep && !titleArt && gameHost(selectedMode) && (
              <Mascot id={gameHost(selectedMode)!} size={44} motion="bob" />
            )}
            {/* Sweep isn't a playable puzzle — it's a cross-mode ranking, so
                no Play button (just complete every sweep daily to appear here). */}
            {!isSweep && (
              // FINISH_SPEC A8 / C2: a medium glossy candy pill — VIEW BOARD once
              // today's daily is done, PLAY before — never the old tall blob.
              <CandyButton
                size="md"
                color="purple"
                icon={playedSelected ? 'eye' : 'play'}
                onClick={handlePlayDaily}
                className="shrink-0"
              >
                {playedSelected ? 'View board' : 'Play'}
              </CandyButton>
            )}
          </div>
        </div>

        {/* Your board (spec §2.2): per-mode only — Sweep has no board. */}
        {!isSweep && (
          <SoftCompletedCards>
            <CompletedDailyBoard modeId={selectedMode} />
          </SoftCompletedCards>
        )}

        {/* Your rank (spec §2.3): big numerals, medal tint for the top 3. */}
        {userRank && (
          <YourRankCard
            rank={userRank.rank}
            ofLine={`OF ${userRank.totalPlayers}${friendsOnly && !isSweep ? ' FRIENDS' : ''} TODAY`}
            points={myPoints}
            delta={
              <RankDeltaBadge
                mode={selectedMode}
                playType="solo"
                // The friends board keeps its own rank history (SWEEP is always global).
                pageKey={friendsOnly && user && !isSweep ? 'daily-friends' : 'daily'}
                currentRank={userRank.rank}
              />
            }
          />
        )}

        {/* TODAY'S BOARD (spec §2.4) — daily games only (the Play card says so),
            so an Unlimited session never shows here. */}
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          <div style={SECTION_LABEL}>TODAY&apos;S BOARD</div>
          <div className="flex items-center gap-2">
            {/* Everyone | Friends — a soft pill segmented control. */}
            {!isSweep && user && (
              <SegmentedPill
                label="Everyone or Friends"
                accent={color}
                value={friendsOnly}
                onChange={setFriendsOnly}
                options={[[false, 'Everyone'], [true, 'Friends']] as const}
              />
            )}
            {!boardLoading && (isSweep ? sweepLeaderboard.length > 0 : leaderboard.length > 0) && (
              <button
                onClick={handleShareLeaderboard}
                disabled={sharingLb}
                aria-label="Share leaderboard"
                className="p-1 -my-1 active:scale-95 transition-transform"
                style={{ color: 'var(--color-text-secondary)', opacity: sharingLb ? 0.4 : 1 }}
              >
                <Icon3D name="share" size={20} />
              </button>
            )}
          </div>
        </div>
        <PullToRefresh onRefresh={loadLeaderboard} accentColor={color}>
        <div className="overflow-hidden p-1.5" style={SOFT_CARD}>
          {boardLoading ? (
            <LeaderboardSkeleton />
          ) : isSweep ? (
            sweepLeaderboard.length === 0 ? (
              <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
                <div className="flex justify-center mb-2"><ArtScene scene={PAGE_SCENES.empty} /></div>
                <p className="text-xs font-bold">Nobody&apos;s swept today. Be the first!</p>
              </div>
            ) : (
              // Blocked users are already filtered by the service; the RPC's
              // rank field is authoritative (handles ties), so use it directly.
              <div>{sweepLeaderboard.map((entry) => renderSweepRow(entry, entry.rank))}</div>
            )
          ) : leaderboard.length === 0 ? (
            friendsOnly && ghostFriends.length > 0 ? (
              // Nobody's played yet, but the friends list still renders as
              // ghost rows — the board should feel alive (and tauntable).
              <div>{ghostFriends.map(renderGhostRow)}</div>
            ) : (
              <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
                <div className="flex justify-center mb-2"><ArtScene scene={friendsOnly ? PAGE_SCENES.addFriend : PAGE_SCENES.empty} /></div>
                <p className="text-xs font-bold">
                  {friendsOnly
                    ? MASCOT_LINES.addFriend
                    : 'No daily results yet. Be the first!'}
                </p>
                {friendsOnly && (
                  <Link
                    href="/friends"
                    className="inline-block mt-3 px-4 py-2 rounded-xl text-xs font-black text-white btn-3d"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 4px 0 #4c1d95' }}
                  >
                    Add friends
                  </Link>
                )}
              </div>
            )
          ) : (
            <div>
              {/* Blocked users are hidden client-side; ranks keep their
                  original positions (holes where blocked rows were). The
                  friends board is dense by construction — its fetch is
                  already restricted to friends∪me. */}
              {leaderboard
                .map((entry, index) => ({ entry, rank: competitionRank(leaderboard, index) }))
                .filter(({ entry }) => !isBlocked(entry.user_id))
                .map(({ entry, rank }) => renderLbRow(entry, rank))}
              {/* Friends who haven't played this mode today. */}
              {friendsOnly && ghostFriends.map(renderGhostRow)}
              {/* "Your neighborhood" — the rows around the user's rank when they
                  placed past the top 50 (e.g. #425 sees ~421–429, own row
                  highlighted). Same ordering as the list, so ranks agree. */}
              {rankWindow && (
                <>
                  <div
                    className="text-center py-1 text-sm font-black tracking-widest"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    ···
                  </div>
                  {rankWindow.entries
                    .map((entry, index) => ({ entry, rank: rankWindow.startRank + index }))
                    .filter(({ entry }) => !isBlocked(entry.user_id))
                    .map(({ entry, rank }) => renderLbRow(entry, rank))}
                </>
              )}
            </div>
          )}
        </div>
        </PullToRefresh>

        {/* YESTERDAY'S WINNERS (spec §2.5) — per-mode top 3, or yesterday's top
            sweepers; the collapsible podium in a soft card. */}
        <div className="w-full mt-5 mb-2 flex items-center gap-1.5 px-1">
          <button
            onClick={() => setShowYesterday(!showYesterday)}
            aria-expanded={showYesterday}
            className="flex-1 flex items-center gap-1.5 text-left"
            style={SECTION_LABEL}
          >
            YESTERDAY&apos;S WINNERS
            {showYesterday ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {/* Settled-podium share — only once the dropdown is open with rows. */}
          {showYesterday && (isSweep ? yesterdaySweep.length > 0 : yesterdayLeaderboard.length > 0) && (
            <button
              onClick={handleSharePodium}
              disabled={sharingPodium}
              aria-label="Share yesterday's podium"
              className="p-1 -my-1 active:scale-95 transition-transform"
              style={{ color: 'var(--color-text-secondary)', opacity: sharingPodium ? 0.4 : 1 }}
            >
              <Icon3D name="share" size={20} />
            </button>
          )}
        </div>

        {showYesterday && (
          <div className="overflow-hidden mb-4 p-1.5" style={SOFT_CARD}>
            {yesterdayLoading ? (
              <LeaderboardSkeleton />
            ) : isSweep ? (
              yesterdaySweep.length === 0 ? (
                <div className="p-6 text-center text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
                  No sweeps yesterday
                </div>
              ) : (
                <div>
                  {/* Full sweep rows (founder ask, Aug 17): the RPC already
                      returns time + modes for any day — show them like today's
                      board instead of the bare name/pill/score line. */}
                  {yesterdaySweep.filter((e) => !isBlocked(e.user_id)).map((entry) => (
                    <div key={entry.user_id} className="flex items-center gap-3 px-3 py-2.5">
                      <RankIcon rank={entry.rank} />
                      {lbAvatar(entry.avatar_url, null, entry.username)}
                      {/* §236: score rides the name line; stats own the width. */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/profile/${entry.user_id}`}
                            className="text-xs font-extrabold truncate block hover:opacity-80 transition-opacity flex-1 min-w-0"
                            style={{ color: 'var(--color-text)' }}
                          >
                            {entry.username}
                          </Link>
                          <span className="text-xs font-black shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                            {ySweepScoreLabels.get(entry.total_score) ?? formatScore(entry.total_score)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                          <span className="leading-snug">
                            {formatTime(entry.total_time)} · {entry.modes_won}/{requiredSweepCount(getYesterdayLocal())}
                            {(() => { const g = ySweepDetails.get(entry.user_id)?.guesses; return g !== undefined ? ` · ${g} guess${g === 1 ? '' : 'es'}` : ''; })()}
                            {(() => { const h = ySweepDetails.get(entry.user_id)?.hints ?? 0; return h > 0 ? ` · ${h} hint${h === 1 ? '' : 's'}` : ''; })()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <SweepModeDots details={ySweepDetails.get(entry.user_id)} day={yesterday} />
                          <span
                            className="text-[9px] font-extrabold px-1.5 py-0.5 rounded shrink-0 mt-1"
                            style={{
                              background: entry.is_flawless ? '#d9770622' : '#a78bfa22',
                              color: entry.is_flawless ? '#d97706' : '#a78bfa',
                            }}
                          >
                            {entry.is_flawless
                              ? ((yFlawlessStreaks.get(entry.user_id) ?? 0) >= 2 ? `FLAWLESS ×${yFlawlessStreaks.get(entry.user_id)}` : 'FLAWLESS')
                              : 'SWEEP'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : yesterdayLeaderboard.length === 0 ? (
              <div className="p-6 text-center text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
                No results from yesterday
              </div>
            ) : (
              <div>
                {/* Full daily rows (founder ask, Aug 11): clickable profiles,
                    guesses + time detail, W/L pill — same renderer as today. */}
                {yesterdayLeaderboard
                  .map((entry, index) => ({ entry, rank: competitionRank(yesterdayLeaderboard, index) }))
                  .filter(({ entry }) => !isBlocked(entry.user_id))
                  .map(({ entry, rank }) => renderLbRow(entry, rank, yLbScoreLabels))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Canned-taunt picker (§207): fixed phrases, one per friend per day. */}
      {tauntTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => { setTauntTarget(null); setTauntStatus(null); }}
        >
          <div
            className="w-full max-w-sm overflow-hidden"
            style={{
              background: 'var(--color-surface)',
              border: '1.5px solid var(--color-border)',
              borderRadius: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Taunt {tauntTarget.username}
              </p>
            </div>
            {tauntStatus ? (
              <div className="p-6 text-center text-sm font-extrabold" style={{ color: 'var(--color-text)' }}>
                {tauntStatus}
              </div>
            ) : (
              <div>
                {FRIEND_TAUNTS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => fireTaunt(t.id)}
                    className="w-full text-left px-4 py-3 text-xs font-extrabold transition-colors hover:opacity-80"
                    style={{ color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)' }}
                  >
                    {t.text}
                  </button>
                ))}
                <button
                  onClick={() => setTauntTarget(null)}
                  className="w-full px-4 py-3 text-xs font-extrabold"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <BottomNav />
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
      <ModeLimitModal
        open={limitModalOpen}
        onClose={() => setLimitModalOpen(false)}
        modeName={mode.title}
        onViewPuzzle={() => router.push(`${modeHref}?daily=true`)}
      />
    </PageBackground>
  );
}
