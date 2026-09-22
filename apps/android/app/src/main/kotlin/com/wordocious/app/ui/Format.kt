package com.wordocious.app.ui

import kotlin.math.max
import kotlin.math.roundToInt

// ============================================================
// Shared display formatters — cross-platform contract
// ============================================================
// Mirrors web lib/format.ts and iOS Core Format.swift; pinned by
// display-format-fixtures.json (DisplayFormatFixtureTest). formatScore lives
// in ModeCatalog.kt (same package). These exist because each platform
// hand-rolled its own copies and they drifted: this platform truncated the
// rank badge ("Top 13%") where web rounded ("Top 12%").

/** One rank-badge result: label + whether it gets the gold styling. */
data class TopPercent(val label: String, val gold: Boolean)

/**
 * The daily post-game rank badge: percentile of the field you beat, ROUNDED
 * (user decision 2026-07-16 — web canonical; this platform used to truncate).
 *
 * This is the (1 - (rank-1)/total) definition used by the post-game badge.
 * The records page uses rank/total — a different, deliberately separate
 * metric; do not unify them.
 */
fun topPercentLabel(rank: Int, totalPlayers: Int): TopPercent {
    val percentile = ((1 - (rank - 1).toDouble() / totalPlayers) * 100).roundToInt()
    return TopPercent("Top ${max(1, 100 - percentile)}%", percentile >= 75)
}

/**
 * Compact time for leaderboard/records/summary rows: "0s", "45s", "2m",
 * "2m 5s". Zero is a real value ("0s"), never a dash.
 */
fun formatShortTime(seconds: Int): String {
    val s = max(0, seconds)
    if (s < 60) return "${s}s"
    val m = s / 60
    val rem = s % 60
    return if (rem > 0) "${m}m ${rem}s" else "${m}m"
}

// ── More Games (§11): guess_count is not always "guesses" ─────────────────
// Mirrors web lib/format.ts formatGuessStat 1:1; pinned by
// display-format-fixtures.json. `semantics` / `guessBase` come from the mode
// catalog (ModeGen). See the web copy for the per-semantics table.

/** Hubbub rank names, best first: guess_count 1 = Pandemonium … 10 = Hush. */
val HUB_RANK_NAMES = listOf("Pandemonium", "Thunder", "Uproar", "Hubbub", "Racket", "Clamor", "Banter", "Chatter", "Murmur", "Hush")

private fun plural(n: Int, one: String, many: String) = "$n ${if (n == 1) one else many}"

fun formatGuessStat(semantics: String, guessBase: Int, guessCount: Int): String {
    val g = max(0, guessCount)
    return when (semantics) {
        "mistakes" -> plural(max(0, g - guessBase), "mistake", "mistakes")
        "checks" -> plural(if (guessBase == 1) max(0, g - 1) else g, "check", "checks")
        "overPar" -> { val d = g - 1; if (d <= 0) "Par" else "+$d" }
        "misses" -> plural(max(0, g - guessBase), "miss", "misses")
        "rank" -> HUB_RANK_NAMES[minOf(HUB_RANK_NAMES.size, max(1, g)) - 1]
        else -> plural(g, "guess", "guesses")
    }
}
