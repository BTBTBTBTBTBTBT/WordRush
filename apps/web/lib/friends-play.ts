// Friends overhaul (founder, 2026-10-01; spec docs/FRIENDS_REDESIGN_SPEC.md):
// the pure helpers behind the Friends tab, the quick-play sheet and the pocket
// game screens. The words every platform prints come from packages/core
// friendly-games.ts; this file only arranges them for the web (who is on, which
// action pill a row gets, the banner input, reactions, Tic-Tac-Tile threats,
// Pass the Puzzle key colors). No React, so vitest pins it.

import {
  FRIENDLY_TITLES, friendlyHeadline, isOnline, presenceLine, tttLine, whoseTurn,
  type CellMark, type FriendlyKind, type FriendlyState, type FriendsBannerInput, type Side,
} from '@wordle-duel/core';
import { MODE_BY_DBKEY } from './modes.generated';
import { MODE_ROUTES } from './mode-routes';
import { rankToday, type RaceRow } from './todays-race';

// ── Look (spec §0) ──────────────────────────────────────────────────────────

export const FR = {
  ink: '#831843',
  mid: '#9d174d',
  solid: '#db2777',
  soft: '#fce7f3',
  title: 'linear-gradient(90deg, #db2777, #7c3aed)',
  online: '#10b981',
  page: '#f8f7ff',
  label: '#6b7280',
  text: '#1f2937',
  cardShadow: '0 2px 10px rgba(76,29,149,0.07)',
  flame: '#c2410c',
  flameFill: '#f59e0b',
  teal: '#0f766e',
  tealSoft: '#ccfbf1',
} as const;

/** Our tile colors (never Wordle green/yellow): purple = right / you, amber = present / them. */
export const TILE = { you: '#7c3aed', them: '#f59e0b', absent: '#cbd5e1' } as const;

export const KIND_COLOR: Record<FriendlyKind, string> = { rps: '#f97316', ttt: '#7c3aed', coin: '#ca8a04', pass: '#2563eb' };
export const KIND_GRADIENT: Record<FriendlyKind, string> = {
  rps: 'linear-gradient(90deg, #f97316, #db2777)',
  ttt: 'linear-gradient(90deg, #7c3aed, #db2777)',
  coin: 'linear-gradient(90deg, #ca8a04, #db2777)',
  pass: 'linear-gradient(90deg, #2563eb, #7c3aed)',
};
export const KIND_SUB: Record<FriendlyKind, string> = {
  rps: 'Best of 3 · our tiles',
  ttt: 'Three in a row, best of 3',
  coin: 'Heads or tails, best of 5',
  pass: 'One board, take turns',
};
/** Short names for the four-across tiles in the quick-play sheet. */
export const KIND_SHORT: Record<FriendlyKind, string> = { rps: 'Rock Paper Scissors', ttt: 'Tic-Tac-Tile', coin: 'Call It', pass: 'Pass the Puzzle' };

export function kindForTitle(title: string | null | undefined): FriendlyKind | null {
  if (!title) return null;
  const hit = (Object.keys(FRIENDLY_TITLES) as FriendlyKind[]).find((k) => FRIENDLY_TITLES[k] === title);
  return hit ?? null;
}

// ── Presence (spec §1) ──────────────────────────────────────────────────────

const ACTIVITY_RE = /^[A-Za-z0-9_]{1,24}$/;
const ROUTE_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(MODE_ROUTES).map(([key, route]) => [route.replace(/^\//, ''), key]),
);

/**
 * The db key of the game on screen for the heartbeat's last_activity
 * ("/muddle" → SCRAMBLE, "/quadword/vs" → QUORDLE, "/vs/live/DUEL" → DUEL),
 * or null anywhere that is not a game. Always a key, never free text.
 */
export function activityKeyForPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const segs = pathname.split(/[?#]/)[0].split('/').filter(Boolean);
  if (segs.length === 0) return null;
  let key: string | null = null;
  if (segs[0] === 'vs' && segs[1] === 'live' && segs[2] && MODE_BY_DBKEY[segs[2]]) key = segs[2];
  else key = ROUTE_TO_KEY[segs[0]] ?? null;
  return key && ACTIVITY_RE.test(key) ? key : null;
}

export interface PresenceFriend {
  id: string;
  username: string;
  lastSeenAt?: string | null;
  activity?: string | null;
  playedToday?: number;
  todayPoints?: number;
  friendStreak?: number;
  h2hW?: number;
  h2hL?: number;
}

export function lastSeenMs(f: Pick<PresenceFriend, 'lastSeenAt'>): number | null {
  if (!f.lastSeenAt) return null;
  const t = Date.parse(f.lastSeenAt);
  return Number.isFinite(t) ? t : null;
}

export const friendOnline = (f: PresenceFriend, nowMs: number): boolean => isOnline(lastSeenMs(f), nowMs);

/** A friend row's second line: the presence line when there is one, else today's line. */
export function friendLine(f: PresenceFriend, nowMs: number, sweepCount: number): { text: string; online: boolean } {
  const online = friendOnline(f, nowMs);
  const p = presenceLine(lastSeenMs(f), f.activity ?? null, nowMs);
  if (p) return { text: p, online };
  const played = f.playedToday ?? 0;
  return { text: played > 0 ? `${played}/${sweepCount} today` : "Hasn't played today", online };
}

export type FriendAction = 'play' | 'challenge' | 'nudge';

/** One pill per row: on now → Play; played today → Challenge; otherwise → Nudge. */
export function friendAction(f: PresenceFriend, nowMs: number): FriendAction {
  if (friendOnline(f, nowMs)) return 'play';
  if ((f.playedToday ?? 0) > 0 || (f.todayPoints ?? 0) > 0) return 'challenge';
  return 'nudge';
}

/** Friends on now, the freshest heartbeat first. */
export function onNow<T extends PresenceFriend>(friends: T[], nowMs: number): T[] {
  return friends
    .filter((f) => friendOnline(f, nowMs))
    .sort((a, b) => (lastSeenMs(b) ?? 0) - (lastSeenMs(a) ?? 0) || a.username.localeCompare(b.username));
}

/** The two-word doing line under an ON NOW face. */
export const doingLine = (activity: string | null | undefined): string => (activity ? `in ${activity}` : 'on now');

/** The soft line when nobody is on: names the most recent presence (under a day). */
export function nobodyOnLine(friends: PresenceFriend[], nowMs: number): string {
  let best: PresenceFriend | null = null;
  let bestMs = -Infinity;
  for (const f of friends) {
    const t = lastSeenMs(f);
    if (t !== null && t <= nowMs && t > bestMs) { best = f; bestMs = t; }
  }
  const base = "Nobody's on right now";
  if (!best) return base;
  const m = Math.floor((nowMs - bestMs) / 60000);
  if (m >= 60 * 24) return base;
  const ago = m < 60 ? `${Math.max(1, m)} min ago` : `${Math.floor(m / 60)} h ago`;
  return `${base} · ${best.username} was here ${ago}`;
}

/** Quick-play friend picker: on now first, then the freshest presence, then A–Z. */
export function sortForPicker<T extends PresenceFriend>(friends: T[], nowMs: number): T[] {
  return [...friends].sort((a, b) => {
    const oa = friendOnline(a, nowMs) ? 1 : 0;
    const ob = friendOnline(b, nowMs) ? 1 : 0;
    if (oa !== ob) return ob - oa;
    const la = lastSeenMs(a) ?? 0;
    const lb = lastSeenMs(b) ?? 0;
    if (la !== lb) return lb - la;
    return a.username.localeCompare(b.username);
  });
}

/** The friend with the longest friend streak (shown in the banner's TODAY'S RACE row). */
export function bestFriendStreak(friends: PresenceFriend[]): { name: string; days: number } | null {
  let best: { name: string; days: number } | null = null;
  for (const f of friends) {
    const d = f.friendStreak ?? 0;
    if (d > 0 && (!best || d > best.days)) best = { name: f.username, days: d };
  }
  return best;
}

/** "You lead 5–3 · 12-day friend streak" under the quick-play header. */
export function rivalryLine(f: PresenceFriend): string {
  const w = f.h2hW ?? 0;
  const l = f.h2hL ?? 0;
  const parts: string[] = [];
  if (w + l > 0) parts.push(w === l ? `Tied ${w}–${l}` : w > l ? `You lead ${w}–${l}` : `They lead ${l}–${w}`);
  if ((f.friendStreak ?? 0) > 0) parts.push(`${f.friendStreak}-day friend streak`);
  return parts.join(' · ');
}

// ── Friends banner (spec §2.2) ──────────────────────────────────────────────

export interface BannerMe { id: string; username: string; todayPoints: number; playedToday: number }

/** Today's race (the same ranking Today's Race uses) and the core banner input. */
export function bannerModel(friends: PresenceFriend[], me: BannerMe, online: string[]): { rows: RaceRow[]; input: FriendsBannerInput } {
  const rows = rankToday([
    ...friends.map((f) => ({ id: f.id, username: f.username, points: f.todayPoints ?? 0, played: f.playedToday ?? 0, me: false })),
    { id: me.id, username: me.username, points: me.todayPoints, played: me.playedToday, me: true },
  ]);
  const mine = rows.find((r) => r.me)!;
  const leader = rows[0];
  const behind = rows.filter((r) => !r.me && r.points <= mine.points).map((r) => r.points);
  return {
    rows,
    input: {
      friendCount: friends.length,
      online,
      myRank: mine.rank,
      myPoints: mine.points,
      leaderName: leader.me ? 'You' : leader.username,
      leaderPoints: leader.points,
      nextPoints: behind.length ? Math.max(...behind) : 0,
    },
  };
}

/** The banner's three race chips: the top three, with you swapped in for third when you're lower. */
export function raceChips(rows: RaceRow[]): RaceRow[] {
  const top = rows.slice(0, 3);
  if (top.some((r) => r.me)) return top;
  const me = rows.find((r) => r.me);
  return me && top.length === 3 ? [top[0], top[1], me] : top;
}

/** HH:MM:SS to the next local midnight (today's race window). */
export function midnightClock(now: Date): string {
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  const secs = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
  return [Math.floor(secs / 3600), Math.floor((secs % 3600) / 60), secs % 60].map((n) => String(n).padStart(2, '0')).join(':');
}

// ── Games list + badge (spec §2.4, §5) ──────────────────────────────────────

export interface GameLike { id: string; yourTurn: boolean; status: string; updatedAt: string }

/** Your turn first, then the most recently moved. */
export function sortActiveGames<T extends GameLike>(games: T[]): T[] {
  return [...games].sort((a, b) => Number(b.yourTurn) - Number(a.yourTurn) || (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}

/** The Friends tab badge: pending incoming requests + active games where it's your turn. */
export function friendsBadgeCount(pendingRequests: number, games: GameLike[]): number {
  return pendingRequests + games.filter((g) => g.status === 'active' && g.yourTurn).length;
}

// ── Game screen (spec §4) ───────────────────────────────────────────────────

export const otherSide = (s: Side): Side => (s === 'a' ? 'b' : 'a');

/** The game screen's big headline: the core words, or the resign / expiry ending. */
export function screenHeadline(g: { state: FriendlyState; me: Side; status: string; result: string | null }): string {
  if (g.status === 'resigned') return g.result === 'win' ? 'THEY RESIGNED' : 'YOU RESIGNED';
  if (g.status === 'expired') return 'GAME EXPIRED';
  return friendlyHeadline(g.state, g.me);
}

/** Big scores for the window; Pass the Puzzle has none. */
export function scoreOf(s: FriendlyState, me: Side): { mine: number; theirs: number } | null {
  if (s.kind === 'pass') return null;
  return { mine: s.score[me], theirs: s.score[otherSide(me)] };
}

/** The sub line under the game headline: best-of, live while they're on, last round's result. */
export function gameSubLine(s: FriendlyState, me: Side, them: string, online: boolean): string {
  const THEM = them.toUpperCase();
  const parts: string[] = [];
  const turn = whoseTurn(s);
  switch (s.kind) {
    case 'rps': {
      parts.push('BEST OF 3');
      const last = s.rounds[s.rounds.length - 1];
      if (last) parts.push(last.winner === null ? `ROUND ${s.rounds.length} TIED` : `${last.winner === me ? 'YOU' : THEM} TOOK ROUND ${s.rounds.length}`);
      break;
    }
    case 'ttt': {
      parts.push('BEST OF 3');
      const last = s.games[s.games.length - 1];
      if (last) parts.push(last.winner === null ? `GAME ${s.games.length} DRAWN` : `${last.winner === me ? 'YOU' : THEM} TOOK GAME ${s.games.length}`);
      break;
    }
    case 'coin': {
      parts.push('BEST OF 5');
      const last = s.rounds[s.rounds.length - 1];
      if (last) parts.push(`${last.flip.toUpperCase()} · ${last.winner === me ? 'YOU' : THEM} WON IT`);
      break;
    }
    case 'pass':
      parts.push('ONE BOARD, TAKE TURNS');
      break;
  }
  if (online && turn !== null) parts.splice(1, 0, `LIVE, ${THEM} IS ON`);
  return parts.join(' · ');
}

/** Tic-Tac-Tile: the empty tiles that would win the game for `me` right now. */
export function tttThreats(board: CellMark[], me: Side): number[] {
  if (tttLine(board)) return [];
  const out: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    const next = [...board];
    next[i] = me;
    if (tttLine(next)?.side === me) out.push(i);
  }
  return out;
}

export type LetterState = 'correct' | 'present' | 'absent';
const RANK: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 };

export function tileState(t: string): LetterState {
  const u = t.toUpperCase();
  return u === 'CORRECT' ? 'correct' : u === 'PRESENT' ? 'present' : 'absent';
}

/** Pass the Puzzle keyboard: each letter's best state across every guess so far. */
export function passKeyStates(guesses: Array<{ word: string; tiles: string[] }>): Record<string, LetterState> {
  const out: Record<string, LetterState> = {};
  for (const g of guesses) {
    for (let i = 0; i < g.word.length; i++) {
      const letter = g.word[i].toUpperCase();
      const st = tileState(g.tiles[i] ?? 'ABSENT');
      if (!out[letter] || RANK[st] > RANK[out[letter]]) out[letter] = st;
    }
  }
  return out;
}

// ── Moments + reactions (spec §6) ───────────────────────────────────────────

export type ReactionKey = 'clap' | 'fire' | 'wow' | 'grr' | 'rematch';
export const REACTIONS: Array<{ key: Exclude<ReactionKey, 'rematch'>; glyph: string }> = [
  { key: 'clap', glyph: '👏' },
  { key: 'fire', glyph: '🔥' },
  { key: 'wow', glyph: '😱' },
  { key: 'grr', glyph: '😤' },
];
export const REACTION_GLYPH: Record<ReactionKey, string> = { clap: '👏', fire: '🔥', wow: '😱', grr: '😤', rematch: 'Rematch' };
const REACTION_ORDER: ReactionKey[] = ['clap', 'fire', 'wow', 'grr', 'rematch'];

export interface ReactionSlot { counts: Partial<Record<string, number>>; mine: string[] }

/** Toggle one of my reactions on a moment (optimistic; the server is idempotent). */
export function toggleReaction(slot: ReactionSlot | undefined, key: ReactionKey, on: boolean): ReactionSlot {
  const counts = { ...(slot?.counts ?? {}) };
  const mine = new Set(slot?.mine ?? []);
  const had = mine.has(key);
  if (on && !had) { mine.add(key); counts[key] = (counts[key] ?? 0) + 1; }
  if (!on && had) { mine.delete(key); counts[key] = Math.max(0, (counts[key] ?? 0) - 1); }
  return { counts, mine: [...mine] };
}

/** The chips under a moment: every reaction with a count, in the fixed order. */
export function reactionChips(slot: ReactionSlot | undefined): Array<{ key: ReactionKey; count: number; mine: boolean }> {
  if (!slot) return [];
  return REACTION_ORDER
    .filter((k) => (slot.counts[k] ?? 0) > 0)
    .map((k) => ({ key: k, count: slot.counts[k] ?? 0, mine: slot.mine.includes(k) }));
}

export interface GameMoment {
  me: boolean;
  username: string;
  kind?: string;
  gameTitle?: string | null;
  otherName?: string | null;
  score?: string | null;
}

/** "Doug beat you at Tic-Tac-Tile (2–1)", "You and Amy drew at Call It". */
export function gameMomentText(e: GameMoment): string {
  const who = e.me ? 'You' : e.username;
  const other = e.otherName ?? 'a friend';
  const title = e.gameTitle ?? 'a game';
  if (e.kind === 'draw') return `${who} and ${other} drew at ${title}`;
  const tail = !e.score ? '' : e.score === 'by resignation' ? ' by resignation' : ` (${e.score})`;
  return `${who} beat ${other} at ${title}${tail}`;
}
