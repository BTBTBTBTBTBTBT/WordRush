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
