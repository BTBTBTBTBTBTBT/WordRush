/**
 * Play limit tracking for free users.
 * Uses localStorage to track daily plays per mode and VS matches.
 * Pro users bypass all limits.
 *
 * Free tier limits:
 * - 1 free play per game mode per day (daily puzzle is always free and doesn't count)
 * - 2 VS matches per day across all modes combined
 *
 * Resets at the user's LOCAL midnight (Wordle-style), matching daily
 * puzzle rollover.
 */

const STORAGE_KEY_PREFIX = 'wordocious-plays';
const VS_STORAGE_KEY = 'wordocious-vs-plays';

function getTodayLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getStorageKey(): string {
  return `${STORAGE_KEY_PREFIX}-${getTodayLocal()}`;
}

function getVsStorageKey(): string {
  return `${VS_STORAGE_KEY}-${getTodayLocal()}`;
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

/** Record that a mode has been played */
export function recordModePlayed(modeId: string): void {
  if (typeof window === 'undefined') return;
  const plays = getDailyPlays();
  plays[modeId] = true;
  localStorage.setItem(getStorageKey(), JSON.stringify(plays));
}

/** Check if a mode's free play has been used today */
export function hasPlayedModeToday(modeId: string): boolean {
  const plays = getDailyPlays();
  return plays[modeId] === true;
}

/** Get VS match count for today */
export function getVsMatchesToday(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const stored = localStorage.getItem(getVsStorageKey());
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

/** Record a VS match played */
export function recordVsMatch(): void {
  if (typeof window === 'undefined') return;
  const count = getVsMatchesToday();
  localStorage.setItem(getVsStorageKey(), String(count + 1));
}

/** Check if free VS limit reached (2 per day) */
export function hasReachedVsLimit(): boolean {
  return getVsMatchesToday() >= 2;
}

/** Get seconds until the user's local midnight */
export function getSecondsUntilMidnightUTC(): number {
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
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith(STORAGE_KEY_PREFIX) || key.startsWith(VS_STORAGE_KEY))) {
      if (!key.endsWith(today)) {
        keysToRemove.push(key);
      }
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
}
