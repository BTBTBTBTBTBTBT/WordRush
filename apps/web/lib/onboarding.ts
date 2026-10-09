// First-run welcome + guided profile setup (docs/FINISH_SPEC.md AO, which
// supersedes W): who sees it, and when. Pure, so it's testable;
// components/onboarding/first-run-tour.tsx reads the inputs and acts on the
// decision. The flag moved to `onboarded-v2`; anyone who already had
// `onboarded-v1` (they saw W's tour) is an existing player and is marked.
//
// "Has this player played?" — the cheapest existing signals, in order:
// 1. Local: any localStorage key a game writes the moment it is played or
//    finished on this browser (per-mode stats `wordle-duel-stats-<mode>`,
//    saved sessions `wordocious-session-<mode>-…`, the completed-board
//    snapshots, the play-limit counters `wordocious-plays…`, the More Games
//    saves `wordocious-<game>-daily|practice`, Gauntlet stats, the bot ladder).
// 2. Signed in: the profile row already loaded by AuthProvider — any wins,
//    losses, XP or a last-played date.
// Existing players never see the tour: the flag is set for them silently.

export const ONBOARDED_KEY = 'onboarded-v2';
/** W's flag: players who have it are existing players (marked v2 silently). */
export const LEGACY_ONBOARDED_KEY = 'onboarded-v1';
/**
 * Set when step 3 sends the player to sign up / sign in (an OAuth redirect or
 * an email confirmation leaves the page): the flow picks up at the profile
 * step when they come back.
 */
export const RESUME_KEY = 'wordocious-onboarding-resume';
/** window event that replays the tour from anywhere. */
export const TOUR_EVENT = 'wordocious:tour';
/** Replay link: Home with ?tour=1. */
export const TOUR_PARAM = 'tour';
export const TOUR_HREF = `/?${TOUR_PARAM}=1`;

/** localStorage key prefixes that mean "this browser has played a game". */
export const PLAYED_KEY_PREFIXES = [
  'wordle-duel-stats-',
  'wordocious-session-',
  'wordocious-completed-row',
  'wordocious-completed-more-row',
  'wordocious-plays',
  'wordocious-vs-plays',
  'wordocious-flawless-streak',
  'wordocious-pending-record-',
  'gauntlet-stats',
  'wd_cpu_progression_v1',
] as const;

/** The More Games saves: wordocious-<game>-daily / -practice (sudoku, hub, groups, …). */
const GAME_SAVE = /^wordocious-[a-z]+-(daily|practice)$/;

export function hasPlayedLocally(keys: readonly string[]): boolean {
  return keys.some((k) => GAME_SAVE.test(k) || PLAYED_KEY_PREFIXES.some((p) => k.startsWith(p)));
}

export interface ProfilePlaySignal {
  total_wins?: number | null;
  total_losses?: number | null;
  xp?: number | null;
  last_played_at?: string | null;
}

export function profileHasPlayed(p: ProfilePlaySignal | null | undefined): boolean {
  if (!p) return false;
  return (p.total_wins ?? 0) > 0 || (p.total_losses ?? 0) > 0 || (p.xp ?? 0) > 0 || !!p.last_played_at;
}

export type OnboardingDecision =
  /** Show the tour now. */
  | 'show'
  /** An existing player: set the flag silently, never show. */
  | 'mark'
  /** Nothing to do (already onboarded, or not on Home). */
  | 'skip'
  /** Not yet: auth / profile still loading, or the cold-start intro is running. */
  | 'wait';

export function onboardingDecision(i: {
  /** A replay was asked for (?tour=1 or the tour event). */
  tour: boolean;
  /** The `onboarded-v2` flag is set. */
  onboarded: boolean;
  /** W's `onboarded-v1` flag is set (an existing player). */
  legacyOnboarded?: boolean;
  playedLocally: boolean;
  authLoading: boolean;
  signedIn: boolean;
  profile: ProfilePlaySignal | null;
  pathname: string;
  /** The cold-start intro is on screen. */
  introRunning: boolean;
}): OnboardingDecision {
  if (i.tour) return i.introRunning ? 'wait' : 'show';
  if (i.onboarded) return 'skip';
  if (i.legacyOnboarded) return 'mark';
  if (i.playedLocally) return 'mark';
  if (i.authLoading) return 'wait';
  if (i.signedIn && !i.profile) return 'wait';
  if (profileHasPlayed(i.profile)) return 'mark';
  // First run: only at Home, after the cold-start intro.
  if (i.pathname !== '/' && i.pathname !== '') return 'skip';
  if (i.introRunning) return 'wait';
  return 'show';
}

/** All localStorage keys (empty when storage is blocked). */
export function localStorageKeys(): string[] {
  const out: string[] = [];
  try {
    for (let n = 0; n < localStorage.length; n++) {
      const k = localStorage.key(n);
      if (k) out.push(k);
    }
  } catch { /* blocked */ }
  return out;
}

export function isOnboarded(): boolean {
  try { return localStorage.getItem(ONBOARDED_KEY) === '1'; } catch { return true; } // no storage: never nag
}

export function isLegacyOnboarded(): boolean {
  try { return localStorage.getItem(LEGACY_ONBOARDED_KEY) === '1'; } catch { return false; }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
    localStorage.removeItem(RESUME_KEY);
  } catch { /* private mode */ }
}

export function readResume(): boolean {
  try { return localStorage.getItem(RESUME_KEY) === 'profile'; } catch { return false; }
}

export function setResume(on: boolean): void {
  try {
    if (on) localStorage.setItem(RESUME_KEY, 'profile');
    else localStorage.removeItem(RESUME_KEY);
  } catch { /* private mode */ }
}

// ── Step 3: the username picker ─────────────────────────────────────────────

/** Escapes LIKE wildcards so an ilike() lookup matches the name exactly (case-insensitive). */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const SUGGEST_PREFIX = ['Lucky', 'Witty', 'Clever', 'Swift', 'Brainy', 'Cosmic', 'Jolly', 'Mighty', 'Sunny', 'Zippy'];
const SUGGEST_SUFFIX = ['Words', 'Tiles', 'Puzzles', 'Plays', 'Guess', 'Letters'];

/**
 * Three username ideas (chips) from what the player typed (or their current
 * name): name + two digits, an adjective + name, name + a word suffix. Every
 * one passes validateUsername; `seed` picks the variants (stable per seed).
 */
export function usernameSuggestions(base: string, seed: number, validate: (s: string) => boolean): string[] {
  const core = (base.replace(/[^A-Za-z0-9]/g, '') || 'Player').slice(0, 12);
  const cap = core.charAt(0).toUpperCase() + core.slice(1);
  const n = Math.abs(Math.floor(seed)) || 1;
  const pick = <T,>(arr: readonly T[], k: number) => arr[(n * (k + 7)) % arr.length];
  const candidates = [
    `${core}${10 + (n % 90)}`,
    `${pick(SUGGEST_PREFIX, 1)}${cap}`,
    `${core}_${pick(SUGGEST_SUFFIX, 2)}`,
    `${pick(SUGGEST_PREFIX, 3)}${cap}${n % 10}`,
    `${cap}${pick(SUGGEST_SUFFIX, 4)}${(n % 89) + 10}`,
  ];
  const out: string[] = [];
  for (const c of candidates) {
    const name = c.slice(0, 20);
    if (out.length < 3 && validate(name) && !out.some((o) => o.toLowerCase() === name.toLowerCase()) && name.toLowerCase() !== base.trim().toLowerCase()) out.push(name);
  }
  return out;
}

/** Replay the tour, steps 1–2 only (Settings -> Help -> "Replay the app tour"). */
export function startTour(): void {
  try { window.dispatchEvent(new Event(TOUR_EVENT)); } catch { /* old browsers */ }
}
