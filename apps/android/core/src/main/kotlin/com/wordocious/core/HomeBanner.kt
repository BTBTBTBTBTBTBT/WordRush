package com.wordocious.core

import java.time.LocalDate

/**
 * Home banner rules (founder-approved home redesign, 2026-10-01). 1:1 port of
 * packages/core/src/home-banner.ts; pinned by home-banner-fixtures.json
 * (HomeBannerFixtureTest). One banner tops the home page: a frosted headline
 * strip over two rows, Wordocious (the eight sweep dailies) and Puzzles (the
 * ten More Games dailies). Each row glows on its own: purple when every game
 * in it is finished (a sweep), gold when every game in it is won (a
 * flawless); both gold is a Double Flawless.
 *
 * Everything here is pure so web, iOS and Android read the SAME words.
 */
enum class BannerTier(val raw: String) { NONE("none"), SWEEP("sweep"), FLAWLESS("flawless") }

/** One row's progress today: how many of its `total` dailies are finished, and how many won. */
data class GroupProgress(val played: Int, val won: Int, val total: Int)

/** One day's finished/won counts, for [dayStreaks]. */
data class DayTally(val played: Int, val won: Int)

data class DayStreaks(val sweep: Int, val flawless: Int)

/** A row glows once every game in it is finished; gold only when every one is won. */
fun groupTier(g: GroupProgress): BannerTier {
    if (g.total <= 0 || g.played < g.total) return BannerTier.NONE
    return if (g.won >= g.total) BannerTier.FLAWLESS else BannerTier.SWEEP
}

/** The row's status text: "3/8", "SWEEP · 7/8 WON", "FLAWLESS · 8/8 WON". */
fun groupStatus(g: GroupProgress): String {
    val tier = groupTier(g)
    if (tier == BannerTier.NONE) return "${g.played}/${g.total}"
    return "${if (tier == BannerTier.FLAWLESS) "FLAWLESS" else "SWEEP"} · ${g.won}/${g.total} WON"
}

/** Unlimited mode's row status: "5 PLAYED TODAY". */
fun unlimitedGroupStatus(playedToday: Int): String = "$playedToday PLAYED TODAY"

/** Morning before noon, afternoon until 5 pm, evening after (local hour 0-23). */
fun greetingWord(hour: Int): String = when {
    hour < 12 -> "MORNING"
    hour < 17 -> "AFTERNOON"
    else -> "EVENING"
}

private fun puzzlesLeft(n: Int): String = "$n ${if (n == 1) "PUZZLE" else "PUZZLES"} LEFT"

/**
 * The banner headline, always upper case. It moves with the day: a greeting
 * before the first puzzle, then WARMING UP → ON A ROLL → HOME STRETCH, then a
 * row's own news once one finishes, and finally the two results in banner
 * order (Wordocious first, then Puzzles). `name` is the player's username
 * (no nickname setting, founder 2026-10-01); empty for a guest.
 */
fun bannerHeadline(
    word: GroupProgress, puzzles: GroupProgress, hour: Int, name: String, unlimited: Boolean = false,
    /** 2.8 items 7 + 48: the rows' streaks + the local day so a finished row speaks to its streak. */
    wordStreaks: RowStreaks? = null, puzzleStreaks: RowStreaks? = null, dateKey: String? = null,
): String {
    if (unlimited) return "UNLIMITED PLAY"
    val a = groupTier(word)
    val b = groupTier(puzzles)
    val total = word.total + puzzles.total
    val played = minOf(word.played, word.total) + minOf(puzzles.played, puzzles.total)
    val left = maxOf(0, total - played)
    fun streakLine(s: RowStreaks?, t: BannerTier): String? {
        if (s == null || dateKey == null || t == BannerTier.NONE) return null
        return if (t == BannerTier.FLAWLESS) StreakHeadline.line(StreakHeadline.Kind.FLAWLESS, s.flawless, s.bestFlawless, dateKey)
        else StreakHeadline.line(StreakHeadline.Kind.SWEEP, s.sweep, s.bestSweep, dateKey)
    }
    if (a != BannerTier.NONE && b != BannerTier.NONE) {
        // Both rows done: the Wordocious row's streak (the header trophy counts it) leads.
        streakLine(wordStreaks, a)?.let { return it }
        if (a == BannerTier.FLAWLESS && b == BannerTier.FLAWLESS) return "DOUBLE FLAWLESS!"
        if (a == BannerTier.SWEEP && b == BannerTier.SWEEP) return "DOUBLE SWEEP!"
        return if (a == BannerTier.FLAWLESS) "FLAWLESS + SWEEP!" else "SWEEP + FLAWLESS!"
    }
    fun news(label: String, t: BannerTier) =
        "$label ${if (t == BannerTier.FLAWLESS) "FLAWLESS!" else "SWEPT!"} ${puzzlesLeft(left)}"
    if (a != BannerTier.NONE) return streakLine(wordStreaks, a) ?: news("WORDOCIOUS", a)
    if (b != BannerTier.NONE) return streakLine(puzzleStreaks, b) ?: news("PUZZLES", b)
    if (played == 0) {
        val n = name.trim().uppercase()
        // BJ6 (founder 10-03): the greeting is personal for signed-in players; 0–4 h is "UP LATE?".
        if (hour in 0..4) return if (n.isNotEmpty()) "UP LATE, $n?" else "UP LATE?"
        return if (n.isNotEmpty()) "GOOD ${greetingWord(hour)}, $n!" else "GOOD ${greetingWord(hour)}!"
    }
    if (played <= 5) return "WARMING UP · $played DOWN"
    if (played <= 11) return "ON A ROLL · $played OF $total"
    return "HOME STRETCH · $left LEFT"
}

/** The line under the headline. `clock` is the live HH:MM:SS countdown to local midnight. */
fun bannerClockLine(word: GroupProgress, puzzles: GroupProgress, clock: String, unlimited: Boolean = false): String {
    if (unlimited) return "FRESH PUZZLE EVERY TAP · ALL STATS COUNT"
    val total = word.total + puzzles.total
    val played = minOf(word.played, word.total) + minOf(puzzles.played, puzzles.total)
    if (played >= total) return "NEW PUZZLES IN $clock"
    if (played == 0) return "$total FRESH PUZZLES · RESETS IN $clock"
    return "RESETS IN $clock"
}

/** The streak a row shows: its flawless run on a gold day, otherwise its sweep run. */
fun groupStreak(tier: BannerTier, streaks: DayStreaks): Int =
    if (tier == BannerTier.FLAWLESS) streaks.flawless else streaks.sweep

/** `YYYY-MM-DD` shifted by whole days (calendar math, no time zones involved). */
fun shiftDay(day: String, delta: Int): String = LocalDate.parse(day).plusDays(delta.toLong()).toString()

/**
 * Consecutive-day runs ending today, or yesterday when today isn't done yet.
 * `days` maps a local day to that day's finished and won counts; a day is a
 * sweep when `played >= total` and a flawless when `won >= total`. Used for
 * the Puzzles row (total = 10) and the Word of the Day (total = 1: a right
 * answer counts as a "won" day).
 */
fun dayStreaks(days: Map<String, DayTally>, total: Int, today: String): DayStreaks {
    if (total <= 0) return DayStreaks(0, 0)
    fun run(ok: (DayTally) -> Boolean): Int {
        fun hit(day: String): Boolean = days[day]?.let(ok) ?: false
        val yesterday = shiftDay(today, -1)
        var cursor: String? = if (hit(today)) today else if (hit(yesterday)) yesterday else null
        var n = 0
        while (cursor != null && hit(cursor)) { n += 1; cursor = shiftDay(cursor, -1) }
        return n
    }
    return DayStreaks(sweep = run { it.played >= total }, flawless = run { it.won >= total })
}

data class DayRunTotals(val sweepDays: Int, val flawlessDays: Int, val bestSweep: Int, val bestFlawless: Int)

/**
 * Lifetime totals for a set of days (founder, 2026-10-01 stats audit): how many
 * days were sweeps / flawless and the longest run of each. Feeds the All-time
 * "Puzzles Sweeps" card (total = 10) and the Word of the Day record (total = 1).
 */
fun dayRunTotals(days: Map<String, DayTally>, total: Int): DayRunTotals {
    if (total <= 0) return DayRunTotals(0, 0, 0, 0)
    fun tally(ok: (DayTally) -> Boolean): Pair<Int, Int> {
        val hits = days.filter { ok(it.value) }.keys.sorted()
        var best = 0; var run = 0; var prev: String? = null
        for (d in hits) {
            run = if (prev != null && shiftDay(prev, 1) == d) run + 1 else 1
            if (run > best) best = run
            prev = d
        }
        return hits.size to best
    }
    val sweep = tally { it.played >= total }
    val flawless = tally { it.won >= total }
    return DayRunTotals(sweepDays = sweep.first, flawlessDays = flawless.first, bestSweep = sweep.second, bestFlawless = flawless.second)
}
