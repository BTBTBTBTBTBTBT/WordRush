package com.wordocious.core

/**
 * §265: answers that read as PROPER NOUNS are swapped out of the answer pools.
 * Each has a lowercase dictionary sense (japan = lacquer, aspen = a poplar) and
 * cleared the frequency bar BECAUSE of the country/city/people it names, so the
 * curation let it through (founder: "Aspen populated on OctoWord and Japan
 * yesterday, why?"). The pools are ORDER-LOCKED (position = deck-permutation
 * input), so nothing is deleted or moved: from the cutover date on, the word at
 * that index resolves to its replacement. Dated seeds gate on the seed's date,
 * undated seeds (unlimited, live VS — server and clients must agree) on
 * wall-clock UTC, exactly like SOLUTIONS_GROWTH_CUTOVER_DATE. The old words stay
 * valid GUESSES. Mirrors: packages/core/src/solution-swaps.ts,
 * apps/ios/Sources/Core/SolutionSwaps.swift,
 * apps/android/core/.../SolutionSwaps.kt — keep all three identical
 * (solution-swaps.test.ts + native tests pin them). Ship all three platforms
 * before the date arrives.
 */
const val SOLUTION_SWAP_CUTOVER_DATE = "2026-10-05"

val SOLUTION_SWAPS: Map<String, String> = mapOf(
    "JAPAN" to "ALOOF",
    "CHINA" to "EJECT",
    "CHILE" to "LIVID",
    "ASPEN" to "DUVET",
    "DUTCH" to "SLUSH",
    "GREEK" to "VISOR",
    "ROMAN" to "GLEAM",
    "SWISS" to "ERUPT",
    "WELSH" to "CRUMB",
    "BIBLE" to "EMBER",
    "BERLIN" to "BLOTCH",
    "BRAZIL" to "JABBER",
    "GERMAN" to "CAJOLE",
    "GOOGLE" to "CARAFE",
    "GREECE" to "CURDLE",
    "MORMON" to "BRAISE",
    "MUSLIM" to "DAWDLE",
    "PANAMA" to "BISECT",
    "VIKING" to "PILFER",
    "CHICAGO" to "PROFUSE",
    "CHINESE" to "COMPOTE",
    "ENGLISH" to "BURNISH",
    "MOROCCO" to "ENTWINE",
)

/** Batch 1 only: the pool with every swapped-out answer replaced IN PLACE (same length, same index). */
fun applySolutionSwaps(pool: List<String>): List<String> = pool.map { SOLUTION_SWAPS[it] ?: it }

/**
 * Batch 2 (founder, 2026-09-23: "please continue to get rid of profanity like
 * fucker and blowjob"): PROFANITY and sexual/drug vocabulary that the 6- and
 * 7-letter curation let through — the exact-match profanity lists carried FUCK
 * and SHIT but not FUCKER/FUCKING/SHITTY, and BLOWJOB only as a username
 * substring. Same mechanism as batch 1, but a SEPARATE table with its own
 * LATER cutover: store builds carrying batch 1 (iOS 1.29 / Android 121) are
 * already out, so SOLUTION_SWAPS must never grow — a client without an entry
 * would deal the old word while the server dealt the new one. The date is set
 * after the next iOS and Android store releases; all four runtimes must carry
 * this table before it arrives. Replacements: common, clean, guessable words
 * absent from the current AND legacy pools, not in any blocklist, and not a
 * batch-1 replacement. The old words stay valid GUESSES.
 */
const val SOLUTION_SWAP_2_CUTOVER_DATE = "2026-11-16"

val SOLUTION_SWAPS_2: Map<String, String> = mapOf(
    "FUCKER" to "CASHEW",
    "FUCKED" to "DAPPER",
    "SHITTY" to "CHISEL",
    "HERPES" to "FONDUE",
    "HEROIN" to "FILLET",
    "FETISH" to "FLAUNT",
    "FUCKING" to "CRUMPET",
    "BLOWJOB" to "APRICOT",
    "BROTHEL" to "BAGPIPE",
    "GENITAL" to "CHUTNEY",
    "VAGINAL" to "COPILOT",
    "COCAINE" to "CATWALK",
    "BONDAGE" to "CROWBAR",
)

/** Batch 2 only, IN PLACE. */
fun applySolutionSwaps2(pool: List<String>): List<String> = pool.map { SOLUTION_SWAPS_2[it] ?: it }

/** Batch 1 then batch 2 — the pool as every runtime sees it from SOLUTION_SWAP_2_CUTOVER_DATE on. */
fun applyAllSolutionSwaps(pool: List<String>): List<String> = applySolutionSwaps2(applySolutionSwaps(pool))
