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

// ── Deck dealing (§215) — port of packages/core seed.ts ─────────────────────
// Post-cutover daily seeds deal from a deterministic shuffled deck (one
// Fisher–Yates permutation per epoch, fixed non-overlapping per-mode slices
// per day) so no answer repeats across ANY 5-letter daily for a whole epoch
// (~40 days). Pre-cutover dailies, unlimited/match/replacement seeds keep the
// legacy hash path. Byte-parity with TS/Swift is pinned by seed-fixtures.json.
const val DECK_CUTOVER_DATE = "2026-08-24"

private data class DeckDeal(val offset: Int, val count: Int)

// FROZEN deal table — never reorder/resize existing modes (see TS core).
private val DECK_DEALS_5 = mapOf(
    "DUEL" to DeckDeal(0, 1),
    "QUORDLE" to DeckDeal(1, 4),
    "OCTORDLE" to DeckDeal(5, 8),
    "SEQUENCE" to DeckDeal(13, 4),
    "RESCUE" to DeckDeal(17, 4),
    "GAUNTLET" to DeckDeal(21, 21),
    "DUEL_VS" to DeckDeal(42, 1),
)
private const val DECK_TOTAL_5 = 43
private val DECK_DEALS_6 = mapOf("DUEL_6" to DeckDeal(0, 1))
private val DECK_DEALS_7 = mapOf("DUEL_7" to DeckDeal(0, 1))

/** mulberry32 PRNG — Kotlin Int wraps to 32 bits, so `+`/`*` reproduce the JS
 *  int32/imul bit patterns exactly. As parity-critical as [simpleHash]. */
private class Mulberry32(private var state: Int) {
    /** Next value as an unsigned 32-bit quantity in a Long (for `% n`). */
    fun nextU32(): Long {
        state += 0x6D2B79F5
        var t = (state xor (state ushr 15)) * (state or 1)
        t = (t + ((t xor (t ushr 7)) * (t or 61))) xor t
        return (t xor (t ushr 14)).toLong() and 0xFFFFFFFFL
    }
}

/** Whole days from DECK_CUTOVER_DATE to `date` (UTC), null if unparseable. */
private fun deckDayIndex(date: String): Int? {
    return try {
        val from = java.time.LocalDate.parse(DECK_CUTOVER_DATE)
        val to = java.time.LocalDate.parse(date)
        java.time.temporal.ChronoUnit.DAYS.between(from, to).toInt()
    } catch (_: Exception) {
        null
    }
}

private fun deckSolutions(
    seed: String, count: Int, pool: List<String>,
    deals: Map<String, DeckDeal>, dailyTotal: Int, lengthKey: Int,
): List<String>? {
    // Exactly daily-YYYY-MM-DD-MODE: suffixed seeds (gauntlet blackout
    // replacements, etc.) must never collide with the day's real deals.
    val parts = seed.split("-")
    if (parts.size != 5 || parts[0] != "daily") return null
    val date = "${parts[1]}-${parts[2]}-${parts[3]}"
    if (date < DECK_CUTOVER_DATE) return null
    val deal = deals[parts[4]] ?: return null
    if (deal.count != count) return null
    val daysPerEpoch = pool.size / dailyTotal
    if (daysPerEpoch < 1) return null
    val dayIndex = deckDayIndex(date) ?: return null
    if (dayIndex < 0) return null
    val epoch = dayIndex / daysPerEpoch
    val perm = IntArray(pool.size) { it }
    val rng = Mulberry32(simpleHash("deck-$lengthKey-$epoch"))
    for (i in pool.size - 1 downTo 1) {
        val j = (rng.nextU32() % (i + 1)).toInt()
        val tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp
    }
    val base = (dayIndex % daysPerEpoch) * dailyTotal + deal.offset
    return List(count) { pool[perm[base + it]] }
}
// ────────────────────────────────────────────────────────────────────────────

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
    // Post-DECK_CUTOVER_DATE dailies deal from the shuffled deck (§215).
    deckSolutions(seed, count, pool, DECK_DEALS_5, DECK_TOTAL_5, 5)?.let { return it }
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
    // Same date-gate as the 5-letter path — pre-cutover Six/Seven dailies keep
    // their legacy words; new dailies + non-daily seeds use the curated list.
    val pool = GameDictionary.solutionPoolForLength(wordLength, getDailySeedDate(seed))
    // Six/Seven post-cutover dailies deal from their own decks (§215).
    val lengthDeals = when (wordLength) { 6 -> DECK_DEALS_6; 7 -> DECK_DEALS_7; else -> null }
    if (lengthDeals != null) {
        deckSolutions(seed, count, pool, lengthDeals, 1, wordLength)?.let { return it }
    }
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

/** Random ad-hoc match seed (NOT daily): `"{epochMs}-{15-char-random}"`. */
fun generateMatchSeed(): String =
    "${System.currentTimeMillis()}-${java.util.UUID.randomUUID().toString().take(15).lowercase()}"
