// Friends overhaul (founder, 2026-10-01; spec docs/FRIENDS_REDESIGN_SPEC.md):
// the pure helpers behind the Friends tab, the quick-play sheet and the pocket
// game screens. The words every platform prints come from packages/core
// friendly-games.ts; this file only arranges them for the web (who is on, which
// action pill a row gets, the banner input, reactions, Tic-Tac-Tile threats,
// Pass the Puzzle key colors, Ghost tiles, Word Chain checks). No React, so vitest pins it.

import {
  CHAIN_TARGET, FRIENDLY_TARGET, FRIENDLY_TITLES, PASS_MAX_GUESSES, WORD_MAX, WORD_MIN, applyFriendlyMove, friendlyHeadline, isOnline, presenceLine, tttLine, whoseTurn,
  type CellMark, type ChainState, type FriendlyKind, type FriendlyState, type FriendsBannerInput, type GhostState, type Side,
} from '@wordle-duel/core';
import { ART_SIZE } from './art';
import { MODE_BY_DBKEY } from './modes.generated';
import { MODE_ROUTES } from './mode-routes';
import { rankToday, type RaceRow } from './todays-race';

// ── Look (spec §0) ──────────────────────────────────────────────────────────

export const FR = {
  ink: 'var(--fr-pink-ink, #831843)',
  mid: 'var(--fr-mid, #9d174d)',
  solid: '#db2777',
  soft: '#fce7f3',
  title: 'linear-gradient(90deg, #db2777, #7c3aed)',
  online: '#10b981',
  page: 'var(--fr-page, #f8f7ff)',
  label: 'var(--fr-label, #6b7280)',
  text: 'var(--fr-text, #1f2937)',
  // §11 (docs/ART_SPEC.md): the page's tinted shadow on a PageBackground, else the old one.
  cardShadow: 'var(--page-card-shadow, 0 2px 10px rgba(76,29,149,0.07))',
  flame: 'var(--fr-flame, #c2410c)',
  flameFill: '#f59e0b',
  teal: 'var(--fr-teal, #0f766e)',
  tealSoft: '#ccfbf1',
} as const;

/** Our tile colors (never Wordle green/yellow): purple = right / you, amber = present / them. */
export const TILE = { you: '#7c3aed', them: '#f59e0b', absent: '#cbd5e1' } as const;

export const KIND_COLOR: Record<FriendlyKind, string> = {
  rps: '#f97316', ttt: '#7c3aed', coin: '#ca8a04', pass: '#2563eb', ghost: '#9f1239', chain: '#059669',
};
export const KIND_GRADIENT: Record<FriendlyKind, string> = {
  rps: 'linear-gradient(90deg, #f97316, #db2777)',
  ttt: 'linear-gradient(90deg, #7c3aed, #db2777)',
  coin: 'linear-gradient(90deg, #ca8a04, #db2777)',
  pass: 'linear-gradient(90deg, #2563eb, #7c3aed)',
  ghost: 'linear-gradient(90deg, #9f1239, #7c3aed)',
  chain: 'linear-gradient(90deg, #059669, #2563eb)',
};
export const KIND_SUB: Record<FriendlyKind, string> = {
  rps: 'Best of 3 · our tiles',
  ttt: 'Three in a row, best of 3',
  coin: 'Heads or tails, best of 5',
  pass: 'One board, take turns',
  ghost: "Add a letter; don't finish a word",
  chain: 'Last letter starts the next',
};
/** Short names for the three-across tiles in the quick-play sheet. */
export const KIND_SHORT: Record<FriendlyKind, string> = {
  rps: 'Rock Paper Scissors', ttt: 'Tic-Tac-Tile', coin: 'Call It', pass: 'Pass the Puzzle', ghost: 'Ghost', chain: 'Word Chain',
};

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

// ── BJ13: the pocket-game friend picker (character-select grid) ────────────

/** The one rules line under the game's title: "Best of 3 · first to 2", "First to 30 points". */
export function kindRules(kind: FriendlyKind): string {
  if (kind === 'pass') return `${PASS_MAX_GUESSES === 6 ? 'Six' : PASS_MAX_GUESSES} guesses, shared board`;
  const t = FRIENDLY_TARGET[kind];
  if (kind === 'chain') return `First to ${t} points`;
  return `Best of ${2 * t - 1} · first to ${t}`;
}

/** A grid cell's one short status line: "On now", "20 min ago", "5 h ago", "Played today", a rivalry note, else "Away". */
export function pickerStatus(f: PresenceFriend, nowMs: number): { text: string; online: boolean } {
  if (friendOnline(f, nowMs)) return { text: 'On now', online: true };
  const last = lastSeenMs(f);
  if (last != null && nowMs >= last) {
    const m = Math.floor((nowMs - last) / 60_000);
    if (m < 60) return { text: `${Math.max(1, m)} min ago`, online: false };
    if (m < 60 * 24) return { text: `${Math.floor(m / 60)} h ago`, online: false };
  }
  if ((f.playedToday ?? 0) > 0) return { text: 'Played today', online: false };
  const w = f.h2hW ?? 0;
  const l = f.h2hL ?? 0;
  if (w + l > 0) return { text: w === l ? `Tied ${w}–${l}` : w > l ? `You lead ${w}–${l}` : `They lead ${l}–${w}`, online: false };
  return { text: 'Away', online: false };
}

/** The grid's column gap (px / pt / dp, same number on every platform; founder mockup pick-friend-1). */
export const PICKER_GAP = 8;
/** Cells never grow wider than this before another column is added (wide web → 4 across). */
export const PICKER_MAX_CELL = 96;
/** The avatar tile fills its cell, capped. */
export const PICKER_AVATAR_MAX = 124;

/** Columns + avatar size for a grid `width` wide: 3 on phones, 4 once cells would pass PICKER_MAX_CELL. */
export function pickerGrid(width: number): { cols: number; avatar: number } {
  const cols = Math.max(3, Math.floor((width + PICKER_GAP) / (PICKER_MAX_CELL + PICKER_GAP)));
  const cell = (width - PICKER_GAP * (cols - 1)) / cols;
  return { cols, avatar: Math.floor(Math.min(PICKER_AVATAR_MAX, cell)) };
}

/**
 * Title art for the picker, by name (docs/design/brand/titles/cast-colors/pocket-<kind>.png and
 * pick-friend.png, shipped as public/art/art-titlecast-pocket-<kind>.webp and
 * art-titlecast-pick-friend.webp). A kind without art draws its name in the live title
 * lettering instead. To ship one: drop the webp in public/art and record its size in
 * lib/art.ts ART_SIZE (art.test.ts already refuses an unrecorded file).
 */
export function pocketTitleArt(kind: FriendlyKind): readonly [number, number] | null {
  return (ART_SIZE as Record<string, readonly [number, number] | undefined>)[`art-titlecast-pocket-${kind}`] ?? null;
}
export const PICK_FRIEND_TITLE_ART: readonly [number, number] | null =
  (ART_SIZE as Record<string, readonly [number, number] | undefined>)['art-titlecast-pick-friend'] ?? null;

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
    case 'ghost': {
      parts.push('BEST OF 3');
      const last = s.rounds[s.rounds.length - 1];
      if (last) parts.push(`${last.loser === me ? THEM : 'YOU'} TOOK ROUND ${s.rounds.length}`);
      break;
    }
    case 'chain': {
      parts.push(`FIRST TO ${CHAIN_TARGET}`);
      const last = s.words[s.words.length - 1];
      if (last) parts.push(`${last.by === me ? 'YOU' : THEM} PLAYED ${last.word} +${last.points}`);
      break;
    }
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

// ── Ghost + Word Chain (spec §9) ───────────────────────────────────────────

/** Ghost: the fragment as tiles, each marked with who played it. */
export function ghostTiles(s: GhostState, me: Side): Array<{ letter: string; mine: boolean }> {
  return [...s.fragment].map((letter, i) => ({ letter, mine: s.letters[i] === me }));
}

/** Ghost: the soft card after a round — "CRANE — Doug spelled a word", "QZ — no word starts with that". */
export function ghostRoundCard(round: GhostState['rounds'][number], me: Side, them: string): { letters: string; text: string; youLost: boolean } {
  const youLost = round.loser === me;
  if (round.reason === 'word') return { letters: round.fragment, text: `${youLost ? 'you' : them} spelled a word`, youLost };
  return { letters: round.fragment, text: 'no word starts with that', youLost };
}

/** Word Chain: the letter the next word must start with (null on the opening word). */
export function chainNeededLetter(s: ChainState): string | null {
  const last = s.words[s.words.length - 1];
  return last ? last.word[last.word.length - 1] : null;
}

/**
 * Word Chain: the core's own error for this word before it goes to the server
 * (length, first letter, repeat); null when only the word list is left to check.
 */
export function chainPrecheck(s: ChainState, me: Side, word: string): string | null {
  const w = word.trim().toUpperCase();
  if (w.length < WORD_MIN || w.length > WORD_MAX) return `${WORD_MIN} to ${WORD_MAX} letters, please`;
  const r = applyFriendlyMove(s, me, { kind: 'chain', word: w });
  return r.ok ? null : r.error;
}

// ── Moments + reactions (spec §6) ───────────────────────────────────────────

export type ReactionKey = 'clap' | 'fire' | 'wow' | 'grr' | 'rematch';
/**
 * The reaction tray (FINISH_SPEC AM1): the stored keys never change; each one renders as our 3D
 * art (components/friends/reaction-icon.tsx, art-react-<key>) or, until that art ships, the
 * flame / a tinted word pill — never a phone emoji. `label` is the pill text and the a11y name.
 */
export const REACTIONS: Array<{ key: Exclude<ReactionKey, 'rematch'>; label: string }> = [
  { key: 'clap', label: 'Clap!' },
  { key: 'fire', label: 'Fire!' },
  { key: 'wow', label: 'Wow!' },
  { key: 'grr', label: 'Grr!' },
];
export const REACTION_LABEL: Record<ReactionKey, string> = { clap: 'Clap!', fire: 'Fire!', wow: 'Wow!', grr: 'Grr!', rematch: 'Rematch' };
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
