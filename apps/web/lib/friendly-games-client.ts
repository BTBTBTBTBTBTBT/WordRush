import type { FriendlyKind, FriendlyMove, FriendlyState, Side } from '@wordle-duel/core';
import { profileApiHeaders } from './profile-social';

/**
 * Friends pocket games — client (spec docs/FRIENDS_REDESIGN_SPEC.md §4). The
 * server runs every rule (apps/web/app/api/friends/games); this file only
 * calls it with the bearer token (the friends-service pattern) and keeps a
 * session cache of the active games for the Friends tab and its badge.
 */

export interface GameView {
  id: string;
  kind: FriendlyKind;
  title: string;
  me: Side;
  opponent: { id: string; username: string; avatarUrl: string | null; avatarEmoji: string | null };
  state: FriendlyState;
  status: 'active' | 'done' | 'resigned' | 'expired';
  yourTurn: boolean;
  result: 'win' | 'loss' | 'draw' | null;
  line: string;
  answer: string | null;
  createdAt: string;
  updatedAt: string;
}

let active: GameView[] = [];
let recent: GameView[] = [];
let loaded = false;
let fetchedAt = 0;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function onGamesChange(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const getActiveGames = (): GameView[] => active;
export const getRecentGames = (): GameView[] => recent;
export const gamesLoaded = (): boolean => loaded;

/** Load my games; a cached answer younger than 20 s is reused unless forced. */
export async function loadGames(force = false): Promise<void> {
  if (loaded && !force && Date.now() - fetchedAt < 20_000) return;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch('/api/friends/games', { headers: await profileApiHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      active = json.active ?? [];
      recent = json.recent ?? [];
      loaded = true;
      fetchedAt = Date.now();
      notify();
    } catch {
      // retry next call
    }
  })();
  try { await inflight; } finally { inflight = null; }
}

/** Fold one fresh game into the cache (the badge follows a move at once). */
function remember(g: GameView): void {
  const rest = active.filter((x) => x.id !== g.id);
  if (g.status === 'active') active = [g, ...rest];
  else {
    active = rest;
    recent = [g, ...recent.filter((x) => x.id !== g.id)].slice(0, 10);
  }
  notify();
}

async function post(path: string, body: Record<string, unknown>): Promise<Response | null> {
  try {
    return await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await profileApiHeaders()) },
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }
}

/** Start (or reopen — one open game per kind per pair) a game with a friend. */
export async function startGame(kind: FriendlyKind, friendId: string, stake?: string): Promise<{ game: GameView; existing: boolean } | { error: string }> {
  const res = await post('/api/friends/games', { kind, friendId, ...(stake ? { stake } : {}) });
  if (!res) return { error: 'Network error' };
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.game) return { error: json.error ?? 'Could not start the game' };
  remember(json.game);
  return { game: json.game as GameView, existing: !!json.existing };
}

/** One game (the screen polls this every 2 s). null = not found / not yours. */
export async function fetchGame(id: string): Promise<GameView | null | 'error'> {
  try {
    const res = await fetch(`/api/friends/games/${encodeURIComponent(id)}`, { headers: await profileApiHeaders() });
    if (res.status === 404) return null;
    if (!res.ok) return 'error';
    const json = await res.json();
    if (json.game) remember(json.game);
    return (json.game as GameView) ?? null;
  } catch {
    return 'error';
  }
}

export type MoveOutcome = { ok: true; game: GameView } | { ok: false; error: string; retry?: boolean };

/** Send a move. 400 → the rule's message (shown inline); 409 → refetch and try again. */
export async function sendMove(id: string, move: FriendlyMove): Promise<MoveOutcome> {
  const res = await post(`/api/friends/games/${encodeURIComponent(id)}/move`, { move });
  if (!res) return { ok: false, error: 'Network error. Try again.' };
  const json = await res.json().catch(() => ({}));
  if (res.ok && json.game) { remember(json.game); return { ok: true, game: json.game as GameView }; }
  if (res.status === 409) return { ok: false, error: json.error ?? 'The game moved on. Try again.', retry: !!json.retry };
  return { ok: false, error: json.error ?? 'That move did not go through' };
}

export async function resignGame(id: string): Promise<GameView | null> {
  const res = await post(`/api/friends/games/${encodeURIComponent(id)}/resign`, {});
  if (!res?.ok) return null;
  const json = await res.json().catch(() => ({}));
  if (json.game) remember(json.game);
  return (json.game as GameView) ?? null;
}

/** Test seam. */
export function __resetGamesCacheForTests(): void {
  active = [];
  recent = [];
  loaded = false;
  fetchedAt = 0;
  listeners.clear();
}
