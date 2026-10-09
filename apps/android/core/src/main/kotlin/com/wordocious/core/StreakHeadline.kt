package com.wordocious.core

// 2.8 items 7 + 48: the Home banner's streak lines — a 1:1 port of packages/core/src/streak-headline.ts, pinned by
// home-banner-fixtures.json ("streakLines" / "withStreaks"). Milestone lines at 2 / 3 / 4 / 5 / 6 / 7 / 10 / 14 / 30,
// "NEW BEST!" on a record run, a kind restart line after a break; the variant is picked by a stable hash of the date
// key so everyone sees the same line that day and it never repeats flatly.

/** A row's streaks for the headline: current runs and (0 = unknown) the best runs ever. */
data class RowStreaks(val sweep: Int, val flawless: Int, val bestSweep: Int = 0, val bestFlawless: Int = 0)

object StreakHeadline {
    enum class Kind { FLAWLESS, SWEEP }

    /** A stable non-negative hash (FNV-1a over the UTF-16 code units, 31 bits) — identical in every port. */
    fun dayHash(s: String): Int {
        var h = 2166136261L
        for (ch in s) {
            h = h xor ch.code.toLong()
            h = (h * 16777619L) and 0xFFFFFFFFL
        }
        return (h and 0x7fffffffL).toInt()
    }

    private const val N = "{n}"

    private val flawlessMilestones: Map<Int, List<String>> = mapOf(
        2 to listOf("FLAWLESS · 2 IN A ROW!", "BACK-TO-BACK FLAWLESS!", "FLAWLESS TWICE IN A ROW!"),
        3 to listOf("FLAWLESS 3-PEAT!", "THREE FLAWLESS DAYS!", "FLAWLESS · 3 IN A ROW!"),
        4 to listOf("FOUR-MIDABLE! 4 FLAWLESS DAYS", "A PERFECT FOUR-SOME!", "FLAWLESS · 4 IN A ROW!"),
        5 to listOf("HIGH FIVE! 5 FLAWLESS DAYS", "FIVE PERFECT DAYS!", "FLAWLESS · 5 IN A ROW!"),
        6 to listOf("SO CLOSE TO A WEEK! 6 FLAWLESS", "SIX FLAWLESS DAYS!", "FLAWLESS · 6 IN A ROW!"),
        7 to listOf("A WHOLE WEEK FLAWLESS!", "FLAWLESS WEEK!", "7 DAYS, ZERO MISSES!"),
        10 to listOf("TEN FLAWLESS DAYS!", "DOUBLE DIGITS FLAWLESS!", "10 IN A ROW, ZERO MISSES!"),
        14 to listOf("TWO FLAWLESS WEEKS!", "14 DAYS, ZERO MISSES!", "A FORTNIGHT OF FLAWLESS!"),
        30 to listOf("A FLAWLESS MONTH!", "30 PERFECT DAYS!", "LEGENDARY · 30 FLAWLESS DAYS!"),
    )
    private val sweepMilestones: Map<Int, List<String>> = mapOf(
        2 to listOf("SWEPT · 2 DAYS IN A ROW!", "BACK-TO-BACK SWEEPS!", "CLEAN SWEEP, TWICE IN A ROW!"),
        3 to listOf("SWEEP 3-PEAT!", "THREE SWEEPS IN A ROW!", "SWEPT · 3 DAYS RUNNING!"),
        4 to listOf("FOUR SWEEPS RUNNING!", "A SWEEPING FOUR-SOME!", "SWEPT · 4 DAYS IN A ROW!"),
        5 to listOf("HIGH FIVE! 5 SWEEPS IN A ROW", "FIVE CLEAN SWEEPS!", "SWEPT · 5 DAYS IN A ROW!"),
        6 to listOf("SO CLOSE TO A WEEK! 6 SWEEPS", "SIX SWEEPS IN A ROW!", "SWEPT · 6 DAYS IN A ROW!"),
        7 to listOf("A WHOLE WEEK OF SWEEPS!", "SWEEP WEEK!", "7 DAYS, 7 SWEEPS!"),
        10 to listOf("TEN SWEEPS IN A ROW!", "DOUBLE DIGITS OF SWEEPS!", "10 DAYS, 10 SWEEPS!"),
        14 to listOf("TWO WEEKS OF SWEEPS!", "14 SWEEPS IN A ROW!", "A FORTNIGHT OF SWEEPS!"),
        30 to listOf("A SWEEPING MONTH!", "30 SWEEPS IN A ROW!", "LEGENDARY · 30 DAYS OF SWEEPS!"),
    )
    private val flawlessGeneric = listOf("FLAWLESS · $N IN A ROW!", "$N FLAWLESS DAYS!", "$N PERFECT DAYS IN A ROW!")
    private val sweepGeneric = listOf("SWEPT · $N DAYS IN A ROW!", "$N SWEEPS IN A ROW!", "$N CLEAN SWEEPS RUNNING!")
    private val flawlessNewBest = listOf("NEW BEST! $N FLAWLESS DAYS", "NEW BEST · $N FLAWLESS IN A ROW!", "A NEW RECORD! $N FLAWLESS DAYS")
    private val sweepNewBest = listOf("NEW BEST! $N SWEEPS IN A ROW", "NEW BEST · $N DAYS OF SWEEPS!", "A NEW RECORD! $N SWEEPS")
    private val flawlessRestart = listOf("FLAWLESS AGAIN! A FRESH START", "BACK ON TRACK! FLAWLESS TODAY", "A NEW STREAK STARTS NOW!")
    private val sweepRestart = listOf("SWEPT AGAIN! A FRESH START", "BACK ON TRACK! SWEPT TODAY", "A NEW SWEEP STREAK STARTS NOW!")

    val milestones: List<Int> = listOf(2, 3, 4, 5, 6, 7, 10, 14, 30)

    private fun pick(pool: List<String>, seed: String, days: Int): String =
        pool[dayHash("$seed|$days") % pool.size].replace(N, days.toString())

    /** The streak headline for a group that just earned today's flawless / sweep, or null with no streak news. */
    fun line(kind: Kind, days rawDays: Int, best rawBest: Int = 0, dateKey: String): String? {
        val days = maxOf(0, rawDays)
        val flawless = kind == Kind.FLAWLESS
        val best = maxOf(0, rawBest)
        if (days <= 1) {
            if (days == 1 && best >= 3) return pick(if (flawless) flawlessRestart else sweepRestart, dateKey, days)
            return null
        }
        (if (flawless) flawlessMilestones else sweepMilestones)[days]?.let { return pick(it, dateKey, days) }
        if (best > 0 && days >= best && days >= 3) return pick(if (flawless) flawlessNewBest else sweepNewBest, dateKey, days)
        return pick(if (flawless) flawlessGeneric else sweepGeneric, dateKey, days)
    }
}
