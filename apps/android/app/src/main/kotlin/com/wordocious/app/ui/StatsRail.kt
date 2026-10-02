package com.wordocious.app.ui

import androidx.compose.ui.graphics.Color

/**
 * The Stats tab's page keys + their order (Stats + Friends redesign D2; finishing
 * build C3, founder 2026-10-02). The horizontal rail is gone: the Stats page now uses
 * THE shared game picker (GamePickerCard, FinishPages.kt) — every game visible at
 * once — with a "Today | All-time" toggle in its header row. A page is Today · All-time ·
 * a daily mode's db key · the Sweep tile ([RAIL_SWEEP], which shows the Today page — it
 * holds the sweep — with the Sweep tile highlighted). A swipe on the page moves one
 * item along [statsPageOrder] (ProfileScreen owns that gesture). Twin of web
 * components/stats/game-rail.tsx and iOS StatsRail.
 */
const val RAIL_TODAY = "today"
/** Not a page: a jump to "vs" (the Today card's VS Battle pill, the VS lobby's Rivals "See
 *  all") opens All-time scrolled to its VS section. */
const val RAIL_VS = "vs"
const val RAIL_ALL = "all"
/** The picker's Sweep tile (C2b) — renders the Today page. Same key the picker uses by default. */
const val RAIL_SWEEP = "SWEEP"

/** The loss red every W/L surface on the Stats tab shares. */
val RAIL_LOSS_RED = Color(0xFFDC2626)

/**
 * The swipe order (pure, unit-tested): Today, All-time, then the picker's tiles in
 * picker order — the WORDOCIOUS row (with the Sweep tile after Seven when [withSweep])
 * and the PUZZLES row. Duplicate keys are dropped.
 */
fun statsPageOrder(wordKeys: List<String>, puzzleKeys: List<String>, withSweep: Boolean = true): List<String> =
    (listOf(RAIL_TODAY, RAIL_ALL) + wordKeys + (if (withSweep) listOf(RAIL_SWEEP) else emptyList()) + puzzleKeys).distinct()

/** The page one swipe away from [selected] along [order] ([forward] = toward the end); null at either end. */
fun statsSwipeTarget(order: List<String>, selected: String, forward: Boolean): String? {
    val i = order.indexOf(selected)
    if (i < 0) return null
    return order.getOrNull(i + if (forward) 1 else -1)
}

/** Which segment of the Today | All-time toggle is on for [selected] (null = a game or the Sweep tile). */
fun statsSegmentFor(selected: String): String? = when (selected) {
    RAIL_TODAY -> RAIL_TODAY
    RAIL_ALL -> RAIL_ALL
    else -> null
}

/** Whether [selected] renders the Today page (Today itself, or the Sweep tile). */
fun statsShowsToday(selected: String): Boolean = selected == RAIL_TODAY || selected == RAIL_SWEEP
