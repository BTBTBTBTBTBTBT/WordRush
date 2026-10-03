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

/** Which segment of the Today | All-time toggle is on for [selected] (null = a game or the Sweep tile). */
fun statsSegmentFor(selected: String): String? = when (selected) {
    RAIL_TODAY -> RAIL_TODAY
    RAIL_ALL -> RAIL_ALL
    else -> null
}

/** Whether [selected] renders the Today page (Today itself, or the Sweep tile). */
fun statsShowsToday(selected: String): Boolean = selected == RAIL_TODAY || selected == RAIL_SWEEP

// ── FINISH_SPEC BG: SCOPE × GAME ────────────────────────────────────────────

/** BG the Stats scope (the Today | All-time toggle — always shows its selection). */
enum class StatsScope(val key: String) { TODAY(RAIL_TODAY), ALL_TIME(RAIL_ALL) }

/** BG the four content cells. */
enum class StatsCell { TODAY_OVERVIEW, TODAY_GAME, ALL_TIME_OVERVIEW, ALL_TIME_GAME }

/** BG what Stats shows: a [scope] and a [game] (null = Overview; the Sweep tile reads as Overview). */
data class StatsView(val scope: StatsScope, val game: String?)

/**
 * BG (founder 10-02: "the today and all time toggle is very confusing") — two independent
 * selections, always both visible: the toggle sets the SCOPE and keeps the game; the picker
 * sets the GAME and keeps the scope (re-tapping the picked game returns to Overview); a swipe
 * moves the GAME along the picker order within the scope. Pure (unit tested).
 */
object StatsNav {
    val DEFAULT = StatsView(StatsScope.TODAY, null)

    /** Which content [v] shows. The Sweep tile is the overview of its scope (it holds the sweep). */
    fun cell(v: StatsView): StatsCell {
        val overview = v.game == null || v.game == RAIL_SWEEP
        return when (v.scope) {
            StatsScope.TODAY -> if (overview) StatsCell.TODAY_OVERVIEW else StatsCell.TODAY_GAME
            StatsScope.ALL_TIME -> if (overview) StatsCell.ALL_TIME_OVERVIEW else StatsCell.ALL_TIME_GAME
        }
    }

    /** The toggle: [scope], same game. */
    fun toggle(v: StatsView, scope: StatsScope): StatsView = v.copy(scope = scope)

    /** The picker: [key], same scope; the picked game again → Overview. */
    fun pick(v: StatsView, key: String): StatsView = if (v.game == key) v.copy(game = null) else v.copy(game = key)

    /** A swipe: the next / previous game along [games] (Overview first), same scope; null at either end. */
    fun swipe(v: StatsView, games: List<String>, forward: Boolean): StatsView? {
        val order = listOf<String?>(null) + games
        val i = order.indexOf(v.game).let { if (it < 0) 0 else it }
        val j = i + if (forward) 1 else -1
        if (j !in order.indices) return null
        return v.copy(game = order[j])
    }

    /** A legacy page key from a Today-card jump / deep link: Today / All-time set the scope, a game sets the game. */
    fun jump(v: StatsView, key: String): StatsView = when (key) {
        RAIL_TODAY -> StatsView(StatsScope.TODAY, null)
        RAIL_ALL -> StatsView(StatsScope.ALL_TIME, null)
        else -> v.copy(game = key)
    }
}
