/**
 * Play limit tracking for free users.
 *
 * Write-through cache: the authoritative source is the `play_limits`
 * table in Supabase, but we mirror the day's caps into localStorage so
 * the home-screen render loop can check `hasPlayedModeToday` synchronously
 * without a DB round-trip per card.
 *
 * Clearing site data no longer bypasses the cap — the next fetch from
 * DB rehydrates the cache on sign-in. Anonymous/signed-out usage falls
 * back to localStorage-only (same behavior as before).
 *
 * Free tier limits:
 * - 1 free play per game mode per day (daily puzzle is always free and doesn't count)
 * - 2 VS matches per day across all modes combined
 *
 * Resets at the user's LOCAL midnight (Wordle-style), matching daily
 * puzzle rollover.
 */

import { supabase } from './supabase-client';

const STORAGE_KEY_PREFIX = 'wordocious-plays';
const VS_STORAGE_KEY = 'wordocious-vs-plays';
const ACTIVE_UID_KEY = 'wordocious-active-uid';

// The play-limit cache MUST be scoped per signed-in user. Two different
// accounts on the same browser/device each get their own daily caps — a
// shared, date-only key let a prior user's completions leak into a freshly
// signed-in account (every mode showed "Play again in …" for a brand-new
// user). We keep the active user id in a module variable (hydrated from
// localStorage so the very first synchronous render after a reload reads the
// correct key) and fold it into every storage key.
let activeUserId: string | null = null;
if (typeof window !== 'undefined') {
  try { activeUserId = localStorage.getItem(ACTIVE_UID_KEY); } catch {}
}

/**
 * Point the play-limit cache at a specific user (or `null` for signed-out /
 * anonymous). Call on sign-in and sign-out so each account reads/writes its
 * own daily caps. Persisted so the next page load starts on the right key.
 */
export function setActivePlayUser(userId: string | null): void {
  activeUserId = userId;
  if (typeof window === 'undefined') return;
  try {
    if (userId) localStorage.setItem(ACTIVE_UID_KEY, userId);
    else localStorage.removeItem(ACTIVE_UID_KEY);
  } catch {}
}

function uidPart(): string {
  return activeUserId || 'anon';
}

function getTodayLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getStorageKey(): string {
  return `${STORAGE_KEY_PREFIX}-${uidPart()}-${getTodayLocal()}`;
}

function getVsStorageKey(): string {
  return `${VS_STORAGE_KEY}-${uidPart()}-${getTodayLocal()}`;
}

/** Get map of which modes have been played today */
function getDailyPlays(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(getStorageKey());
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function setDailyPlays(plays: Record<string, boolean>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(plays));
  } catch {}
}

/**
 * Hydrate the local cache from the DB for this user. Call once on sign-in
 * (or on home-screen mount when a user is present). Merges DB rows into
 * localStorage so freshly-cleared storage re-syncs from the server.
 */
export async function syncPlayLimits(userId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  // Make sure the cache is scoped to this user before we read/write it.
  setActivePlayUser(userId);
  const today = getTodayLocal();
  try {
    const { data } = await (supabase as any)
      .from('play_limits')
      .select('kind, mode_id, count')
      .eq('user_id', userId)
      .eq('day', today) as { data: Array<{ kind: string; mode_id: string | null; count: number }> | null };

    if (!data) return;
    const modePlays: Record<string, boolean> = { ...getDailyPlays() };
    let vsCount = getVsMatchesToday();
    for (const row of data) {
      if (row.kind === 'mode' && row.mode_id) modePlays[row.mode_id] = true;
      else if (row.kind === 'vs') vsCount = Math.max(vsCount, row.count);
    }
    setDailyPlays(modePlays);
    try {
      localStorage.setItem(getVsStorageKey(), String(vsCount));
    } catch {}
  } catch {
    // DB failure → fall through to localStorage-only behavior
  }
}

/** Record that a mode has been played (DB + localStorage). */
export function recordModePlayed(modeId: string): void {
  if (typeof window === 'undefined') return;
  const plays = getDailyPlays();
  plays[modeId] = true;
  setDailyPlays(plays);

  // Fire-and-forget DB write. Upsert matches the unique index on
  // (user_id, day, mode_id) where kind = 'mode'.
  (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await (supabase as any)
        .from('play_limits')
        .upsert(
          {
            user_id: user.id,
            day: getTodayLocal(),
            kind: 'mode',
            mode_id: modeId,
            count: 1,
          },
          { onConflict: 'user_id,day,mode_id' },
        );
    } catch {}
  })();
}

/** Check if a mode's free play has been used today (sync; reads cache). */
export function hasPlayedModeToday(modeId: string): boolean {
  const plays = getDailyPlays();
  return plays[modeId] === true;
}

/** Get VS match count for today (sync; reads cache). */
export function getVsMatchesToday(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const stored = localStorage.getItem(getVsStorageKey());
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

/** Record a VS match played (DB + localStorage). */
export function recordVsMatch(): void {
  if (typeof window === 'undefined') return;
  const count = getVsMatchesToday() + 1;
  try {
    localStorage.setItem(getVsStorageKey(), String(count));
  } catch {}

  (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Upsert the daily VS counter. The DB row always takes the max of
      // existing vs incoming so parallel tabs can't undercount.
      const today = getTodayLocal();
      const { data: existing } = await (supabase as any)
        .from('play_limits')
        .select('count')
        .eq('user_id', user.id)
        .eq('day', today)
        .eq('kind', 'vs')
        .maybeSingle();
      const next = Math.max(count, (existing?.count ?? 0) + 1);
      await (supabase as any)
        .from('play_limits')
        .upsert(
          { user_id: user.id, day: today, kind: 'vs', count: next },
          { onConflict: 'user_id,day' },
        );
    } catch {}
  })();
}

/** Check if free VS limit reached (2 per day) */
export function hasReachedVsLimit(): boolean {
  return getVsMatchesToday() >= 2;
}

/** Get seconds until the user's local midnight. (Renamed from the misleading
 *  getSecondsUntilMidnightUTC — it always computed LOCAL midnight, matching
 *  the local-day play-limit keys.) */
export function getSecondsUntilMidnightLocal(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}

/** Format seconds as HH:MM:SS */
export function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Clean up old localStorage entries (call on app load) */
export function cleanupOldPlayData(): void {
  if (typeof window === 'undefined') return;
  const today = getTodayLocal();
  // Legacy un-scoped keys (date only, no user id) from before the per-user
  // fix. These caused cross-account leakage, so purge them outright.
  const legacyMode = new RegExp(`^${STORAGE_KEY_PREFIX}-\\d{4}-\\d{2}-\\d{2}$`);
  const legacyVs = new RegExp(`^${VS_STORAGE_KEY}-\\d{4}-\\d{2}-\\d{2}$`);
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith(STORAGE_KEY_PREFIX) || key.startsWith(VS_STORAGE_KEY)) {
      // Always drop legacy un-scoped keys, and any dated key not for today.
      if (legacyMode.test(key) || legacyVs.test(key) || !key.endsWith(today)) {
        keysToRemove.push(key);
      }
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
}
