package com.wordocious.app.widget

import java.util.Calendar
import java.util.Locale

/**
 * FINISH_SPEC AL: the three numbers every widget size always shows (puzzles solved
 * today, today's points, time left until new puzzles) plus the streak, as pure math
 * so it can be unit tested off-device. No Android or app-state reads in here.
 *
 * - Solved = every daily the app counts: the Wordocious row plus the Puzzles row
 *   (played = a result is recorded today, win or loss), over both rows' sizes.
 * - Points = the snapshot's Wordocious sweep total plus its Puzzles total. Both are
 *   written by WidgetBridge from the app's own helpers (DailyCompletionsService.totals
 *   and moreTotals: each mode's composite score rounded, then summed), so the widget
 *   number is the one the app shows for today. iOS writes the same combined sum.
 * - A snapshot from another day reads as 0/total and 0 points (new puzzles dropped at
 *   local midnight), never yesterday's numbers.
 */
object WidgetStats {

    data class DayStats(val played: Int, val total: Int, val points: Int)

    /** Today's stats from [snap]; a snapshot stamped with a day other than [today] reads as zeros. */
    fun dayStats(snap: WidgetBridge.Snapshot, today: String): DayStats {
        val all = snap.modes + snap.puzzles.orEmpty()
        if (snap.day != today) return DayStats(played = 0, total = all.size, points = 0)
        return DayStats(
            played = all.count { it.played },
            total = all.size,
            points = ((snap.points ?: 0) + (snap.puzzlePoints ?: 0)).coerceAtLeast(0),
        )
    }

    /**
     * The midnight rollover: a snapshot from a previous day keeps the streak and shields
     * but resets every mode (and the day's points, time and rank) — re-stamped [today].
     * A same-day snapshot is returned unchanged.
     */
    fun rollover(snap: WidgetBridge.Snapshot, today: String): WidgetBridge.Snapshot {
        if (snap.day == today) return snap
        return snap.copy(
            day = today,
            modes = snap.modes.map { it.copy(played = false, won = false) },
            puzzles = snap.puzzles?.map { it.copy(played = false, won = false) },
            points = 0, seconds = 0, puzzlePoints = 0, rank = null,
        )
    }

    /** Sum-of-rounds, the app's per-mode rounding rule (web/iOS parity: never round-of-sum). */
    fun pointsSum(scores: Iterable<Double>): Int = scores.sumOf { Math.round(it) }.toInt()

    // ── Labels ──────────────────────────────────────────────────────────────

    /** "5/18" — the solved chip's soft number. */
    fun solvedLabel(s: DayStats): String = "${s.played}/${s.total}"

    /** "3,420" — the points chip's soft number (grouped, US separators; 0 before the first game). */
    fun pointsLabel(points: Int): String = String.format(Locale.US, "%,d", points)

    /**
     * BC the points as they fit in [maxChars]: the full grouped number ("10,779") whenever it
     * fits — the line auto-shrinks first — and compact thousands ("10.8K", "1.2M") only as the
     * last resort.
     */
    fun pointsLabelFit(points: Int, maxChars: Int = 7): String {
        val full = pointsLabel(points)
        if (full.length <= maxChars) return full
        return when {
            points >= 1_000_000 -> String.format(Locale.US, "%.1fM", points / 1_000_000.0)
            else -> String.format(Locale.US, "%.1fK", points / 1_000.0)
        }
    }

    // ── TalkBack phrases (each chip reads as one full sentence) ─────────────

    fun streakPhrase(streak: Int): String = if (streak == 1) "1 day streak" else "$streak day streak"

    fun solvedPhrase(s: DayStats): String = "${s.played} of ${s.total} puzzles solved today"

    fun pointsPhrase(points: Int): String =
        if (points == 1) "1 point today" else "${pointsLabel(points)} points today"

    // ── Countdown ───────────────────────────────────────────────────────────

    /** Wall-clock millis of the next local midnight after [now]. */
    fun nextLocalMidnightMillis(now: Calendar): Long =
        (now.clone() as Calendar).apply {
            add(Calendar.DAY_OF_YEAR, 1)
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }.timeInMillis

    /**
     * BI13: the widget's short reset label — "4h" (whole hours, rounded up) while an hour or
     * more is left, then "45m" (minutes, rounded up). iOS WidgetStats.resetText twin.
     */
    fun resetText(seconds: Long): String {
        val s = seconds.coerceAtLeast(0)
        if (s >= 3600) return "${(s + 3599) / 3600}h"
        return "${((s + 59) / 60).coerceAtLeast(1)}m"
    }

    /**
     * BI13: the name the widget's "NEXT …" line shows — the snapshot's short title, except the
     * two clipped ones ("Succ.", "Deliv."), which read better in full. iOS twin.
     */
    fun nextName(key: String, title: String): String = when (key) {
        "SEQUENCE" -> "Succession"
        "RESCUE" -> "Deliverance"
        else -> title.removeSuffix(".")
    }

    /** TalkBack: "new puzzles in 7 hours 42 minutes" (the iOS countdownPhrase twin). */
    fun countdownPhraseFor(now: Calendar): String {
        val s = (msToMidnight(now) / 1000).coerceAtLeast(0)
        val h = s / 3600; val m = (s % 3600) / 60
        val parts = mutableListOf<String>()
        if (h > 0) parts += "$h ${if (h == 1L) "hour" else "hours"}"
        if (m > 0 || h == 0L) parts += "$m ${if (m == 1L) "minute" else "minutes"}"
        return "new puzzles in " + parts.joinToString(" ")
    }

    /** BI13: the next re-render — the next whole hour, or the next quarter hour inside the last hour. */
    fun nextLabelFlipMillis(now: Calendar): Long {
        val midnight = nextLocalMidnightMillis(now)
        val left = midnight - now.timeInMillis
        val step = if (left <= 3_600_000L) 15 * 60_000L else 3_600_000L
        val sinceMidnightEdge = left % step
        val next = now.timeInMillis + (if (sinceMidnightEdge == 0L) step else sinceMidnightEdge)
        return minOf(next, midnight + 2_000)
    }

    /** Millis from [now] to the next local midnight (always > 0). */
    fun msToMidnight(now: Calendar): Long = nextLocalMidnightMillis(now) - now.timeInMillis
}
