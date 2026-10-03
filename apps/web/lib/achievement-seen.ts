// FINISH_SPEC BF1: the locally stored "seen" set of achievement keys. On app
// open / focus the client diffs the player's earned list against it and
// celebrates anything unseen (server-side awards from other devices, crons, the
// friendly-game opponent's request…). The very first run seeds it with
// everything already earned, so old unlocks never flood in. Pure diff + a tiny
// per-user storage wrapper (localStorage; every access guarded).

const PREFIX = 'wordocious-ach-seen:';
let currentUser: string | null = null;

/** Which earned keys to celebrate, and the seen set to store next. `seen` null = first run → seed, celebrate nothing. */
export function diffSeen(seen: readonly string[] | null, earned: ReadonlyArray<{ key: string; unlocked_at?: string | null }>): { fresh: string[]; next: string[] } {
  const keys = earned.map((e) => e.key);
  if (seen == null) return { fresh: [], next: [...new Set(keys)].sort() };
  const have = new Set(seen);
  // Oldest first, so a backlog plays in the order it was earned.
  const fresh = [...earned]
    .filter((e) => !have.has(e.key))
    .sort((a, b) => String(a.unlocked_at ?? '').localeCompare(String(b.unlocked_at ?? '')))
    .map((e) => e.key);
  return { fresh: [...new Set(fresh)], next: [...new Set([...seen, ...keys])].sort() };
}

/** The signed-in player whose seen set `markAchievementsSeen` writes to. */
export function setSeenUser(userId: string | null): void {
  currentUser = userId;
}

export function readSeen(userId: string): string[] | null {
  try {
    const raw = localStorage.getItem(PREFIX + userId);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((k) => typeof k === 'string') : null;
  } catch { return null; }
}

export function writeSeen(userId: string, keys: readonly string[]): void {
  try { localStorage.setItem(PREFIX + userId, JSON.stringify([...new Set(keys)].sort())); } catch { /* private mode */ }
}

/** Celebrated keys are seen (so the open / focus diff never replays them). No-op before the first seed. */
export function markAchievementsSeen(keys: readonly string[]): void {
  if (!currentUser || keys.length === 0) return;
  const seen = readSeen(currentUser);
  if (seen == null) return;
  writeSeen(currentUser, [...seen, ...keys]);
}

/** How many achievements the signed-in player has (their seen set), or null before it is seeded. */
export function seenCount(): number | null {
  if (!currentUser) return null;
  const s = readSeen(currentUser);
  return s ? s.length : null;
}
