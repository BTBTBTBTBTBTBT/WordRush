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

/**
 * Deterministic per-seed solution picker (mirrors Swift `generateSolutionsFromSeed`).
 * For each index, hash `"{seed}-{i}"` → `% solutionCount`; on a collision with an
 * already-used index, re-hash `"{seed}-{i}-{attempt}"` (max `solutionCount` tries).
 * `simpleHash` returns a non-negative Int, so `% solutionCount` is non-negative.
 * Requires [GameDictionary] to be initialized ([DictionaryLoader.ensureLoaded]).
 */
fun generateSolutionsFromSeed(seed: String, count: Int): List<String> {
    // Answer pool chosen by the DATE embedded in the seed (never wall clock),
    // so every client resolves the same seed identically: pre-cutover daily
    // dates → legacy list, post-cutover dailies + all non-daily seeds → curated.
    val pool = GameDictionary.solutionPool(getDailySeedDate(seed))
    val solutionCount = pool.size
    val solutions = ArrayList<String>(count)
    val used = HashSet<Int>()
    for (i in 0 until count) {
        val seedWithIndex = "$seed-$i"
        var hash = simpleHash(seedWithIndex)
        var attempts = 0
        while ((hash % solutionCount) in used && attempts < solutionCount) {
            hash = simpleHash("$seedWithIndex-$attempts")
            attempts++
        }
        val index = hash % solutionCount
        used.add(index)
        solutions.add(pool[index])
    }
    return solutions
}

/** Length-specific variant (Six/Seven) — uses that length's solution pool. */
fun generateSolutionsFromSeedForLength(seed: String, count: Int, wordLength: Int): List<String> {
    val solutionCount = GameDictionary.getSolutionCountForLength(wordLength)
    val solutions = ArrayList<String>(count)
    val used = HashSet<Int>()
    for (i in 0 until count) {
        val seedWithIndex = "$seed-$i"
        var hash = simpleHash(seedWithIndex)
        var attempts = 0
        while ((hash % solutionCount) in used && attempts < solutionCount) {
            hash = simpleHash("$seedWithIndex-$attempts")
            attempts++
        }
        val index = hash % solutionCount
        used.add(index)
        solutions.add(GameDictionary.getSolutionWordForLength(wordLength, index))
    }
    return solutions
}

/** Random ad-hoc match seed (NOT daily): `"{epochMs}-{15-char-random}"`. */
fun generateMatchSeed(): String =
    "${System.currentTimeMillis()}-${java.util.UUID.randomUUID().toString().take(15).lowercase()}"
