package com.wordocious.core

import java.time.LocalDate

/**
 * FINISH_SPEC X: the seasonal cast skins. Port of packages/core `currentSeason(date)`:
 * the season a LOCAL calendar date falls in, or null. Halloween runs Oct 24 – Nov 1
 * inclusive (every year). Pure, so web, iOS and Android switch skins on the same day.
 */
object Season {
    const val HALLOWEEN = "halloween"
}

/** The season [date] (a local date) falls in: "halloween" (Oct 24 – Nov 1 inclusive) or null. */
fun currentSeason(date: LocalDate): String? {
    val m = date.monthValue
    val d = date.dayOfMonth
    return if ((m == 10 && d >= 24) || (m == 11 && d <= 1)) Season.HALLOWEEN else null
}

/** [currentSeason] for a "YYYY-MM-DD" local date string; null when it doesn't parse. */
fun currentSeason(date: String): String? =
    runCatching { LocalDate.parse(date.take(10)) }.getOrNull()?.let { currentSeason(it) }
