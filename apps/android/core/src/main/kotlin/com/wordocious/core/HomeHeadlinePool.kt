package com.wordocious.core

import java.time.LocalDate
import java.util.Locale
import kotlin.math.ceil

/**
 * The Home headline POOL (founder 10-16): a 1:1 port of packages/core/src/home-headline-pool.ts, pinned by
 * home-headline-pool-fixtures.json (HomeHeadlinePoolFixtureTest). The Home state picks a CONTEXT by priority
 * (Double Flawless > fresh personal record > streak news > flawless row > all done > row done > last-played
 * reaction > next-up nudge > holiday > season pack > weekday > time of day); each context has a pool of lines in
 * [HomeHeadlineBank]; seasonal flavor is mixed in at a set rate; a rare surprise replaces a non-celebration pick.
 * Selection is deterministic — seeded by (user, date, time bucket, context) — and a caller-persisted history of
 * shown ids keeps a line from repeating. Every line is checked against the bubble-lettering fit for the slot; the
 * legacy [bannerHeadline] line is the always-fitting fallback. Pure, so every platform reads the SAME words.
 */
object HomeHeadlinePool {
    /** A last-played reaction lives this long after the game ends. */
    const val LAST_GAME_FRESH_MINUTES = 20
    /** The caller keeps ids shown in the last N days. */
    const val HISTORY_DAYS = 10
    /** Seasonal flavor replaces the base pick this often during a pack (1 in SEASON_RATE picks are base). */
    const val SEASON_RATE = 3
    /** The rare surprise: 1 in SURPRISE_RATE non-celebration picks. */
    const val SURPRISE_RATE = 12
    /** A pool line must keep at least this share of the device's full lettering size. */
    const val MIN_FIT_SCALE = 0.85
    const val DEFAULT_SLOT_WIDTH = 294

    data class LastGame(val title: String, val won: Boolean, val minutesAgo: Int, val record: Boolean = false)

    data class Streaks(val word: RowStreaks, val puzzles: RowStreaks)

    data class Context(
        val name: String,
        val hour: Int,
        /** Local day `YYYY-MM-DD`. */
        val dateKey: String,
        val word: GroupProgress,
        val puzzles: GroupProgress,
        val streaks: Streaks? = null,
        val unlimited: Boolean = false,
        /** The next unplayed daily's title in the player's own order (null when none). */
        val nextGame: String? = null,
        val lastGame: LastGame? = null,
        /** Today's holiday key from the bundled table, null when none. */
        val holiday: String? = null,
        /** The headline slot's text width in px (null = DEFAULT_SLOT_WIDTH). */
        val slotWidth: Double? = null,
        /** A stable per-user salt (user id; "" for guests). */
        val userSeed: String = "",
        /** Recently shown line ids (the templates), caller-persisted locally. */
        val history: List<String> = emptyList(),
    )

    /** text = the line to show; id = its template (push on history when SHOWN); context / bucket as TS strings. */
    data class Choice(val text: String, val id: String, val context: String, val bucket: String)

    /** Local hour 0-23 → the bucket. */
    fun timeBucket(hour: Int): String = when {
        hour < 5 -> "lateNight"
        hour < 8 -> "earlyMorning"
        hour < 12 -> "morning"
        hour < 14 -> "midday"
        hour < 17 -> "afternoon"
        hour < 21 -> "evening"
        else -> "night"
    }

    private class Pack(val id: String, val start: Int, val end: Int)

    /** Headline packs: calendar windows for seasonal flavor (wrap past Dec 31). */
    private val PACKS = listOf(
        Pack("halloween", 1009, 1031),
        Pack("thanksgiving", 1114, 1129),
        Pack("winter", 1201, 1230),
        Pack("newyear", 1231, 106),
        Pack("valentines", 207, 214),
        Pack("spring", 320, 415),
        Pack("summer", 621, 710),
        Pack("fall", 922, 1008),
    )

    /** The pack a local `YYYY-MM-DD` falls in (null = none). */
    fun headlinePack(dateKey: String): String? {
        val parts = dateKey.split("-")
        val m = parts.getOrNull(1)?.toIntOrNull() ?: return null
        val d = parts.getOrNull(2)?.toIntOrNull() ?: return null
        val k = m * 100 + d
        for (p in PACKS) {
            val hit = if (p.start <= p.end) k >= p.start && k <= p.end else k >= p.start || k <= p.end
            if (hit) return p.id
        }
        return null
    }

    /** Weekday 0 (Sunday) – 6 for a `YYYY-MM-DD` (calendar math, no time zones). */
    fun weekdayOf(dateKey: String): Int {
        val (y, m, d) = dateKey.split("-").map { it.toInt() }
        return LocalDate.of(y, m, d).dayOfWeek.value % 7
    }

    private val SLOT_RE = Regex("\\{(name|next|last|n|left|played|total)\\}")

    /** Fill `{slot}`s; null when a required slot is empty. Upper-cased after filling (as the TS). */
    fun fillHeadline(template: String, slots: Map<String, String?>): String? {
        var missing = false
        val out = SLOT_RE.replace(template) { m ->
            val v = slots[m.groupValues[1]]
            if (v == null || v.isEmpty()) { missing = true; "" } else v
        }
        return if (missing) null else out.uppercase(Locale.ROOT)
    }

    /** Does `text` keep two near-full-size bubble lines in a `slotWidth` slot? (See the TS for the rule.) */
    fun headlineFitsSlot(text: String, name: String, slotWidth: Double): Boolean {
        val w = slotWidth
        val full = headlineFontSize(w)
        val minSize = ceil(full * MIN_FIT_SCALE).toInt()
        val fit = homeHeadlineFit(text, name, w)
        if (fit.nameLines.isNotEmpty()) return fit.size >= minSize && fit.lines.size - fit.nameLines.size <= 1
        if (!fit.wrapped && fit.size >= minSize) return true
        val two = bubbleFit(text, w, maxSize = full, minSize = minSize, maxLines = 2)
        return two.lines.size <= 2 && two.size >= minSize
    }

    private fun pickFrom(
        pool: List<String>, seed: String, slots: Map<String, String?>, name: String, slotWidth: Double, history: List<String>,
    ): Pair<String, String>? {
        val fitted = ArrayList<Pair<String, String>>()
        for (id in pool) {
            val text = fillHeadline(id, slots) ?: continue
            if (headlineFitsSlot(text, name, slotWidth)) fitted.add(id to text)
        }
        if (fitted.isEmpty()) return null
        val fresh = fitted.filter { !history.contains(it.first) }
        val candidates = if (fresh.isNotEmpty()) fresh else fitted
        return candidates[StreakHeadline.dayHash(seed) % candidates.size]
    }

    private fun flavored(base: List<String>, pack: String?, packTag: String?, seed: String): List<String> {
        if (pack == null || packTag == null) return base
        val extra = HomeHeadlineBank.pool("$packTag/$pack")
        if (extra.isEmpty()) return base
        return if (StreakHeadline.dayHash("$seed|flavor") % SEASON_RATE == 0) base else extra
    }

    /**
     * The Home headline from the pool. Deterministic for (user, date, time bucket, state); re-run it when the
     * bucket, progress, last game or history changes (never per frame). Falls back to [bannerHeadline].
     */
    fun select(ctx: Context): Choice {
        val name = ctx.name.trim()
        val bucket = timeBucket(ctx.hour)
        val slotWidth = ctx.slotWidth ?: DEFAULT_SLOT_WIDTH.toDouble()
        val history = ctx.history
        val seedBase = "${ctx.userSeed}|${ctx.dateKey}|$bucket"
        fun legacy(): Choice = Choice(
            bannerHeadline(ctx.word, ctx.puzzles, ctx.hour, name, ctx.unlimited, ctx.streaks?.word, ctx.streaks?.puzzles, ctx.dateKey),
            "legacy", "legacy", bucket,
        )

        val a = groupTier(ctx.word)
        val b = groupTier(ctx.puzzles)
        val total = ctx.word.total + ctx.puzzles.total
        val played = minOf(ctx.word.played, ctx.word.total) + minOf(ctx.puzzles.played, ctx.puzzles.total)
        val left = maxOf(0, total - played)
        val pack = headlinePack(ctx.dateKey)
        val slots: Map<String, String?> = mapOf(
            "name" to name.ifEmpty { null },
            "next" to ctx.nextGame?.trim()?.ifEmpty { null },
            "last" to ctx.lastGame?.title?.trim()?.ifEmpty { null },
            "left" to if (left > 0) left.toString() else null,
            "played" to played.toString(),
            "total" to total.toString(),
        )
        fun choose(kind: String, poolTag: String, packTag: String? = null): Choice? {
            val seed = "$seedBase|$kind"
            val hit = pickFrom(flavored(HomeHeadlineBank.pool(poolTag), pack, packTag, seed), seed, slots, name, slotWidth, history)
                ?: return null
            return Choice(hit.second, hit.first, kind, bucket)
        }

        if (ctx.unlimited) return choose("unlimited", "unlimited") ?: legacy()

        fun streakLine(s: RowStreaks?, t: BannerTier): String? {
            if (s == null || t == BannerTier.NONE) return null
            return if (t == BannerTier.FLAWLESS) StreakHeadline.line(StreakHeadline.Kind.FLAWLESS, s.flawless, s.bestFlawless, ctx.dateKey)
            else StreakHeadline.line(StreakHeadline.Kind.SWEEP, s.sweep, s.bestSweep, ctx.dateKey)
        }
        fun streakChoice(line: String?): Choice? =
            if (line != null && headlineFitsSlot(line, name, slotWidth)) Choice(line, "streak:$line", "streak", bucket) else null

        val last = ctx.lastGame
        val lastFresh = last != null && last.minutesAgo >= 0 && last.minutesAgo <= LAST_GAME_FRESH_MINUTES
        val streakLeads = StreakHeadline.dayHash("$seedBase|streakSwap") % 3 != 0
        // 1. Double Flawless beats everything; the Wordocious streak line gets one bucket in three.
        if (a == BannerTier.FLAWLESS && b == BannerTier.FLAWLESS) {
            val streakNews = if (!streakLeads) streakChoice(streakLine(ctx.streaks?.word, a)) else null
            return streakNews ?: choose("doubleFlawless", "doubleFlawless", "doubleFlawless") ?: legacy()
        }
        // 2. A personal record in the game just played.
        if (lastFresh && last!!.record) choose("newRecord", "newRecord")?.let { return it }
        // 3. Streak news on a finished row.
        val streakNews = if (streakLeads) streakChoice(streakLine(ctx.streaks?.word, a)) ?: streakChoice(streakLine(ctx.streaks?.puzzles, b)) else null
        if (streakNews != null) return streakNews
        // 4. One row flawless while the other is open.
        if ((a == BannerTier.FLAWLESS) != (b == BannerTier.FLAWLESS) && left > 0) return choose("flawlessRow", "flawlessRow", "flawlessRow") ?: legacy()
        // 5. Everything finished.
        if (a != BannerTier.NONE && b != BannerTier.NONE) return choose("allDone", "allDone", "allDone") ?: legacy()
        // 6. One row swept, the other open.
        if (a != BannerTier.NONE || b != BannerTier.NONE) return choose("rowDone", "rowDone") ?: legacy()

        // The rare surprise, only where there is nothing to celebrate.
        if (StreakHeadline.dayHash("$seedBase|surprise") % SURPRISE_RATE == 0) choose("surprise", "surprise")?.let { return it }

        // 7. A reaction to the game just played.
        if (lastFresh && played > 0) choose("lastPlayed", if (last!!.won) "lastPlayed/won" else "lastPlayed/lost")?.let { return it }
        // 8. Mid-day: the next game up in the player's order.
        if (played > 0) return choose("nextUp", "nextUp", "nextUp") ?: legacy()

        // Nothing played yet: holiday day > season pack (at its rate) > weekday (1 in 3) > time of day.
        if (ctx.holiday != null && HomeHeadlineBank.pool("holiday/${ctx.holiday}").isNotEmpty()) {
            choose("holiday", "holiday/${ctx.holiday}")?.let { return it }
        }
        if (pack != null && StreakHeadline.dayHash("$seedBase|pack") % SEASON_RATE != 0) choose("pack", "pack/$pack")?.let { return it }
        if (StreakHeadline.dayHash("$seedBase|weekday") % 3 == 0) choose("weekday", "weekday/${weekdayOf(ctx.dateKey)}")?.let { return it }
        return choose("timeOfDay", "time/$bucket") ?: legacy()
    }
}
