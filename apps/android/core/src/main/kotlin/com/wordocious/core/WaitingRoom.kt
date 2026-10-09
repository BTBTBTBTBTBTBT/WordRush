package com.wordocious.core

/**
 * VS / pocket waiting rooms as a little lobby (FRIDAY-QUEUE item 22, 2.8 wave 3).
 * 1:1 port of packages/core/src/waiting-room.ts; pinned by
 * waiting-room-fixtures.json (WaitingRoomFixtureTest).
 *
 * One status line in the bubble lettering ("Waiting for Johnny…"), a REAL
 * counting timer, and a keepy-uppy tile mini-play.
 */
enum class WaitingKind(val raw: String) {
    /** A private match: invited a named friend, or a code nobody has used yet. */
    FRIEND("friend"),
    /** Random opponent search. */
    RANDOM("random"),
    /** A bot is being found / warmed up. */
    BOT("bot"),
    /** A pocket game waiting for the friend to take their turn. */
    POCKET("pocket");

    companion object {
        fun from(raw: String?): WaitingKind? = values().firstOrNull { it.raw == raw }
    }
}

object WaitingRoom {
    private fun clean(s: String?): String = (s ?: "").trim().trimStart('@')

    /** The ONE status line. A real ellipsis character, never three dots. */
    fun waitingStatusLine(kind: WaitingKind, name: String? = null): String {
        val n = clean(name)
        return when (kind) {
            WaitingKind.FRIEND, WaitingKind.POCKET -> if (n.isNotEmpty()) "Waiting for $n…" else "Waiting for your friend…"
            WaitingKind.RANDOM -> "Finding you an opponent…"
            WaitingKind.BOT -> "Warming up your opponent…"
        }
    }

    /** The counting timer: m:ss under an hour, h:mm:ss after. Negative or NaN reads 0:00. */
    fun waitClock(seconds: Double): String {
        val s = if (seconds.isFinite() && seconds > 0) seconds.toLong() else 0L
        val h = s / 3600
        val m = (s % 3600) / 60
        val ss = (s % 60).toString().padStart(2, '0')
        return if (h > 0) "$h:${m.toString().padStart(2, '0')}:$ss" else "$m:$ss"
    }

    fun waitClock(seconds: Long): String = waitClock(seconds.toDouble())

    /** Seconds waited from a start time (ms) and now (ms); never negative. */
    fun waitedSeconds(startMs: Long, nowMs: Long): Long = maxOf(0L, Math.floorDiv(nowMs - startMs, 1000L))

    /** The keepy-uppy line under the tile: nothing at 0, then the bounce count. */
    fun keepyLine(count: Int, best: Int): String {
        if (count <= 0) return if (best > 0) "Tap to bounce · best $best" else "Tap to bounce the tile"
        return if (count > best && best > 0) "$count · new best!" else "$count"
    }

    /** Idle chirps cycle slowly while you wait (never more than one per 6 s). */
    val WAIT_IDLE_BITS: List<String> = listOf("checks its watch", "yawns", "waves at the door")
    const val WAIT_IDLE_EVERY_S = 6

    /** Which idle bit plays at a given waited second. */
    fun idleBit(seconds: Int): String? {
        if (seconds < WAIT_IDLE_EVERY_S) return null
        return WAIT_IDLE_BITS[(seconds / WAIT_IDLE_EVERY_S - 1) % WAIT_IDLE_BITS.size]
    }
}
