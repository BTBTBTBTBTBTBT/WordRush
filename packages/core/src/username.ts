/**
 * Username screening — shared by web, iOS, Android and (mirrored) the DB.
 *
 * Usernames appear on every public leaderboard, on public profiles and in VS
 * match callouts, so an offensive one is visible to everyone before any human
 * sees a report. Validation was LENGTH ONLY at every layer — client, web and
 * database — which is Play UGC-policy exposure (and App Store 1.2).
 *
 * The authoritative check is the database trigger — originally
 * supabase/migrations/20260730000001_username_profanity.sql, superseded by
 * supabase/manual-migrations/20260805000001_username_guard_db.sql (tier-2
 * tokens + the 2026-08-04 term additions): the profile write goes straight to
 * PostgREST under RLS, so anything enforced only in an app is bypassable with
 * one curl. This module exists so the apps can show a friendly message BEFORE
 * the round trip, and so all layers share one word list — `username.test.ts`
 * fails if the SQL and this file drift.
 */

/**
 * Terms that are never acceptable inside a username, in any position.
 * Sourced from scripts/data/offensive-blocklist.txt + manual-blocklist.txt's
 * crude tier, the same lists the word curator uses to keep slurs out of the
 * answer banks (added 2026-07-17 after one was served as a Gauntlet answer).
 * Kept as a single source of truth rather than a second hand-typed copy.
 *
 * 2026-08-04: extended after "DamnDickCockBallsAss" sailed through — the list
 * targeted slurs + a handful of graphic terms and deliberately excluded ALL
 * milder profanity, so a name made entirely of it matched nothing. Policy now:
 *   - Tier 1 (this list): slurs + strong/graphic profanity, matched as
 *     SUBSTRINGS of the collapsed form. Only terms whose collapsed form does
 *     not occur inside innocent words (or whose few carriers are in
 *     USERNAME_ALLOWED_CONTAINING) belong here.
 *   - Tier 2 (USERNAME_BLOCKED_TOKENS): mild-but-clearly-crude words that DO
 *     occur inside innocent names (ASS in Cassandra, TIT in Titan), matched
 *     only as whole tokens — see the token rule below.
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
  // 2026-08-04 additions — strong profanity that is safe as a substring once
  // its innocent carriers (Dickens, Hitchcock, Swank, Heraclitus, Atwater…)
  // are stripped by USERNAME_ALLOWED_CONTAINING. Mirrored from the crude tier
  // of scripts/data/manual-blocklist.txt where present there.
  'DICK', 'COCK', 'PENIS', 'PUSSY', 'BITCH', 'WANK', 'DILDO', 'WHORE', 'SLUT',
  'CLIT', 'TWAT', 'JIZZ', 'BLOWJOB',
] as const;

/**
 * Tier 2: crude words that are ONLY offensive as a standalone word — as
 * substrings they sit inside too many real names to block (ASS: Cassandra,
 * Bassett; TIT: Titan; ANAL: Analyst; SEX: Essex). Matched against whole
 * TOKENS of the raw name: the name is split at separators/digits AND at
 * lower→upper camelCase boundaries, so both "Ass_Master" and
 * "DamnDickCockBallsAss" produce a bare ASS token, while "Cassandra" and
 * "TitanFall" never do. A single lowercase run ("damnballs") has no boundary
 * and is accepted — that's the deliberate trade against Scunthorpe-style
 * false positives; tier 1 still scans it as a substring.
 */
export const USERNAME_BLOCKED_TOKENS: readonly string[] = [
  'ASS', 'ARSE', 'ANAL', 'BALLS', 'DAMN', 'PISS', 'TIT', 'TITS',
  'BOOB', 'BOOBS', 'SEX',
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
  // 2026-08-04 — carriers of the new tier-1 terms (DICK/COCK/CLIT/TWAT/WANK).
  'DICKENS', 'DICKINSON', 'DICKSON', 'RIDDICK', 'PEACOCK', 'HITCHCOCK',
  'WOODCOCK', 'GAMECOCK', 'SHUTTLECOCK', 'COCKATOO', 'COCKPIT', 'COCKTAIL',
  'COCKER', 'HERACLITUS', 'ATWATER', 'SWANK',
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
 * Tier-1 scan, shared by usernames and free-typed game text (ProperNoundle
 * guesses): fold to the comparison form, strip the known-innocent carriers,
 * then look for any blocked term as a substring. Tier-2 tokens are NOT
 * applied here — they need word boundaries, which only usernames have.
 */
export function containsBlockedTerm(raw: string): boolean {
  let normalized = normalizeUsername(raw);
  for (const safe of USERNAME_ALLOWED_CONTAINING) {
    normalized = normalized.split(normalizeUsername(safe)).join('');
  }
  // Fold each term the same way before comparing — a term with a doubled
  // letter (KIKES) would otherwise never match its own collapsed form.
  return USERNAME_BLOCKED_SUBSTRINGS.some((term) =>
    normalized.includes(normalizeUsername(term)),
  );
}

/**
 * Split a name into the tokens the tier-2 list is matched against: camelCase
 * boundaries become separators first (so "BallsAss" splits), then any
 * non-letter (space, dot, underscore, hyphen, digit) delimits. Mirrored in
 * the SQL trigger and the Swift/Kotlin ports — keep the four in lockstep.
 */
export function usernameTokens(raw: string): string[] {
  return raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
}

/**
 * ProperNoundle guess screening. Proper nouns can't be dictionary-validated,
 * so any typed string used to become permanent board art (completed-day
 * views, share images, VS) — "PENISPENISP" shipped that way on 2026-07-31.
 * Blocks a guess whose letters contain a tier-1 term.
 *
 * The ANSWER is exempt twice over: if the puzzle's own answer trips the scan
 * (Ice Spice contains SPIC), screening is skipped for that whole puzzle —
 * the player must be able to type the answer, and near-guesses in that
 * letter-space are legitimate. Tier-2 tokens are never applied: a guess is
 * one unbroken letter run ("masseffect"), so token boundaries don't exist.
 */
export function pnGuessBlocked(guess: string, answer: string): boolean {
  if (containsBlockedTerm(answer)) return false;
  return containsBlockedTerm(guess);
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

  // Tier 1: substring scan (innocent carriers stripped first, so
  // "Scunthorpe" doesn't trip CUNT and "Hitchcock" doesn't trip COCK).
  if (containsBlockedTerm(trimmed)) {
    return { ok: false, error: 'That username isn’t available. Please choose another.' };
  }

  // Tier 2: whole-token scan for the mild-but-crude words that are unsafe as
  // substrings ("Ass_Master", the trailing "Ass" of DamnDickCockBallsAss).
  const tokens = usernameTokens(trimmed);
  if (tokens.some((t) => (USERNAME_BLOCKED_TOKENS as readonly string[]).includes(t))) {
    return { ok: false, error: 'That username isn’t available. Please choose another.' };
  }

  return { ok: true };
}
