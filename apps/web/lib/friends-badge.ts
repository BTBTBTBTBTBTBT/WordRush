// The Friends tab notification badge (docs/FINISH_SPEC.md M). Pure: what is
// waiting on the player, which of it is new (unseen), and the words. The
// count = incoming friend requests + game invites / VS challenges waiting on
// the player + friendly games where it's their turn. Opening Friends marks
// everything waiting as seen (the badge clears); it comes back only for new
// items — a new request / invite / challenge, or a NEW move in a game (the
// game's updatedAt is part of its key).

export interface FriendsWaiting {
  /** Incoming friend-request user ids. */
  requests: string[];
  /** Pending game-invite ids. */
  invites: string[];
  /** Open VS challenge codes sent to the player. */
  challenges: string[];
  /** Friendly games where it's the player's turn. */
  turns: Array<{ id: string; updatedAt: string }>;
}

/** One stable key per waiting item. */
export function waitingKeys(w: FriendsWaiting): string[] {
  return [
    ...w.requests.map((id) => `req:${id}`),
    ...w.invites.map((id) => `inv:${id}`),
    ...w.challenges.map((code) => `ch:${code}`),
    ...w.turns.map((g) => `turn:${g.id}:${g.updatedAt}`),
  ];
}

/** How many waiting items the player hasn't seen yet. */
export function unseenCount(keys: string[], seen: ReadonlySet<string>): number {
  return keys.filter((k) => !seen.has(k)).length;
}

/** The seen set after opening Friends: everything waiting now (older keys dropped, so it never grows without bound). */
export function markSeen(keys: string[]): string[] {
  return Array.from(new Set(keys)).slice(0, 300);
}

/** The badge text: 1–9, then "9+". */
export function badgeText(n: number): string {
  return n > 9 ? '9+' : String(Math.max(0, n));
}

/** The tab's accessible name: "Friends" or "Friends, 3 new". */
export function friendsTabLabel(n: number): string {
  return n > 0 ? `Friends, ${n} new` : 'Friends';
}

/** localStorage key for a player's seen set. */
export function seenStorageKey(userId: string): string {
  return `wordocious-friends-seen:${userId}`;
}
