package com.wordocious.core

import java.time.LocalDate

/**
 * FRIDAY-QUEUE items 11 + 11b: the Leaderboard living stage's shared constants — a 1:1 port of
 * packages/core/src/leaderboard-stage.ts (host table, tint alphas, ledge step positions).
 */
object LeaderboardStage {
    data class Host(val castId: String, val pose: String)

    /** Sunday … Saturday. W never hosts; Wednesday is U the wizard. */
    val DAY_HOSTS = listOf(
        Host("s", "trophy"),   // SUNDAY SUPERSTARS
        Host("d", "lean"),     // MONDAY MASTERS
        Host("c", "lean"),     // TUESDAY TITANS
        Host("u", "spin"),     // WEDNESDAY WIZARDS
        Host("r", "lean"),     // THURSDAY THUNDER
        Host("i", "lean"),     // FRIDAY'S FINEST
        Host("s", "flex"),     // SATURDAY STARS
    )

    /** 0 = Sunday … 6 = Saturday for the player's local YYYY-MM-DD. */
    fun weekday(day: String): Int = LocalDate.parse(day).dayOfWeek.value % 7

    fun host(day: String): Host = DAY_HOSTS[weekday(day)]

    /** The backdrop's alphas of the selected game's accent. */
    const val SKY_TOP = 0.26f
    const val SKY_MID = 0.14f
    const val SKY_BOTTOM = 0.0f
    const val RAYS = 0.7f
    const val FLOOR_GLOW = 0.3f

    const val TOP_MAX_HEIGHT = 330.0
    const val STANDARD_PHONE_USABLE_HEIGHT = 650.0
    const val PODIUM_BLOCK_HEIGHT = 250.0

    /** Mini steps on the Yesterday ledge art (394 x 160): place 2 left, 1 centre, 3 right. */
    data class LedgeStep(val place: Int, val x: Float, val top: Float)
    val LEDGE_STEPS = listOf(LedgeStep(2, 0.215f, 0.5f), LedgeStep(1, 0.5f, 0.36f), LedgeStep(3, 0.785f, 0.58f))
    const val LEDGE_FIGURE_FRACTION = 0.2f

    fun podiumFits(stageTopHeight: Double, usable: Double = STANDARD_PHONE_USABLE_HEIGHT): Boolean =
        stageTopHeight + PODIUM_BLOCK_HEIGHT <= usable
}
