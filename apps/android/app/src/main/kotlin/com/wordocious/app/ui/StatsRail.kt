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

/**
 * Founder 10-02: a finished drag of [dx] × [dy] px switches the Stats page only when it is
 * CLEARLY horizontal — at least [thresholdPx] wide and at least twice as wide as tall. Returns
 * forward (swiped left) / back (swiped right), or null (a scroll, a tap, a diagonal drag).
 */
fun statsSwipeForward(dx: Float, dy: Float, thresholdPx: Float): Boolean? {
    val ax = kotlin.math.abs(dx)
    if (ax < thresholdPx || ax < 2f * kotlin.math.abs(dy)) return null
    return dx < 0f
}

/** The page one swipe away from [selected] along [order] ([forward] = toward the end); null at either end. */
fun statsSwipeTarget(order: List<String>, selected: String, forward: Boolean): String? {
    val i = order.indexOf(selected)
    if (i < 0) return null
    return order.getOrNull(i + if (forward) 1 else -1)
}

// ── FINISH_SPEC BJ1: ONE scroll per game — TODAY first, ALL-TIME beneath ────────────
// (founder 10-03, replacing BG's Today | All-time toggle: "each game should populate their
// daily stats first and all time beneath, no more toggle"). The only selection is the GAME.

/** BJ1 what a view's sections show, top to bottom. */
enum class StatsSection { TODAY_OVERVIEW, TODAY_GAME, TODAY_SWEEP, ALL_TIME_OVERVIEW, ALL_TIME_GAME, ALL_TIME_SWEEP }

/** BJ1 what Stats shows: a [game] (null = Overview; [RAIL_SWEEP] = the Daily Sweep). No scope. */
data class StatsView(val game: String?)

/**
 * BJ1: every view is one scroll — its TODAY section, then its ALL-TIME section beneath.
 * The picker sets the GAME (re-tapping the picked game returns to Overview); a swipe moves
 * the GAME along the picker order. Pure (unit tested); twin of iOS core StatsSelection and
 * web lib/stats-view.ts.
 */
object StatsNav {
    val DEFAULT = StatsView(null)

    /** The two sections of [v] — Today first, All-time beneath. Always both. */
    fun sections(v: StatsView): List<StatsSection> = when (v.game) {
        null -> listOf(StatsSection.TODAY_OVERVIEW, StatsSection.ALL_TIME_OVERVIEW)
        RAIL_SWEEP -> listOf(StatsSection.TODAY_SWEEP, StatsSection.ALL_TIME_SWEEP)
        else -> listOf(StatsSection.TODAY_GAME, StatsSection.ALL_TIME_GAME)
    }

    /** The picker: [key]; the picked game again → Overview. */
    fun pick(v: StatsView, key: String): StatsView = if (v.game == key) StatsView(null) else StatsView(key)

    /** A swipe: the next / previous game along [games] (Overview first); null at either end. */
    fun swipe(v: StatsView, games: List<String>, forward: Boolean): StatsView? {
        val order = listOf<String?>(null) + games
        val i = order.indexOf(v.game).let { if (it < 0) 0 else it }
        val j = i + if (forward) 1 else -1
        if (j !in order.indices) return null
        return StatsView(order[j])
    }

    /** A page key from a Today-card jump / deep link: the legacy Today / All-time keys are Overview. */
    fun jump(v: StatsView, key: String): StatsView = when (key) {
        RAIL_TODAY, RAIL_ALL -> StatsView(null)
        else -> if (v.game == key) v else StatsView(key)
    }
}
