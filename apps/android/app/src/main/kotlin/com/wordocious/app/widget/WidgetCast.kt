package com.wordocious.app.widget

import com.wordocious.app.ui.MascotId
import com.wordocious.app.ui.Mascots

/**
 * FINISH_SPEC AV (founder 10-02: "could use more mascots"): who appears on the widget today —
 * the day host (bigger, leaning in from the top-right corner) and a trio of cast heads
 * peeking up over the bottom edge, a different trio each day, never the day host. Pure.
 */
object WidgetCast {
    /** How many heads peek up from the bottom edge. */
    const val PEEKERS = 3

    /** The day's host (deterministic per local day). */
    fun host(day: String): MascotId = Mascots.dailyPick(day, "widget-host")

    /**
     * [count] of [cast] (never [host]) for [epochDay]: the start steps by 4 a day through the
     * rest of the cast (4 is coprime with 9), so consecutive days never show the same trio.
     */
    fun <T> peekers(cast: List<T>, host: T, epochDay: Long, count: Int = PEEKERS): List<T> {
        val pool = cast.filter { it != host }
        if (pool.isEmpty() || count <= 0) return emptyList()
        val start = Math.floorMod(epochDay * 4, pool.size.toLong()).toInt()
        return (0 until minOf(count, pool.size)).map { pool[(start + it) % pool.size] }
    }
}
