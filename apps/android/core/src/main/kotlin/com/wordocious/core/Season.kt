package com.wordocious.core

import java.time.LocalDate

/**
 * FINISH_SPEC X: the season registry's date windows (docs/design/brand/seasons/README.md
 * "How to add a season"). Port of packages/core `SEASON_WINDOWS` / `currentSeason(date)`:
 * the season a LOCAL calendar date falls in, or null. Halloween runs Oct 9 – Oct 31,
 * Thanksgiving Nov 14 – Nov 29, inclusive (every year). Pure, so web, iOS and Android switch on the same day; the art
 * slots + palette live in season-registry.json (app, SeasonKit).
 */
object Season {
    const val HALLOWEEN = "halloween"
    const val THANKSGIVING = "thanksgiving"

    /**
     * One registry window: inclusive, local dates; wraps the new year when start > end. [ready] (10-16) is false
     * while the season's art is unapproved / unshipped: [currentSeason] skips it (nothing public switches on), the
     * admin Season preview still lists it ([ids]) and bypasses the calendar. Flip it in the build that ships the art.
     */
    data class Window(val id: String, val startMonth: Int, val startDay: Int, val endMonth: Int, val endDay: Int, val ready: Boolean = true)

    val windows: List<Window> = listOf(
        Window(HALLOWEEN, 10, 9, 10, 31, ready = true),
        Window(THANKSGIVING, 11, 14, 11, 29, ready = false),
    )

    /** Every registry season id, in calendar order (ready or not: the admin preview lists them all). */
    val ids: List<String> get() = windows.map { it.id }

    /** Is the season's art shipped (its window may switch it on for the public)? Unknown ids = false. */
    fun isReady(id: String?): Boolean = windows.any { it.id == id && it.ready }
}

/**
 * The PUBLIC season [date] (a local date) falls in ("halloween": Oct 9 – Oct 31, "thanksgiving": Nov 14 – Nov 29,
 * inclusive) or null; a window whose season is not [Season.Window.ready] answers null here (see [calendarSeason]).
 */
fun currentSeason(date: LocalDate): String? = calendarSeason(date)?.takeIf { Season.isReady(it) }

/** The window [date] falls in, ready or not (null = no season). */
fun calendarSeason(date: LocalDate): String? {
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

/** [calendarSeason] for a "YYYY-MM-DD" local date string; null when it doesn't parse. */
fun calendarSeason(date: String): String? =
    runCatching { LocalDate.parse(date.take(10)) }.getOrNull()?.let { calendarSeason(it) }
