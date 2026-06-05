package com.wordocious.core

import kotlin.math.abs

/**
 * JS-compatible 32-bit rolling hash. Kotlin `Int` is 32-bit and wraps on
 * overflow (two's complement), which exactly matches JavaScript's `hash & hash`
 * i32 truncation and the Swift port's `&<<` / `&-` / `&+`.
 *
 * THE most parity-critical function in the engine: if this diverges, every
 * daily puzzle differs from web/iOS. Validated against the shared
 * `hash-fixtures.json` (identical vectors to the TS and Swift suites).
 *
 * Mirrors `apps/ios/Sources/Core/Seed.swift` `simpleHash` and
 * `packages/core` `simpleHash`.
 */
fun simpleHash(str: String): Int {
    var hash = 0
    for (ch in str) {
        // JS: hash = ((hash << 5) - hash) + charCode; hash = hash & hash;
        // Kotlin Int already wraps to 32 bits, so no explicit mask is needed.
        hash = (hash shl 5) - hash + ch.code
    }
    return abs(hash)
}

/** `"daily-{date}-{gameMode}"` — date is local `yyyy-MM-dd`. */
fun generateDailySeed(date: String, gameMode: String): String = "daily-$date-$gameMode"

fun isDailySeed(seed: String): Boolean = seed.startsWith("daily-")

fun getDailySeedDate(seed: String): String? {
    if (!isDailySeed(seed)) return null
    val parts = seed.split("-")
    if (parts.size < 4) return null
    return "${parts[1]}-${parts[2]}-${parts[3]}"
}

// NOTE: generateSolutionsFromSeed / generateSolutionsFromSeedForLength /
// generateMatchSeed are added once the dictionary is ported (next step) — they
// depend on the solution word lists.
