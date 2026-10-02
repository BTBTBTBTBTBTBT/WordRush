package com.wordocious.core

import java.time.LocalDate

// The Leaderboard page title (founder, 2026-10-01): "a fun word play like
// Friday's Finest … switching those up by the days". One alliterative title per
// weekday; a holiday day swaps in "<HOLIDAY> HEROES". Pure, so web, iOS and
// Android read the same words on the same local day. 1:1 port of
// packages/core/src/leaderboard-title.ts (leaderboard-title-fixtures.json).

/** Sunday-first, like JS `getUTCDay()`. */
private val WEEKDAY_TITLES = listOf(
    "SUNDAY SUPERSTARS",
    "MONDAY MASTERS",
    "TUESDAY TITANS",
    "WEDNESDAY WIZARDS",
    "THURSDAY THUNDER",
    "FRIDAY’S FINEST",
    "SATURDAY STARS",
)

/** [day] is the player's local yyyy-MM-dd; [holiday] the day's holiday name, if any. */
fun leaderboardTitle(day: String, holiday: String? = null): String {
    val h = holiday.orEmpty().trim()
    if (h.isNotEmpty()) return "${h.uppercase()} HEROES"
    // java.time DayOfWeek: MONDAY = 1 … SUNDAY = 7 → Sunday-first index.
    val weekday = LocalDate.parse(day).dayOfWeek.value % 7
    return WEEKDAY_TITLES[weekday]
}
