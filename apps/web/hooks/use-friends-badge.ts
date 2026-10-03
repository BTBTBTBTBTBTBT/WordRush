'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { loadFriends, getIncoming, onFriendsChange } from '@/lib/friends-service';
import { loadGames, getActiveGames, onGamesChange } from '@/lib/friendly-games-client';
import { fetchPendingInvitesForUser } from '@/lib/invite-service';
import { fetchVsChallenges } from '@/lib/vs-challenges-client';
import { markSeen, seenStorageKey, unseenCount, waitingKeys } from '@/lib/friends-badge';

// FINISH_SPEC M: the Friends tab's candy badge count (lib/friends-badge.ts) —
// incoming requests + game invites / VS challenges waiting on the player +
// friendly games where it's their turn, counting only what they haven't seen.
// Opening Friends marks it all seen. Moved out of the bottom tab bar so the
// desktop top bar's tabs (components/ui/desktop-tabs.tsx) share ONE copy of
// the state and ONE set of fetches with it: every subscriber for the same
// player attaches to the same loader (ref-counted), so a page that mounts both
// tab rows still loads the waiting items once.

interface BadgeState {
  uid: string | null;
  keys: string[];
  seen: ReadonlySet<string>;
}

const EMPTY: BadgeState = { uid: null, keys: [], seen: new Set() };
let state: BadgeState = EMPTY;
const listeners = new Set<() => void>();

function update(patch: Partial<BadgeState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

let active: { uid: string; refs: number; stop: () => void } | null = null;

/** Start (or join) the loader for `uid`; returns the release. */
function attach(uid: string): () => void {
  if (active && active.uid === uid) {
    active.refs += 1;
  } else {
    active?.stop();
    let seen: Set<string>;
    try { seen = new Set(JSON.parse(localStorage.getItem(seenStorageKey(uid)) ?? '[]') as string[]); } catch { seen = new Set(); }
    update({ uid, keys: [], seen });
    let alive = true;
    const extra: { invites: string[]; challenges: string[] } = { invites: [], challenges: [] };
    const sync = () => {
      if (!alive) return;
      update({
        keys: waitingKeys({
          requests: getIncoming().map((f) => f.id),
          invites: extra.invites,
          challenges: extra.challenges,
          turns: getActiveGames().filter((g) => g.status === 'active' && g.yourTurn).map((g) => ({ id: g.id, updatedAt: g.updatedAt })),
        }),
      });
    };
    loadFriends().then(sync);
    loadGames().then(sync);
    // The invites + challenges the Friends / VS screens already load (no new backend).
    fetchPendingInvitesForUser(uid).then((list) => { extra.invites = list.map((i) => i.id); sync(); }).catch(() => {});
    fetchVsChallenges().then((c) => { extra.challenges = c.incoming.map((x) => x.code); sync(); }).catch(() => {});
    const offFriends = onFriendsChange(sync);
    const offGames = onGamesChange(sync);
    active = { uid, refs: 1, stop: () => { alive = false; offFriends(); offGames(); } };
  }
  const mine = active;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (active !== mine) return;
    mine.refs -= 1;
    if (mine.refs <= 0) { mine.stop(); active = null; }
  };
}

/**
 * The Friends badge count for the signed-in player (0 when signed out or
 * while on Friends). While `onFriends`, everything waiting is marked seen.
 */
export function useFriendsBadge(uid: string | null, onFriends: boolean): number {
  const s = useSyncExternalStore(subscribe, () => state, () => EMPTY);

  useEffect(() => {
    if (!uid) return;
    return attach(uid);
  }, [uid]);

  // Opening Friends marks everything waiting as seen (and keeps marking while there).
  useEffect(() => {
    if (!uid || s.uid !== uid || !onFriends || s.keys.length === 0) return;
    if (s.keys.every((k) => s.seen.has(k))) return;
    const next = markSeen([...s.keys]);
    update({ seen: new Set(next) });
    try { localStorage.setItem(seenStorageKey(uid), JSON.stringify(next)); } catch {}
  }, [uid, onFriends, s]);

  if (!uid || s.uid !== uid || onFriends) return 0;
  return unseenCount(s.keys, s.seen);
}
