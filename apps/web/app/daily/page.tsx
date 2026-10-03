'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { useDailyCompletions } from '@/lib/daily-completions-context';
import { CandyButton, CandyLink } from '@/components/ui/candy-button';
import { Users } from 'lucide-react';
import { Icon3D, WinLossBadge } from '@/components/ui/icon3d';
import { HeaderGlyph } from '@/components/ui/header-glyph';
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
import { MASCOT_LINES } from '@/lib/mascots';
import { ArtScene } from '@/components/ui/art-scene';
import { PAGE_SCENES } from '@/lib/art';
import { GameArt } from '@/components/ui/game-art';
import { GameTileGlyph } from '@/components/ui/game-tile';
import { SoftCompletedCards } from '@/components/game/collapsible-completed-card';
import {
  BoardCard, BoardRow, CompactResultRow, DisclosureHeader, LB_GOLD, RowBadge, SECTION_LABEL, SWEEP_BADGE_COL, SegmentedPill, SweepBadge,
} from '@/components/leaderboard/board-rows';
import { boardAvatarFor } from '@/components/leaderboard/board-rows';
import { Podium, type PodiumPlace } from '@/components/leaderboard/podium';
import { compactRankLine, rowBadge, solvedLine, splitPodium } from '@/lib/leaderboard-podium';
import { alphaHex, cardBarStyle, softCard } from '@/lib/soft-surface';
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
import { SweepModeDots, sweepStatsText } from '@/components/leaderboard/sweep-mode-dots';
import { PageBackground } from '@/components/ui/page-background';

const getMode = modeByKey;

/** The taunt sheet's accent (Friends pink). */
const TAUNT_ACCENT = '#ec4899';

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
    setTauntStatus(r.sent ? 'Sent!' : r.alreadySent ? 'Already taunted them today' : 'Could not send');
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


  // C2: the ONE result card — how you solved it. Today's completion (on hand
  // at once) wins; else your row on the board in hand (the top-50 list or the
  // "your neighborhood" window). Sweep: your sweep row's totals.
  const myCompletion = !isSweep && dailiesDay === getTodayLocal() ? todayDailies.get(selectedMode) ?? null : null;
  const myEntry = user && !isSweep
    ? leaderboard.find((r) => r.user_id === user.id) ?? rankWindow?.entries.find((r) => r.user_id === user.id) ?? null
    : null;
  const mySweepEntry = user && isSweep ? sweepLeaderboard.find((r) => r.user_id === user.id) ?? null : null;
  const modeMeta = MODE_BY_DBKEY[selectedMode];
  const mySolved = (() => {
    if (mySweepEntry) return `${mySweepEntry.is_flawless ? 'Flawless' : 'Swept'} · ${sweepStatsText(mySweepEntry, sweepDetails.get(mySweepEntry.user_id), getTodayLocal())}`;
    const sem = modeMeta?.guessSemantics ?? 'guesses';
    const base = modeMeta?.guessBase ?? 1;
    const line = myCompletion
      ? solvedLine(sem, base, myCompletion.guesses, myCompletion.timeSeconds, myCompletion.won)
      : myEntry ? solvedLine(sem, base, myEntry.guess_count, myEntry.time_seconds, myEntry.completed) : null;
    if (!line) return null;
    const h = myEntry ? formatHintsLabel(selectedMode, myEntry.hints_used) : null;
    return h ? `${line} · ${h}` : line;
  })();
  const resultPoints = myPoints ?? (myCompletion && myCompletion.score > 0 ? formatScore(myCompletion.score) : null);
  const showResult = !!userRank || !!myCompletion;

  // §216: on the FRIENDS board, the week's points leader wears the crown.
  const crownId = (() => {
    if (!friendsOnly || !user) return null;
    void friendsVersion;
    const entries = getFriends().map((f) => ({ id: f.id, pts: f.weekPoints ?? 0 }));
    entries.push({ id: user.id, pts: getMeDigest()?.weekPoints ?? 0 });
    entries.sort((a, b) => b.pts - a.pts);
    return entries.length > 0 && entries[0].pts > 0 ? entries[0].id : null;
  })();
  const weekCrown = (id: string) =>
    id === crownId ? <Icon3D name="crown" size={14} inline label="Leads the week" className="ml-1" /> : null;

  // More Games §11: the number reads through the mode's semantics — "0
  // Mistakes", "5 Checks", "Par", "Hubbub" — never a bare "Guesses"; boards
  // solved and hints ride along. The W / L badge is NOT here (C2a: its column).
  const lbStatsText = (entry: LeaderboardEntry) => {
    let s = `${guessRowLabel(modeMeta?.guessSemantics ?? 'guesses', modeMeta?.guessBase ?? 1, entry.guess_count)} · ${formatTime(entry.time_seconds)}`;
    if (entry.total_boards > 1) s += ` · ${entry.boards_solved}/${entry.total_boards}`;
    const h = formatHintsLabel(selectedMode, entry.hints_used);
    return h ? `${s} · ${h}` : s;
  };

  // Friends board: one-tap canned taunt on any friend's row (§207) — a bare 3D bell.
  const tauntButton = (entry: { user_id: string; username: string; avatar_url: string | null }) => (
    <HeaderGlyph
      icon="bell"
      size={18}
      label={`Taunt ${entry.username}`}
      onClick={() => setTauntTarget({ id: entry.user_id, username: entry.username, avatar_url: entry.avatar_url, level: 0 })}
      style={{ minWidth: 36, minHeight: 36 }}
    />
  );

  // One row of the leaderboard — shared by the list below the podium, the
  // "your neighborhood" rank window and Yesterday's Winners, so they can never
  // drift apart visually.
  const renderLbRow = (entry: LeaderboardEntry, rank: number, i: number, scoreLabels = lbScoreLabels) => {
    const isCurrentUser = !!user && entry.user_id === user.id;
    return (
      // Doug's Aug-16 feedback: name on top, stats underneath, score alone on
      // the right — the name gets the row's flexible width.
      <BoardRow
        key={entry.user_id}
        rank={rank}
        userId={entry.user_id}
        avatar={boardAvatarFor(entry)}
        username={entry.username}
        avatarUrl={entry.avatar_url}
        avatarEmoji={entry.avatar_emoji}
        isMe={isCurrentUser}
        nameSuffix={weekCrown(entry.user_id)}
        stats={<span className="truncate">{lbStatsText(entry)}</span>}
        // C2a / §13: the W / L badge art in its own column, left of the points.
        badge={<RowBadge kind={rowBadge(entry)} />}
        score={scoreLabels.get(entry.composite_score) ?? formatScore(entry.composite_score)}
        stripe={i % 2 === 0}
        divider={i > 0}
        trailing={friendsOnly && user && !isCurrentUser ? tauntButton(entry) : null}
      />
    );
  };

  // FRIENDS ghost row — a friend who hasn't played this mode today, in the
  // standard row shell at muted opacity. The taunt bell is the whole point:
  // peer pressure as a game mechanic.
  const renderGhostRow = (f: FriendProfile, i: number) => (
    <BoardRow
      key={`ghost-${f.id}`}
      rank={null}
      userId={f.id}
      avatar={boardAvatarFor(f)}
      username={f.username}
      avatarUrl={f.avatar_url}
      isMe={false}
      stats={<span>Hasn&apos;t played yet</span>}
      stripe={i % 2 === 0}
      divider={i > 0}
      dim
      trailing={
        <HeaderGlyph icon="bell" size={18} label={`Nudge ${f.username}`} onClick={() => setTauntTarget(f)} style={{ minWidth: 36, minHeight: 36 }} />
      }
    />
  );

  // One row of a Sweep board (today's or yesterday's): total score, total
  // time · modes won · guesses · hints, the dot strip under it, and the GOLD
  // "FLAWLESS" / VIOLET "SWEEP" pill in the badge column (C2a).
  const renderSweepRow = (
    entry: SweepEntry,
    i: number,
    { details, streaks, labels, day }: { details: Map<string, SweepDetails>; streaks: Map<string, number>; labels: Map<number, string>; day: string },
  ) => {
    const det = details.get(entry.user_id);
    return (
      <BoardRow
        key={entry.user_id}
        rank={entry.rank}
        userId={entry.user_id}
        avatar={boardAvatarFor(entry)}
        username={entry.username}
        avatarUrl={entry.avatar_url}
        isMe={!!user && entry.user_id === user.id}
        // §223: guesses (and hints) explain the ranking; §227 full words; §246 wrap, never truncate.
        stats={<span className="leading-snug">{sweepStatsText(entry, det, day)}</span>}
        below={<SweepModeDots details={det} day={day} />}
        badge={<SweepBadge flawless={entry.is_flawless} streak={streaks.get(entry.user_id) ?? 0} />}
        badgeWidth={SWEEP_BADGE_COL}
        score={labels.get(entry.total_score) ?? formatScore(entry.total_score)}
        stripe={i % 2 === 0}
        divider={i > 0}
      />
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

  // TODAY'S BOARD, C2: the top three on the podium, the rest as rows below.
  // Blocked users are hidden client-side; ranks keep their original positions
  // (holes where blocked rows were) and exact (score, time) ties share a rank
  // (§217). The friends board is dense by construction — its fetch is already
  // restricted to friends∪me.
  const boardDay = getTodayLocal();
  const lbSplit = splitPodium(
    leaderboard
      .map((entry, index) => ({ entry, rank: competitionRank(leaderboard, index) }))
      .filter(({ entry }) => !isBlocked(entry.user_id)),
  );
  // Blocked users are already filtered by the sweep service; the RPC's rank
  // field is authoritative (handles ties), so use it directly.
  const sweepSplit = splitPodium(sweepLeaderboard.map((entry) => ({ entry, rank: entry.rank })));
  const lbPodium: PodiumPlace[] = lbSplit.podium.map(({ entry, rank }) => {
    const me = !!user && entry.user_id === user.id;
    return {
      key: entry.user_id, rank, userId: entry.user_id, username: entry.username,
      avatarUrl: entry.avatar_url, avatarEmoji: entry.avatar_emoji, isMe: me,
      points: lbScoreLabels.get(entry.composite_score) ?? formatScore(entry.composite_score),
      badge: <WinLossBadge won={entry.completed} size={15} />,
      nameSuffix: weekCrown(entry.user_id),
      extra: <span className="text-[10px] font-bold text-center leading-tight" style={{ color: 'var(--color-text-secondary)' }}>{lbStatsText(entry)}</span>,
      action: friendsOnly && user && !me ? tauntButton(entry) : undefined,
    };
  });
  const sweepPodium: PodiumPlace[] = sweepSplit.podium.map(({ entry, rank }) => ({
    avatar: boardAvatarFor(entry),
    key: entry.user_id, rank, userId: entry.user_id, username: entry.username,
    avatarUrl: entry.avatar_url, isMe: !!user && entry.user_id === user.id,
    points: sweepScoreLabels.get(entry.total_score) ?? formatScore(entry.total_score),
    extra: (
      <div className="flex flex-col items-center gap-1 max-w-full">
        <SweepBadge flawless={entry.is_flawless} streak={flawlessStreaks.get(entry.user_id) ?? 0} />
        <span className="text-[10px] font-bold text-center leading-tight" style={{ color: 'var(--color-text-secondary)' }}>
          {sweepStatsText(entry, sweepDetails.get(entry.user_id), boardDay)}
        </span>
        <SweepModeDots details={sweepDetails.get(entry.user_id)} day={boardDay} />
      </div>
    ),
  }));
  const sweepRowOpts = { details: sweepDetails, streaks: flawlessStreaks, labels: sweepScoreLabels, day: boardDay };

  return (
    <PageBackground tint="leaderboard" className="min-h-screen pb-20">
      <AppHeader />

      {/* FINISH_SPEC AG (desktop web ≥ 900 px; nothing changes below): up to
          1100 px wide — the day headline + picker keep the 560 column across
          the top, then two columns. AS4: the compact play row, YOUR result and
          TODAY'S BOARD on the left (first on a phone), then your finished board +
          YESTERDAY'S WINNERS. Desktop website (≥ 1024 px, lib/desktop-layout.ts):
          three columns — the day headline + picker (kept in view), TODAY'S BOARD,
          then the play card, your board and YESTERDAY'S WINNERS (globals.css .lb-desk). */}
      <div className="lb-desk max-w-lg page-wide mx-auto px-4">
        {/* A6 + C2: the day's title as the headline on the wallpaper, then the
            one game picker card (date · reset clock + ALL-TIME → on top, the
            WORDOCIOUS row with the Sweep broom tile, then PUZZLES). */}
        <div className="mb-3 page-col">
          <LeaderboardBanner today={today} selectedMode={selectedMode} onSelect={setSelectedMode} />
        </div>

        <div className="page-grid-2">
        <div>
        {/* AU2: YOUR result as ONE compact row ("#2 of 5 · 2,005 PTS · 4 guesses · 48s"
            + the completed check) — no repeated headline — then the board right away. */}
        {showResult && (
          <CompactResultRow
            line={compactRankLine({
              rank: userRank?.rank ?? null,
              total: userRank?.totalPlayers ?? null,
              friends: friendsOnly && !isSweep,
              points: resultPoints,
              semantics: modeMeta?.guessSemantics,
              guessBase: modeMeta?.guessBase,
              guesses: myCompletion?.guesses ?? myEntry?.guess_count ?? null,
              timeSeconds: myCompletion?.timeSeconds ?? myEntry?.time_seconds ?? null,
              detail: isSweep ? mySolved : null,
            })}
            won={isSweep ? (mySweepEntry ? true : null) : myCompletion ? myCompletion.won : myEntry ? !!myEntry.completed : null}
            delta={
              userRank ? (
                <RankDeltaBadge
                  mode={selectedMode}
                  playType="solo"
                  // The friends board keeps its own rank history (SWEEP is always global).
                  pageKey={friendsOnly && user && !isSweep ? 'daily-friends' : 'daily'}
                  currentRank={userRank.rank}
                />
              ) : null
            }
          />
        )}

        {/* TODAY'S BOARD — daily games only (the Play card says so), so an
            Unlimited session never shows here. */}
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          <div style={SECTION_LABEL}>TODAY&apos;S BOARD</div>
          <div className="flex items-center gap-1">
            {/* Everyone | Friends — the tinted segmented control. */}
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
              <HeaderGlyph
                icon="share"
                size={20}
                label="Share leaderboard"
                onClick={handleShareLeaderboard}
                disabled={sharingLb}
                style={{ minWidth: 40, opacity: sharingLb ? 0.4 : 1 }}
              />
            )}
          </div>
        </div>
        <PullToRefresh onRefresh={loadLeaderboard} accentColor={color}>
        <BoardCard>
          {boardLoading ? (
            <LeaderboardSkeleton />
          ) : isSweep ? (
            sweepLeaderboard.length === 0 ? (
              <div className="p-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
                <div className="flex justify-center mb-2"><ArtScene scene={PAGE_SCENES.empty} /></div>
                <p className="text-xs font-bold">Nobody&apos;s swept today. Be the first!</p>
              </div>
            ) : (
              <div>
                <Podium places={sweepPodium} label="Top three sweepers" />
                {sweepSplit.rest.map(({ entry }, i) => renderSweepRow(entry, i + (sweepPodium.length > 0 ? 1 : 0), sweepRowOpts))}
              </div>
            )
          ) : leaderboard.length === 0 ? (
            friendsOnly && ghostFriends.length > 0 ? (
              // Nobody's played yet, but the friends list still renders as
              // ghost rows — the board should feel alive (and tauntable).
              <div>{ghostFriends.map((f, i) => renderGhostRow(f, i))}</div>
            ) : (
              <div className="p-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
                <div className="flex justify-center mb-2"><ArtScene scene={friendsOnly ? PAGE_SCENES.addFriend : PAGE_SCENES.empty} /></div>
                <p className="text-xs font-bold">
                  {friendsOnly
                    ? MASCOT_LINES.addFriend
                    : 'No daily results yet. Be the first!'}
                </p>
                {friendsOnly && (
                  <CandyLink href="/friends" size="sm" color="purple" icon="plus" className="mt-3">
                    Add friends
                  </CandyLink>
                )}
              </div>
            )
          ) : (
            <div>
              <Podium places={lbPodium} />
              {/* Ranks 4+ (the stripes start after the podium). */}
              {lbSplit.rest.map(({ entry, rank }, i) => renderLbRow(entry, rank, i + (lbPodium.length > 0 ? 1 : 0)))}
              {/* Friends who haven't played this mode today. */}
              {friendsOnly && ghostFriends.map((f, i) => renderGhostRow(f, lbSplit.rest.length + i + 1))}
              {/* "Your neighborhood" — the rows around the user's rank when they
                  placed past the top 50 (e.g. #425 sees ~421–429, own row
                  highlighted). Same ordering as the list, so ranks agree. */}
              {rankWindow && (
                <>
                  <div
                    className="text-center py-1 text-sm font-black tracking-widest"
                    style={{ color: 'var(--color-text-secondary)', borderTop: `1px solid ${alphaHex(LB_GOLD, 0.16)}` }}
                  >
                    ···
                  </div>
                  {rankWindow.entries
                    .map((entry, index) => ({ entry, rank: rankWindow.startRank + index }))
                    .filter(({ entry }) => !isBlocked(entry.user_id))
                    .map(({ entry, rank }, i) => renderLbRow(entry, rank, i))}
                </>
              )}
            </div>
          )}
        </BoardCard>
        </PullToRefresh>

        </div>

        <div>
        {/* AS4 + AU2: the play card as one compact row, below the standings — small art, one line, a small
            candy button (PLAY before today's daily, VIEW BOARD after). */}
        <div className="relative overflow-hidden mb-3" style={softCard(color, { radius: 16 })}>
          <div aria-hidden="true" style={cardBarStyle(color)} />
          <div className="flex items-center gap-2.5" style={{ padding: '7px 10px 8px' }}>
            <GameArt
              id={isSweep ? 'sweep' : mode.id}
              size={30}
              fallback={<GameTileGlyph accent={color} icon={Icon} romanNumeral={mode.romanNumeral} />}
            />
            <div className="flex-1 min-w-0 flex items-center gap-1.5 text-[12px] font-extrabold" style={{ color: 'var(--color-text-secondary)' }}>
              <span className="font-black truncate" style={{ color: 'var(--color-text)' }}>{isSweep ? 'Daily Sweep' : mode.title}</span>
              <span aria-hidden="true">·</span>
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {/* §223: the sweep board ranks by total points across all modes. */}
                {isSweep ? `${playerCount} swept · ranked by points` : `${playerCount} today`}
              </span>
            </div>
            {/* Sweep isn't a playable puzzle — no Play button. */}
            {!isSweep && (
              <CandyButton
                size="sm"
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

        {/* Your finished board (§254), collapsible under the result — per-mode
            only; Sweep has no board. */}
        {!isSweep && (
          <SoftCompletedCards>
            <CompletedDailyBoard modeId={selectedMode} />
          </SoftCompletedCards>
        )}

        {/* YESTERDAY'S WINNERS — per-mode top 5, or yesterday's top sweepers;
            collapsible, the same tinted card and rows as today's board. */}
        <DisclosureHeader
          label={<>YESTERDAY&apos;S WINNERS</>}
          open={showYesterday}
          onToggle={() => setShowYesterday(!showYesterday)}
          right={
            // Settled-podium share — only once the dropdown is open with rows.
            showYesterday && (isSweep ? yesterdaySweep.length > 0 : yesterdayLeaderboard.length > 0) ? (
              <HeaderGlyph
                icon="share"
                size={20}
                label="Share yesterday's podium"
                onClick={handleSharePodium}
                disabled={sharingPodium}
                style={{ minWidth: 40, opacity: sharingPodium ? 0.4 : 1 }}
              />
            ) : null
          }
        />

        {showYesterday && (
          <BoardCard className="mb-4">
            {yesterdayLoading ? (
              <LeaderboardSkeleton />
            ) : isSweep ? (
              yesterdaySweep.length === 0 ? (
                <div className="p-6 text-center text-xs font-bold" style={{ color: 'var(--color-text-secondary)' }}>
                  No sweeps yesterday
                </div>
              ) : (
                <div>
                  {/* Full sweep rows (founder ask, Aug 17): the RPC already
                      returns time + modes for any day — shown like today's board. */}
                  {yesterdaySweep
                    .filter((e) => !isBlocked(e.user_id))
                    .map((entry, i) => renderSweepRow(entry, i, { details: ySweepDetails, streaks: yFlawlessStreaks, labels: ySweepScoreLabels, day: yesterday }))}
                </div>
              )
            ) : yesterdayLeaderboard.length === 0 ? (
              <div className="p-6 text-center text-xs font-bold" style={{ color: 'var(--color-text-secondary)' }}>
                No results from yesterday
              </div>
            ) : (
              <div>
                {/* Full daily rows (founder ask, Aug 11): clickable profiles,
                    guesses + time detail, W/L badge — same renderer as today. */}
                {yesterdayLeaderboard
                  .map((entry, index) => ({ entry, rank: competitionRank(yesterdayLeaderboard, index) }))
                  .filter(({ entry }) => !isBlocked(entry.user_id))
                  .map(({ entry, rank }, i) => renderLbRow(entry, rank, i, yLbScoreLabels))}
              </div>
            )}
          </BoardCard>
        )}
        </div>
        </div>
      </div>

      {/* Canned-taunt picker (§207): fixed phrases, one per friend per day —
          a tinted sheet of candy buttons. */}
      {tauntTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => { setTauntTarget(null); setTauntStatus(null); }}
        >
          <div
            role="dialog"
            aria-label={`Taunt ${tauntTarget.username}`}
            className="relative w-full max-w-sm overflow-hidden"
            style={softCard(TAUNT_ACCENT, { radius: 20 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div aria-hidden="true" style={cardBarStyle(TAUNT_ACCENT)} />
            <div className="px-4 pt-3 pb-2">
              <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                Taunt {tauntTarget.username}
              </p>
            </div>
            {tauntStatus ? (
              <div className="p-6 text-center text-sm font-extrabold" style={{ color: 'var(--color-text)' }}>
                {tauntStatus}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 px-4 pb-4">
                {FRIEND_TAUNTS.map((t) => (
                  <CandyButton key={t.id} size="sm" color="pink" block onClick={() => fireTaunt(t.id)}>
                    {t.text}
                  </CandyButton>
                ))}
                <CandyButton size="sm" color="peach" block onClick={() => setTauntTarget(null)} className="mt-1">
                  Cancel
                </CandyButton>
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
        unlimitedHref={modeHref}
        onViewPuzzle={() => router.push(`${modeHref}?daily=true`)}
      />
    </PageBackground>
  );
}
