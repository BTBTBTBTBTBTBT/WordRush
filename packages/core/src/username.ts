/**
 * Username screening — shared by web, iOS, Android and (mirrored) the DB.
 *
 * Usernames appear on every public leaderboard, on public profiles and in VS
 * match callouts, so an offensive one is visible to everyone before any human
 * sees a report. Validation was LENGTH ONLY at every layer — client, web and
 * database — which is Play UGC-policy exposure (and App Store 1.2).
 *
 * The authoritative check is the database trigger in
 * supabase/migrations/20260730000001_username_profanity.sql: the profile write
 * goes straight to PostgREST under RLS, so anything enforced only in an app is
 * bypassable with one curl. This module exists so the apps can show a friendly
 * message BEFORE the round trip, and so all four layers share one word list —
 * `username.test.ts` fails if the SQL and this file drift.
 */

/**
 * Terms that are never acceptable inside a username, in any position.
 * Sourced from scripts/data/offensive-blocklist.txt, the same list the word
 * curator uses to keep slurs out of the answer banks (added 2026-07-17 after
 * one was served as a Gauntlet answer). Kept as a single source of truth
 * rather than a second hand-typed copy.
 */
export const USERNAME_BLOCKED_SUBSTRINGS: readonly string[] = [
  // Slur list — mirrored from scripts/data/offensive-blocklist.txt.
  'NEGRO', 'NIGER', 'NIGGA', 'NIGGER', 'CHINK', 'SPICK', 'SPIC', 'KIKES', 'KIKE',
  'WETBACK', 'GOOKS', 'GOOK', 'DAGOS', 'DAGO', 'WOPS', 'COON', 'COONS',
  'TRANNY', 'TRANNIES', 'FAGGOT', 'FAGGY', 'FAGS', 'DYKES', 'DYKE',
  'RETARD', 'RETARDS', 'CRIPPLE', 'MONGOLOID', 'SHEMALE', 'HEEBS', 'HEEB',
  'PAKIS', 'PAKI', 'ABBOS', 'ABBO', 'SLANT', 'ZIPPERHEAD', 'RAGHEAD', 'TOWELHEAD',
  // Sexual/graphic terms that are unambiguous as substrings.
  'CUNT', 'FUCK', 'SHIT', 'PORN', 'RAPE', 'RAPIST', 'PEDO', 'PAEDO', 'NAZI', 'HITLER',
] as const;

/**
 * Innocent words that CONTAIN a blocked term. Each is removed from the
 * normalised name before the blocklist is scanned, which is what makes
 * substring matching survivable — this is the Scunthorpe problem, and the
 * first version of this file rejected the town, the mushroom and a couple of
 * real surnames until the test caught it.
 *
 * Stripping (rather than short-circuiting on an exact match) means the guard
 * still works on a compound: `Scunthorpe_Fan` passes, while `ScunthorpeCUNT`
 * is still rejected because removing SCUNTHORPE leaves the bare term behind.
 */
export const USERNAME_ALLOWED_CONTAINING: readonly string[] = [
  'SCUNTHORPE', 'PENISTONE', 'SHITAKE', 'SHIITAKE', 'LIGHTWATER',
  'CLITHEROE', 'ASSASSIN', 'ASSISI', 'COCKBURN', 'HANCOCK', 'BABCOCK',
  'MATSUSHITA', 'THERAPIST', 'ARSENAL', 'SUSSEX', 'MIDDLESEX', 'ESSEX',
] as const;

/**
 * Characters people substitute to smuggle a term past a naive filter.
 * Applied before matching, so `n1gg3r` and `f_u_c_k` are caught.
 */
const LEET: Record<string, string> = {
  '0': 'O', '1': 'I', '!': 'I', '|': 'I', '3': 'E', '4': 'A', '@': 'A',
  '5': 'S', '$': 'S', '7': 'T', '8': 'B', '9': 'G', '6': 'G', '+': 'T',
};

/**
 * Fold a username to the form the blocklist is matched against: uppercase,
 * leet-substituted, separators removed, and runs of a repeated letter
 * collapsed (so `niiiggerrr` normalises to the base term).
 */
export function normalizeUsername(raw: string): string {
  const substituted = raw
    .toUpperCase()
    .split('')
    .map((ch) => LEET[ch] ?? ch)
    .join('');
  const lettersOnly = substituted.replace(/[^A-Z]/g, '');
  return lettersOnly.replace(/(.)\1+/g, '$1');
}

export interface UsernameCheck {
  ok: boolean;
  /** User-facing reason. Never quotes the matched term back at them. */
  error?: string;
}

/**
 * Full username validation: shape first, then content.
 *
 * NOTE on substring matching and the Scunthorpe problem: every term above is
 * long enough (4+) and specific enough that an innocent English word does not
 * contain it. Do NOT add short or common terms here — `ASS` would reject
 * "Cassandra" and `HELL` would reject "Michelle". Milder profanity is
 * deliberately absent for that reason; this list targets slurs and graphic
 * terms, not rudeness.
 */
export function validateUsername(raw: string): UsernameCheck {
  const trimmed = raw.trim();

  if (trimmed.length < 3 || trimmed.length > 20) {
    return { ok: false, error: 'Username must be 3-20 characters' };
  }
  // Letters, digits, and a few separators. Blocks control characters, RTL
  // overrides and zero-width joiners, all of which can be used to spoof
  // another player's name on a leaderboard.
  if (!/^[A-Za-z0-9 ._-]+$/.test(trimmed)) {
    return { ok: false, error: 'Use letters, numbers, spaces, and . _ - only' };
  }
  if (!/[A-Za-z0-9]/.test(trimmed)) {
    return { ok: false, error: 'Username needs at least one letter or number' };
  }

  // Strip known-innocent words FIRST, so "Scunthorpe" doesn't trip CUNT.
  let normalized = normalizeUsername(trimmed);
  for (const safe of USERNAME_ALLOWED_CONTAINING) {
    normalized = normalized.split(normalizeUsername(safe)).join('');
  }

  for (const term of USERNAME_BLOCKED_SUBSTRINGS) {
    // The blocklist is stored unnormalised for readability, so fold it the
    // same way before comparing — otherwise a term with a doubled letter
    // (KIKES -> KIKES) would never match its own collapsed form.
    if (normalized.includes(normalizeUsername(term))) {
      return { ok: false, error: 'That username isn’t available. Please choose another.' };
    }
  }

  return { ok: true };
}
