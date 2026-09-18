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

/** The pool with every swapped-out answer replaced IN PLACE (same length, same index). */
fun applySolutionSwaps(pool: List<String>): List<String> = pool.map { SOLUTION_SWAPS[it] ?: it }
