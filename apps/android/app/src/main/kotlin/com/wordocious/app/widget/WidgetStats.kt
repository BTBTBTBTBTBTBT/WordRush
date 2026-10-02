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

    /** Millis from [now] to the next local midnight (always > 0). */
    fun msToMidnight(now: Calendar): Long = nextLocalMidnightMillis(now) - now.timeInMillis
}
