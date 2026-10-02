import { shareCaption } from '@wordle-duel/core';

// Pure helpers behind the friend-invite and gift-a-week-of-Pro screens
// (docs/FINISH_SPEC.md T1–T4; components/friends/invite-screens.tsx). No
// React, no DOM: node-tested in lib/invite-screens.test.ts.

/** Gift-Pro invites a Pro player can have out at once (the referral program's slots). */
export const GIFT_SLOTS = 3;

/** Days of Pro a gift unlocks. */
export const GIFT_DAYS = 7;

/** An invite code split into the glossy letter tiles it is shown on (T1): uppercase letters and digits only. */
export function codeTiles(code: string | null | undefined): string[] {
  return Array.from((code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
}

/** The invite code at the end of an invite link (`…/vs/join/AB12CD` → `AB12CD`), or null. */
export function codeFromInviteUrl(url: string | null | undefined): string | null {
  const m = (url ?? '').match(/\/join\/([A-Za-z0-9]+)\/?(?:[?#].*)?$/);
  return m ? m[1].toUpperCase() : null;
}

/** Gift slots still free, from the count of open (pending, unexpired) gifts. */
export function giftsLeft(openCount: number, slots: number = GIFT_SLOTS): number {
  return Math.max(0, Math.min(slots, slots - Math.max(0, Math.floor(openCount))));
}

function today(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The shared invite line (core shareCaption 'invite', S4) WITHOUT the link, for
 * share sheets that carry the url separately (iOS then previews the link card).
 */
export function inviteShareText(url: string, now: Date = new Date()): string {
  const line = shareCaption('invite', { date: today(now), game: 'Wordocious', url });
  return line.replace(` ${url}`, '').replace(url, '').trim();
}

/** The gift-a-week-of-Pro share text: the shared invite line plus the gift (link carried separately). */
export function giftShareText(url: string, now: Date = new Date()): string {
  return `${inviteShareText(url, now)} I'm gifting you ${GIFT_DAYS} days of Wordocious Pro 🎁`;
}

/** localStorage key: outgoing friend requests this browser is watching for an accept (the inviter's NEW FRIENDS! card). */
export const WATCHED_REQUESTS_KEY = 'wr_watch_friend_requests';

/**
 * The inviter's side of T3: which watched outgoing requests turned into
 * friends (celebrate them once), and the ids to keep watching. A watched id
 * that is neither still outgoing nor a friend was declined or canceled and is
 * dropped. Ids compare case-insensitively; returned ids keep their first spelling.
 */
export function trackRequests(
  watched: readonly string[],
  outgoing: readonly string[],
  friends: readonly string[],
): { accepted: string[]; watch: string[] } {
  const low = (s: string) => s.toLowerCase();
  const out = new Set(outgoing.map(low));
  const fr = new Set(friends.map(low));
  const accepted: string[] = [];
  const watch: string[] = [];
  const seen = new Set<string>();
  for (const id of [...watched, ...outgoing]) {
    const k = low(id);
    if (seen.has(k)) continue;
    seen.add(k);
    if (fr.has(k)) {
      if (watched.some((w) => low(w) === k)) accepted.push(id);
    } else if (out.has(k)) {
      watch.push(id);
    }
  }
  return { accepted, watch };
}

/** Parse the watched-requests list from storage (anything malformed → empty). */
export function parseWatched(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0).slice(0, 200) : [];
  } catch {
    return [];
  }
}
