// Pure copy-builder for the /s/[...key] share landing page (app/s/[...key]/
// page.tsx). Turns the share URL's path + query params into the unfurl
// title/description and the on-page headline. Kept free of Next.js imports so
// it can be unit-tested in vitest's node environment (share-page-copy.test.ts).
//
// Spoiler rule: titles and descriptions must never contain puzzle letters —
// only mode names, guess counts, times, and scores (all colors-only safe).

export const MODE_DISPLAY: Record<string, string> = {
  Six: 'Classic Six',
  Seven: 'Classic Seven',
  ProperNoundle: 'ProperNoundle',
  DailySweep: 'Daily Sweep',
  Profile: 'Player Profile',
};

// Map a share mode back to its play route so the CTA sends visitors to it.
export const MODE_ROUTE: Record<string, string> = {
  Classic: '/practice',
  QuadWord: '/quadword',
  OctoWord: '/octoword',
  Succession: '/sequence',
  Deliverance: '/rescue',
  Gauntlet: '/gauntlet',
  ProperNoundle: '/propernoundle',
  Six: '/six',
  Seven: '/seven',
  DailySweep: '/daily',
  Profile: '/',
  // Leaderboard cards aren't playable results — the CTA sends visitors to the
  // board they were shown (VS boards live on the Records daily tab).
  Leaderboard: '/daily',
  VsLeaderboard: '/records',
  Podium: '/daily',
  // FRIENDS (§207): friends-only board + podium snapshots.
  FriendsBoard: '/daily',
  FriendsPodium: '/daily',
  // SWEEP SHARE (§231): the Daily Sweep board + its settled podium.
  SweepBoard: '/daily',
  SweepPodium: '/daily',
  // WEEKLY RACE (§234): a private race between friends — the CTA sends
  // visitors to the friends surface to start their own.
  WeeklyRace: '/friends',
};

/** The daily-leaderboard /s/ kinds (lib/share-utils leaderboardKind).
 *  Storage keys read `<kind>-<Mode>-<yyyy-mm-dd>`; the query carries
 *  m=<kind> & lm=<Mode> (+ r/tp for the sharer's rank). The Sweep kinds
 *  (§231) are keyed `Sweep*-DailySweep-<day>` with lm=SWEEP; the weekly
 *  race (§234) is keyed `WeeklyRace-WeeklyRace-<day>` with lm=WEEKLY. */
const LB_KINDS = ['FriendsBoard', 'FriendsPodium', 'SweepBoard', 'SweepPodium', 'WeeklyRace', 'Leaderboard', 'VsLeaderboard', 'Podium'] as const;

export type LeaderboardShareKind = (typeof LB_KINDS)[number];

export type SP = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// The hook every description ends with (founder-approved unfurl copy).
const PLAY_HOOK = 'Play today’s puzzles free at wordocious.com.';

/**
 * Every share URL's storage key ends in `<ShareMode>[-full]-<yyyy-mm-dd>`
 * (see lib/share-utils.ts and the iOS/Android ShareService mirrors). Parse
 * mode + date back out of the path so the unfurl stays meaningful even when
 * a platform strips or truncates the query string.
 */
export function parseShareKey(key: string[]): { mode?: string; date?: string } {
  const last = key[key.length - 1];
  if (!last) return {};
  const m = last.match(/^(.+?)(?:-full)?-(\d{4}-\d{2}-\d{2})$/);
  if (!m) return {};
  return { mode: m[1], date: m[2] };
}

function fmtDate(iso: string): string | undefined {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = months[Number(m[2]) - 1];
  if (!mon) return undefined;
  return `${mon} ${Number(m[3])}, ${m[1]}`;
}

/** Year-less "Aug 7" — the leaderboard unfurl title style. */
function fmtDayShort(iso: string): string | undefined {
  const full = fmtDate(iso);
  return full?.split(',')[0];
}

export interface LeaderboardShareInfo {
  kind: LeaderboardShareKind;
  /** The board's ShareMode ('Classic', 'Six', …) — modes.generated title. */
  lbMode?: string;
  /** The board's day (yyyy-mm-dd) recovered from the storage-key path. */
  date?: string;
}

/**
 * Recognize a leaderboard-kind share URL and recover kind + board mode + day.
 * Kind/mode come from ?m=<kind>&lm=<Mode>, falling back to the storage-key
 * path (`<kind>-<Mode>-<yyyy-mm-dd>`) when a platform strips the query; the
 * day only ever lives in the path. Null for every non-leaderboard share.
 */
export function parseLeaderboardShare(sp: SP, key: string[]): LeaderboardShareInfo | null {
  const fromPath = parseShareKey(key);
  const mode = str(sp.m) ?? fromPath.mode ?? '';
  for (const k of LB_KINDS) {
    if (mode === k) return { kind: k, lbMode: str(sp.lm), date: fromPath.date };
    if (mode.startsWith(`${k}-`)) return { kind: k, lbMode: mode.slice(k.length + 1), date: fromPath.date };
  }
  return null;
}

/**
 * Is the shared board still the LIVE board for the recipient, or settled?
 * 'live' only when the key's day matches the recipient's LOCAL today (so this
 * must be called client-side with getTodayLocal()); the Podium kind snapshots
 * yesterday's settled board, so it is final by definition. A missing/bad date
 * degrades to 'final' — the final branch fetches nothing, so it's always safe.
 */
export function boardDayStatus(
  kind: LeaderboardShareKind,
  date: string | undefined,
  todayLocal: string,
): 'live' | 'final' {
  if (kind === 'Podium' || kind === 'FriendsPodium' || kind === 'SweepPodium') return 'final';
  return date === todayLocal ? 'live' : 'final';
}

export interface ShareCopy {
  mode: string;
  modeDisp: string;
  won: boolean;
  stats: string;
  title: string;
  description: string;
}

export function buildCopy(sp: SP, key: string[] = []): ShareCopy {
  const fromPath = parseShareKey(key);
  const mode = str(sp.m) ?? fromPath.mode ?? 'Wordocious';
  const modeDisp = MODE_DISPLAY[mode] ?? mode;
  const dateDisp = fromPath.date ? fmtDate(fromPath.date) : undefined;

  // All-dailies share card has its own copy shape (X/9 won · time · pts).
  if (mode === 'DailySweep' && str(sp.won) !== undefined) {
    const flawless = str(sp.sweep) === 'flawless';
    const w = Number(str(sp.won)) || 0;
    const tot = Number(str(sp.tot)) || 9;
    const t = Number(str(sp.t)) || 0;
    const pts = Number(str(sp.pts)) || 0;
    const label = flawless ? 'Flawless Victory' : 'Daily Sweep';
    const stats = `${w}/${tot} won · ${fmtTime(t)} · ${pts.toLocaleString()} pts`;
    const title = `Wordocious ${label} — ${stats}`;
    const description = flawless
      ? `I won all ${tot} daily puzzles on Wordocious (${stats}). Can you go flawless? ${PLAY_HOOK}`
      : `I completed all ${tot} daily puzzles on Wordocious (${stats}). Think you can sweep them? ${PLAY_HOOK}`;
    return { mode, modeDisp: label, won: w >= tot, stats, title, description };
  }

  // Player-profile card carries no result stats in the query (only the
  // cache-buster v=p<wins>-<streak>-<achievements>, parsed defensively).
  if (mode === 'Profile') {
    const v = str(sp.v)?.match(/^p(\d+)-(\d+)-(\d+)$/);
    const stats = v ? `${Number(v[1]).toLocaleString()} wins · ${v[2]}-day streak` : '';
    const title = stats
      ? `Wordocious Player Profile — ${stats}`
      : 'Wordocious Player Profile';
    const description = `Check out my Wordocious stats. ${PLAY_HOOK}`;
    return { mode, modeDisp, won: false, stats, title, description };
  }

  // Daily-leaderboard cards (today's board / VS board / yesterday's podium).
  // Kind + board mode come from ?m=<kind>&lm=<Mode>, falling back to the
  // storage-key path (`<kind>-<Mode>-<date>`) when the query is stripped.
  const lb = parseLeaderboardShare(sp, key);
  if (lb) {
    const lbModeDisp = lb.lbMode ? (MODE_DISPLAY[lb.lbMode] ?? lb.lbMode) : '';
    const shortDate = fromPath.date ? fmtDayShort(fromPath.date) : undefined;
    const boardBits = [lbModeDisp, shortDate].filter(Boolean).join(' ');
    const boardDisp = lbModeDisp || 'daily';

    // SWEEP SHARE (§231): the board IS the mode — lm carries 'SWEEP', not a
    // catalog mode, so the copy names the board directly.
    if (lb.kind === 'SweepBoard' || lb.kind === 'SweepPodium') {
      const podium = lb.kind === 'SweepPodium';
      const name = podium ? 'Yesterday’s Sweep Podium' : 'Daily Sweep Leaderboard';
      const title = dateDisp ? `Wordocious ${name} — ${dateDisp}` : `Wordocious ${name}`;
      const rank = Number(str(sp.r)) || 0;
      const tp = Number(str(sp.tp)) || 0;
      const standing = rank > 0 && tp > 0 ? `#${rank} of ${tp}` : rank > 0 ? `#${rank}` : '';
      const description = podium
        ? `Yesterday’s Daily Sweep podium is settled — they swept all nine. ${PLAY_HOOK}`
        : standing
          ? `I’m ${standing} on today’s Daily Sweep board. Can you sweep all nine? ${PLAY_HOOK}`
          : `Today’s Daily Sweep board is live. Can you sweep all nine? ${PLAY_HOOK}`;
      return {
        mode: lb.kind,
        modeDisp: name,
        won: false,
        stats: dateDisp ?? '',
        title,
        description,
      };
    }

    // WEEKLY RACE (§234): like Sweep, the race IS the board — lm carries
    // 'WEEKLY', not a catalog mode. The sibling voice ("their friends") is
    // deliberate: the recipient isn't in this race yet, catching them is
    // the hook.
    if (lb.kind === 'WeeklyRace') {
      const title = dateDisp
        ? `Wordocious Friends Weekly Race — ${dateDisp}`
        : 'Wordocious Friends Weekly Race';
      const rank = Number(str(sp.r)) || 0;
      const tp = Number(str(sp.tp)) || 0;
      const standing = rank > 0 && tp > 0 ? `#${rank} of ${tp}` : rank > 0 ? `#${rank}` : '';
      const description = standing
        ? `${standing} in their friends’ weekly race — resets Monday. Think you can catch them? ${PLAY_HOOK}`
        : `A friends-only weekly race — resets Monday. Think you can catch them? ${PLAY_HOOK}`;
      return {
        mode: lb.kind,
        modeDisp: 'Friends Weekly Race',
        won: false,
        stats: dateDisp ?? '',
        title,
        description,
      };
    }

    if (lb.kind === 'Podium' || lb.kind === 'FriendsPodium') {
      const friendsPodium = lb.kind === 'FriendsPodium';
      const podiumName = friendsPodium ? 'Friends Podium' : 'Yesterday’s Podium';
      const title = boardBits
        ? `Wordocious ${podiumName} — ${boardBits}`
        : `Wordocious ${podiumName}`;
      const description = friendsPodium
        ? `Yesterday’s ${boardDisp} podium among friends is settled. ${PLAY_HOOK}`
        : `Yesterday’s ${boardDisp} podium is settled. ${PLAY_HOOK}`;
      return { mode: lb.kind, modeDisp: podiumName, won: false, stats: boardBits, title, description };
    }

    // Friends board: the brag is friend-rank of friend-count (r/tp carry the
    // FRIENDS numbers on this kind — dense #1..N, bible §207).
    if (lb.kind === 'FriendsBoard') {
      const title = boardBits
        ? `Wordocious Friends Leaderboard — ${boardBits}`
        : 'Wordocious Friends Leaderboard';
      const rank = Number(str(sp.r)) || 0;
      const tp = Number(str(sp.tp)) || 0;
      const standing = rank > 0 && tp > 0 ? `#${rank} of ${tp}` : rank > 0 ? `#${rank}` : '';
      const description = standing
        ? `I’m ${standing} among my friends on today’s ${boardDisp} board. Can you beat me? ${PLAY_HOOK}`
        : `Today’s ${boardDisp} board among friends is live. ${PLAY_HOOK}`;
      return { mode: lb.kind, modeDisp: 'Friends Leaderboard', won: false, stats: boardBits, title, description };
    }

    const isVs = lb.kind === 'VsLeaderboard';
    const boardName = isVs ? 'VS Battle Leaderboard' : 'Daily Leaderboard';
    const title = boardBits ? `Wordocious ${boardName} — ${boardBits}` : `Wordocious ${boardName}`;
    // r = the sharer's rank; absent when they hadn't played (or the query was
    // stripped) — then the copy invites rather than boasts.
    const rank = Number(str(sp.r)) || 0;
    const description = rank > 0
      ? (isVs
          ? `I’m #${rank} on today’s ${boardDisp} VS board. Think you can take me? ${PLAY_HOOK}`
          : `I’m #${rank} on today’s ${boardDisp} board. Can you beat me? ${PLAY_HOOK}`)
      : (isVs
          ? `Today’s ${boardDisp} VS board is live. Think you can take them? ${PLAY_HOOK}`
          : `Today’s ${boardDisp} board is live. Can you crack the top 5? ${PLAY_HOOK}`);
    return { mode: lb.kind, modeDisp: boardName, won: false, stats: boardBits, title, description };
  }

  // Query string stripped (some platforms truncate or drop it): fall back to
  // the mode + date recovered from the path — never invent "X/0 · 0:00" stats.
  if (str(sp.won) === undefined) {
    if (mode === 'Wordocious') {
      // Nothing recoverable at all: plain brand card.
      return {
        mode, modeDisp, won: false, stats: '',
        title: 'Wordocious — Daily Word Puzzles',
        description: `Shared from Wordocious. ${PLAY_HOOK}`,
      };
    }
    const stats = dateDisp ?? '';
    const title = stats ? `Wordocious — ${modeDisp} · ${stats}` : `Wordocious — ${modeDisp}`;
    const description = `A ${modeDisp} result on Wordocious. Can you beat it? ${PLAY_HOOK}`;
    return { mode, modeDisp, won: false, stats, title, description };
  }

  const won = str(sp.won) === '1';
  const g = Number(str(sp.g)) || 0;
  const mg = Number(str(sp.mg)) || 0;
  const t = Number(str(sp.t)) || 0;
  const guessDisp = won ? `${g}/${mg}` : `X/${mg}`;
  const statsBits: string[] = [];
  if (str(sp.bs) && str(sp.tb)) statsBits.push(`${str(sp.bs)}/${str(sp.tb)} boards`);
  if (str(sp.sc) && str(sp.ts)) statsBits.push(`${str(sp.sc)}/${str(sp.ts)} stages`);
  statsBits.push(guessDisp, fmtTime(t));
  const stats = statsBits.join(' · ');

  const title = `Wordocious ${modeDisp} — ${won ? 'Solved' : 'Played'} ${stats}`;
  const description = won
    ? `I solved ${modeDisp} on Wordocious (${stats}). Can you beat it? ${PLAY_HOOK}`
    : `I played ${modeDisp} on Wordocious. Think you can solve it? ${PLAY_HOOK}`;
  return { mode, modeDisp, won, stats, title, description };
}
