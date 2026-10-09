// ============================================================
// Live pocket games (FRIDAY-QUEUE item 9b) — the shared brain.
// ============================================================
// Gate: isFeatureLive('live_play'). OFF = the old 2-second poll, nothing else changes.
//
// ON: one Supabase Realtime channel per game (`fg:<gameId>`).
//   - broadcast 'move'  — the server route sends the accepted move's view (built for the
//     RECEIVER, so a hidden RPS pick stays hidden) the instant it is saved.
//   - postgres_changes on friendly_game_pings (game_id = id) — the backup: carries only a
//     revision number, the client refetches the game through the API.
//   - presence          — { user, thinking } so the header can say here / thinking / left.
//   - broadcast 'react' — a live emoji from the fixed reaction set.
// The socket carries the speed; GET /api/friends/games/<id> stays the source of truth and
// doubles as the keep-alive that stamps "watching" (so a watching friend is not pushed).
//
// This file is pure (no I/O) and mirrored by FriendlyLive.swift / FriendlyLive.kt; the merge
// and rollback rules below are pinned by friendly-live.test.ts.

import { applyFriendlyMove, whoseTurn, type FriendlyMove, type FriendlyState, type Side } from './friendly-games';

export const LIVE_PLAY_SWITCH = 'live_play';

export const liveTopic = (gameId: string): string => `fg:${gameId}`;
export const LIVE_EVENT_MOVE = 'move';
export const LIVE_EVENT_REACT = 'react';
/** Postgres table the server touches on every change (a revision only, no game data). */
export const LIVE_PING_TABLE = 'friendly_game_pings';

/** The reaction set (same ids as moment_reactions). */
export const LIVE_REACTIONS = ['clap', 'fire', 'wow', 'grr', 'rematch'] as const;
export type LiveReaction = (typeof LIVE_REACTIONS)[number];
export const isLiveReaction = (v: unknown): v is LiveReaction => typeof v === 'string' && (LIVE_REACTIONS as readonly string[]).includes(v);
/** At most one reaction every this many ms per player (client-side throttle). */
export const LIVE_REACT_COOLDOWN_MS = 1200;
/** A floating reaction bubble lives this long. */
export const LIVE_REACT_LIFETIME_MS = 2400;

/** Poll cadence (ms). `off` = switch off (today's behaviour). */
export const LIVE_POLL_MS = { off: 2000, socketDown: 4000, keepAlive: 20000 } as const;
export function pollIntervalMs(liveOn: boolean, socketUp: boolean): number {
  if (!liveOn) return LIVE_POLL_MS.off;
  return socketUp ? LIVE_POLL_MS.keepAlive : LIVE_POLL_MS.socketDown;
}

/** How long the optimistic move may wait for the server before it is rolled back (ms). */
export const LIVE_OPTIMISTIC_TIMEOUT_MS = 8000;

// ── Presence ────────────────────────────────────────────────────────────────

export type PresenceLabel = 'here' | 'thinking' | 'left' | 'away';

export interface PresenceInput {
  /** The friend is in the channel's presence list right now. */
  peerPresent: boolean;
  /** They were in it at some point since I opened the game. */
  everSeen: boolean;
  /** Their move is the one the game waits for. */
  theirTurn: boolean;
  /** Their own presence meta said they are mid-move (typing / picking). */
  peerThinking?: boolean;
}

/** here / thinking / left the game / away (never joined). */
export function presenceLabel(i: PresenceInput): PresenceLabel {
  if (i.peerPresent) return i.theirTurn || i.peerThinking ? 'thinking' : 'here';
  return i.everSeen ? 'left' : 'away';
}

export const PRESENCE_COPY: Record<PresenceLabel, string> = {
  here: 'HERE NOW',
  thinking: 'THINKING…',
  left: 'LEFT THE GAME',
  away: '',
};

// ── Views, staleness, change detection ──────────────────────────────────────

/** The slice of a game view the live rules need (GameView on every platform has these). */
export interface LiveViewLike {
  id: string;
  me: Side;
  state: FriendlyState;
  status: 'active' | 'done' | 'resigned' | 'expired';
  yourTurn: boolean;
  updatedAt: string;
}

const ms = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

/** True when `next` is a strictly newer save than `cur` (or there is nothing on screen yet). */
export function isNewer(cur: { updatedAt: string } | null | undefined, next: { updatedAt: string }): boolean {
  if (!cur) return true;
  return ms(next.updatedAt) > ms(cur.updatedAt);
}

export interface LiveChange {
  /** The state is different from what was on screen. */
  moved: boolean;
  /** It was not my turn and now it is. */
  yourTurnStarted: boolean;
  /** Active to over. */
  ended: boolean;
}

const NO_CHANGE: LiveChange = { moved: false, yourTurnStarted: false, ended: false };
const sameState = (a: FriendlyState, b: FriendlyState): boolean => JSON.stringify(a) === JSON.stringify(b);

export function describeChange(prev: LiveViewLike | null, next: LiveViewLike): LiveChange {
  if (!prev) return NO_CHANGE;
  return {
    moved: !sameState(prev.state, next.state),
    yourTurnStarted: !prev.yourTurn && next.yourTurn && next.status === 'active',
    ended: prev.status === 'active' && next.status !== 'active',
  };
}

// ── Optimistic moves ────────────────────────────────────────────────────────

/**
 * The state after MY move, when the client can know it without the server:
 *  - Tic-Tac-Tile: always (pure board rules).
 *  - Rock Paper Scissors: my pick locks in; the round only resolves if the friend's pick is
 *    still unseen (a 'hidden' pick means the reveal needs the server).
 *  - Word Chain: the word is appended (the word-list check is the server's; a rejection rolls it back).
 * Call It (server coin), Pass the Puzzle (hidden answer) and Ghost (word lists decide the round)
 * return null: they wait for the server.
 */
export function predictMove(state: FriendlyState, side: Side, move: FriendlyMove): FriendlyState | null {
  switch (state.kind) {
    case 'ttt': {
      const r = applyFriendlyMove(state, side, move);
      return r.ok ? r.state : null;
    }
    case 'rps': {
      if (move.kind !== 'rps' || state.picks[side]) return null;
      if (state.picks[side === 'a' ? 'b' : 'a']) return null; // resolving the round needs their (hidden) pick
      const r = applyFriendlyMove(state, side, move);
      return r.ok ? r.state : null;
    }
    case 'chain': {
      if (move.kind !== 'chain') return null;
      const r = applyFriendlyMove(state, side, move);
      return r.ok ? r.state : null; // no ctx: the list/blocked checks are skipped, shape rules still run
    }
    default:
      return null;
  }
}

export interface LivePending {
  move: FriendlyMove;
  predicted: FriendlyState;
  /** updatedAt of the confirmed game the prediction was made on. */
  baseUpdatedAt: string;
}

export interface LiveSnapshot<V extends LiveViewLike> {
  confirmed: V | null;
  pending: LivePending | null;
}

export const emptySnapshot = <V extends LiveViewLike>(): LiveSnapshot<V> => ({ confirmed: null, pending: null });

/** What to draw: the confirmed game, with my predicted state over it while the move is in flight. */
export function displayed<V extends LiveViewLike>(snap: LiveSnapshot<V>): V | null {
  const c = snap.confirmed;
  if (!c) return null;
  const p = snap.pending;
  if (!p || p.baseUpdatedAt !== c.updatedAt) return c;
  const turn = whoseTurn(p.predicted);
  return { ...c, state: p.predicted, yourTurn: turn === 'both' || turn === c.me };
}

/** I tapped. Returns the snapshot with the prediction attached (unchanged when there is none). */
export function beginMove<V extends LiveViewLike>(snap: LiveSnapshot<V>, move: FriendlyMove): { snap: LiveSnapshot<V>; optimistic: boolean } {
  const c = snap.confirmed;
  if (!c || c.status !== 'active' || snap.pending) return { snap, optimistic: false };
  const predicted = predictMove(c.state, c.me, move);
  if (!predicted) return { snap, optimistic: false };
  return { snap: { confirmed: c, pending: { move, predicted, baseUpdatedAt: c.updatedAt } }, optimistic: true };
}

/** The server accepted my move: the prediction is replaced by its answer (never an older save). */
export function confirmMove<V extends LiveViewLike>(snap: LiveSnapshot<V>, serverView: V): LiveSnapshot<V> {
  const keep = !snap.confirmed || isNewer(snap.confirmed, serverView) ? serverView : snap.confirmed;
  return { confirmed: keep, pending: null };
}

/** The server said no (or the call failed): drop the prediction. `rolledBack` tells the UI to shake. */
export function rejectMove<V extends LiveViewLike>(snap: LiveSnapshot<V>): { snap: LiveSnapshot<V>; rolledBack: boolean } {
  return { snap: { confirmed: snap.confirmed, pending: null }, rolledBack: !!snap.pending };
}

/**
 * A view arrived from somewhere other than my own move's reply (broadcast, backup ping refetch,
 * keep-alive poll). Older or identical saves are ignored. A newer save replaces the confirmed
 * game; my prediction survives only if it was made on that very save.
 */
export function receiveView<V extends LiveViewLike>(snap: LiveSnapshot<V>, incoming: V): { snap: LiveSnapshot<V>; applied: boolean; change: LiveChange } {
  if (!isNewer(snap.confirmed, incoming)) return { snap, applied: false, change: NO_CHANGE };
  const change = describeChange(snap.confirmed, incoming);
  const stillValid = !!snap.pending && snap.pending.baseUpdatedAt === incoming.updatedAt;
  return { snap: { confirmed: incoming, pending: stillValid ? snap.pending : null }, applied: true, change };
}
