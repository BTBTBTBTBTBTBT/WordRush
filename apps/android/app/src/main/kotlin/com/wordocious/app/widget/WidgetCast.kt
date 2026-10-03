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

    // ── BI13b (founder 10-03: "sprinkle a mascot or two … just a little personality") ──
    // The ONE cast member peeking into the widget (iOS WidgetCast.peekPose twin): friendly
    // poses only, never W (W hosts the large header; never w-cheer / w-lean).

    enum class PeekMood { FRESH, PLAYING, MILESTONE, SWEPT }

    /** Pose ids (`art_pose_<id>` drawables, '-' → '_'). Keep in sync with iOS peekPoses. */
    val PEEK_POSES: Map<PeekMood, List<String>> = mapOf(
        PeekMood.FRESH to listOf("r-wake", "r-cocoa"),
        PeekMood.PLAYING to listOf("o1-ready", "c-telescope", "d-eureka", "i-reach", "o2-ready", "o3-ready"),
        PeekMood.MILESTONE to listOf("s-trophy", "s-victory"),
        PeekMood.SWEPT to listOf("d-cheer", "o1-cheer", "o2-cheer", "i-cheer"),
    )

    /** A streak worth a trophy: every 7th day and every 50th. */
    fun isMilestone(streak: Int): Boolean = streak >= 7 && (streak % 7 == 0 || streak % 50 == 0)

    /** Swept beats everything, then nothing-played-yet, then a milestone streak. */
    fun peekMood(played: Int, total: Int, streak: Int): PeekMood = when {
        total > 0 && played >= total -> PeekMood.SWEPT
        played == 0 -> PeekMood.FRESH
        isMilestone(streak) -> PeekMood.MILESTONE
        else -> PeekMood.PLAYING
    }

    /** The pose id for this moment, picked deterministically by the local [epochDay]. */
    fun peekPose(played: Int, total: Int, streak: Int, epochDay: Long): String {
        val pool = PEEK_POSES.getValue(peekMood(played, total, streak))
        return pool[Math.floorMod(epochDay, pool.size.toLong()).toInt()]
    }
}
