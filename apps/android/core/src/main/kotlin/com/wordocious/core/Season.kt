package com.wordocious.core

import java.time.LocalDate

/**
 * FINISH_SPEC X: the season registry's date windows (docs/design/brand/seasons/README.md
 * "How to add a season"). Port of packages/core `SEASON_WINDOWS` / `currentSeason(date)`:
 * the season a LOCAL calendar date falls in, or null. Halloween runs Oct 9 – Oct 31
 * inclusive (every year). Pure, so web, iOS and Android switch on the same day; the art
 * slots + palette live in season-registry.json (app, SeasonKit).
 */
object Season {
    const val HALLOWEEN = "halloween"

    /** One registry window: inclusive, local dates; wraps the new year when start > end. */
    data class Window(val id: String, val startMonth: Int, val startDay: Int, val endMonth: Int, val endDay: Int)

    val windows: List<Window> = listOf(
        Window(HALLOWEEN, 10, 9, 10, 31),
    )

    /** Every registry season id, in calendar order. */
    val ids: List<String> get() = windows.map { it.id }
}

/** The season [date] (a local date) falls in ("halloween": Oct 9 – Oct 31 inclusive) or null. */
fun currentSeason(date: LocalDate): String? {
    val k = date.monthValue * 100 + date.dayOfMonth
    for (w in Season.windows) {
        val a = w.startMonth * 100 + w.startDay
        val b = w.endMonth * 100 + w.endDay
        if (if (a <= b) k in a..b else (k >= a || k <= b)) return w.id
    }
    return null
}

/** [currentSeason] for a "YYYY-MM-DD" local date string; null when it doesn't parse. */
fun currentSeason(date: String): String? =
    runCatching { LocalDate.parse(date.take(10)) }.getOrNull()?.let { currentSeason(it) }
