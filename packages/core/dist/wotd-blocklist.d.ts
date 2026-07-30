/**
 * Words that must never be FEATURED as Word of the Day.
 *
 * The daily word is `solutions[(daysSinceEpoch + offset) % len]`, and the home
 * card prints it alongside its dictionary definition. On 2026-07-30 that landed
 * on HYMEN, so every player — and the first Android tester — opened the app to a
 * clinical description of the vaginal opening under a big "WORD OF THE DAY"
 * heading. Wordocious is a family word game; that is a store-rating problem as
 * much as a taste one.
 *
 * Selected by reading the DEFINITION TEXT THAT ACTUALLY RENDERS, not by
 * vibes about the word. Plenty of scary-looking entries are perfectly fine and
 * are deliberately NOT here: COLON is the punctuation mark, STOOL is a seat,
 * SHOOT is a plant stem, JOINT is where two components meet, DEATH, CRACK,
 * DRUNK and NAKED all read as ordinary dictionary entries. BLOOD is blocked for
 * an unobvious reason — the first sense in our local dataset is "A member of the
 * Los Angeles gang The Bloods."
 *
 * SCOPE: display only. These words stay in the answer pool and can still be the
 * puzzle solution. Removing them from solutions.json would shift every
 * subsequent day's index and rewrite already-played history — the exact problem
 * SOLUTIONS_CUTOVER_DATE exists to avoid. A blocked word is simply skipped and
 * the next candidate is featured, the same way a word with no definition
 * already is.
 *
 * Uppercase, matching the solutions lists. Mirrored in three other places that
 * each re-implement the candidate walk — keep them in step:
 *   apps/web/app/page.tsx            (home card, live dictionary API)
 *   apps/ios/.../WordOfTheDayView.swift
 *   apps/android/.../ui/HomeScreen.kt
 */
export declare const WOTD_BLOCKLIST: readonly string[];
/** True when a word must not be featured as Word of the Day. Case-insensitive. */
export declare function isBlockedWordOfDay(word: string): boolean;
//# sourceMappingURL=wotd-blocklist.d.ts.map