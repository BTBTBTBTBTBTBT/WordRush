import { profileApiHeaders } from './profile-social';
import { getTodayLocal } from './daily-service';

/**
 * FRIENDS — client service (bible §207), the moderation-service shape:
 * one load per session into module caches, synchronous accessors for
 * render-time filtering, optimistic mutations. All writes go through
 * /api/friends/* (service-role routes — friendships has no client write
 * policies); the initial load ALSO uses GET /api/friends so one round trip
 * brings friends + requests with profile chrome.
 */

export interface FriendProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  avatar_emoji?: string | null;
  level: number;
  since?: string | null;
  requestedAt?: string;
  // Engagement digest (§212, additive): row status + weekly race + rivalry.
  streak?: number;
  playedToday?: number;
  weekPoints?: number;
  todayPoints?: number;
  h2hW?: number;
  h2hL?: number;
  remindedAt?: string | null;
}

/** Local YYYY-MM-DD — the same day boundary every daily surface uses. */
function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday of the current local week — the weekly race window. */
function localWeekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDay(d);
}

let friendIds = new Set<string>();
let friendsList: FriendProfile[] = [];
let incomingList: FriendProfile[] = [];
let outgoingIds = new Set<string>();
// Tier 1 (Aug 11): outgoing WITH profile chrome for the "Sent" section.
let outgoingList: FriendProfile[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

/** Subscribe to cache changes (accept/remove/etc.) — returns unsubscribe. */
export function onFriendsChange(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/**
 * Load (once per session) the caller's friends world. On failure the cache
 * stays unloaded so a later call retries — no throw, no UI break.
 */
export async function loadFriends(force = false): Promise<void> {
  if (loaded && !force) return;
  try {
    const res = await fetch(
      `/api/friends?day=${localDay()}&weekStart=${localWeekStart()}`,
      { headers: await profileApiHeaders() },
    );
    if (!res.ok) return;
    const json = await res.json();
    friendsList = json.friends ?? [];
    incomingList = json.incoming ?? [];
    friendIds = new Set(friendsList.map((f) => f.id.toLowerCase()));
    outgoingIds = new Set((json.outgoing ?? []).map((s: string) => s.toLowerCase()));
    outgoingList = json.outgoingProfiles ?? [];
    meDigest = json.me ?? null;
    loaded = true;
    notify();
  } catch {
    // retry next call
  }
}

/** The caller's own digest (playedToday/weekPoints) for the weekly podium. */
let meDigest: { playedToday: number; weekPoints: number; todayPoints?: number } | null = null;
export const getMeDigest = (): { playedToday: number; weekPoints: number; todayPoints?: number } | null => meDigest;

/** Nudge a pending invite (§212) — 24h rate limit lives server-side. */
export async function remindFriend(addresseeId: string): Promise<{ remindedAt?: string; error?: string }> {
  const res = await post('/api/friends/remind', { addresseeId });
  if (!res) return { error: 'Network error' };
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { error: json.error ?? 'Could not remind' };
  outgoingList = outgoingList.map((r) => (r.id === addresseeId ? { ...r, remindedAt: json.remindedAt } : r));
  notify();
  return { remindedAt: json.remindedAt };
}

export const friendsLoaded = (): boolean => loaded;
export const isFriend = (userId: string): boolean => friendIds.has(userId.toLowerCase());
export const hasRequested = (userId: string): boolean => outgoingIds.has(userId.toLowerCase());
export const hasIncomingFrom = (userId: string): boolean =>
  incomingList.some((r) => r.id.toLowerCase() === userId.toLowerCase());
export const getFriends = (): FriendProfile[] => friendsList;
export const getIncoming = (): FriendProfile[] => incomingList;
export const getOutgoing = (): FriendProfile[] => outgoingList;
export const getFriendIds = (): Set<string> => friendIds;

/**
 * Username typeahead for the Add-friend field (Aug 11) — prefix-first
 * matches from /api/friends/search so invites go to the right person.
 */
export async function searchUsers(q: string): Promise<FriendProfile[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  try {
    const res = await fetch(`/api/friends/search?q=${encodeURIComponent(query)}`, {
      headers: await profileApiHeaders(),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.users ?? [];
  } catch {
    return [];
  }
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

/**
 * Send a friend request by id or username. Returns the resulting state so
 * buttons can render without refetching ('accepted' happens on mutual
 * requests), or an error string for the add-by-username field.
 */
export async function requestFriend(
  target: { addresseeId?: string; username?: string },
): Promise<{ status: 'pending' | 'accepted'; friendId: string } | { error: string }> {
  const res = await post('/api/friends/request', target);
  if (!res) return { error: 'Network error' };
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { error: json.error ?? 'Could not send request' };
  const friendId = String(json.friendId ?? '');
  if (json.status === 'accepted') {
    friendIds.add(friendId.toLowerCase());
    incomingList = incomingList.filter((r) => r.id !== friendId);
    void loadFriends(true); // pull the profile chrome for the new friend
  } else {
    outgoingIds.add(friendId.toLowerCase());
    void loadFriends(true); // pull profile chrome for the new Sent row
  }
  notify();
  return { status: json.status, friendId };
}

/** Accept an incoming request. Optimistic on the caches. */
export async function acceptFriend(requesterId: string): Promise<boolean> {
  const req = incomingList.find((r) => r.id === requesterId);
  incomingList = incomingList.filter((r) => r.id !== requesterId);
  friendIds.add(requesterId.toLowerCase());
  if (req) friendsList = [...friendsList, { ...req, since: new Date().toISOString() }];
  notify();
  const res = await post('/api/friends/accept', { requesterId });
  return !!res?.ok;
}

/** Decline an incoming request (or cancel an outgoing one). */
export async function declineFriend(requesterId: string): Promise<boolean> {
  incomingList = incomingList.filter((r) => r.id !== requesterId);
  outgoingIds.delete(requesterId.toLowerCase());
  outgoingList = outgoingList.filter((r) => r.id !== requesterId);
  notify();
  const res = await post('/api/friends/decline', { requesterId });
  return !!res?.ok;
}

/** Unfriend. Optimistic; also invoked by the block flow. */
export async function removeFriend(friendId: string): Promise<boolean> {
  friendIds.delete(friendId.toLowerCase());
  friendsList = friendsList.filter((f) => f.id !== friendId);
  outgoingIds.delete(friendId.toLowerCase());
  outgoingList = outgoingList.filter((r) => r.id !== friendId);
  notify();
  const res = await post('/api/friends/remove', { friendId });
  return !!res?.ok;
}

/**
 * Fire-and-forget overtake check after a daily result saves — the server
 * re-reads the trusted score and pushes any friends we just passed.
 */
export function beatCheck(day: string, gameMode: string, playType: 'solo' | 'vs' = 'solo'): void {
  void post('/api/friends/beat-check', { day, gameMode, playType });
}

/** Send a canned taunt. 429 → { alreadySent: true }. */
export async function sendTaunt(
  friendId: string,
  tauntId: string,
): Promise<{ sent: boolean; alreadySent?: boolean }> {
  const res = await post('/api/friends/taunt', {
    friendId,
    tauntId,
    day: getTodayLocal(),
  });
  if (!res) return { sent: false };
  if (res.status === 429) return { sent: false, alreadySent: true };
  return { sent: res.ok };
}

/** Test seam. */
export function __resetFriendsCacheForTests(): void {
  friendIds = new Set();
  friendsList = [];
  incomingList = [];
  outgoingIds = new Set();
  loaded = false;
  listeners.clear();
}
