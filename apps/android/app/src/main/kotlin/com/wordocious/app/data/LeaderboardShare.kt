package com.wordocious.app.data

import io.github.jan.supabase.postgrest.postgrest
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import com.wordocious.app.ModeGen
import com.wordocious.app.R
import com.wordocious.app.data.ShareFinish.U
import com.wordocious.app.ui.wallpaperRes
import androidx.compose.ui.graphics.toArgb
import com.wordocious.app.ui.lightArgb
import com.wordocious.app.todayLocalDate
import com.wordocious.app.yesterdayLocalDate
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.util.Calendar
import kotlin.math.max
import kotlin.math.min

/**
 * LEADERBOARD SHARE — Android port of web lib/leaderboard-share.ts (pure card
 * builders), lib/share-image.ts drawLeaderboardCard/drawLbRow (the 1080²
 * canvas renderer), and lib/share-utils.ts shareResult linkOnly + the
 * leaderboard-share-flow.ts fetch glue.
 *
 * Three variants of one card: today's solo board, today's VS battle board, and
 * yesterday's settled podium. Spoiler-free by construction — names, scores and
 * stats only, never words or tiles. FINISH_SPEC S1: the share is the IMAGE ONLY
 * (no hosted /s/ link, no caption) — the card carries everything.
 */
object LeaderboardShare {
    private const val VS_ACCENT = 0xFF0D9488.toInt()
    private const val SURFACE = "leaderboard"

    // ── Variant identity (web LB_THEME / LB_LABEL) ─────────────────────────────

    // FRIENDS (§207): friends-only board + settled friends podium — same
    // geometry, indigo identity, dense friend ranks in rows/you/shareRank.
    // SWEEP (§231): today's cross-mode Daily Sweep board + yesterday's settled
    // sweep podium — same geometry, pink-washed violet identity, RPC tie-aware
    // ranks carried through verbatim.
    // WEEKLY_RACE (§234): the friends panel's THIS WEEK'S RACE as a card —
    // me + friends ranked by the week's points, countdown on the date chip.
    // §244/§245: FLAWLESS_STREAK + TROPHY_CASE — the personal brag cards.
    enum class Variant { SOLO, VS, PODIUM, FRIENDS, FRIENDS_PODIUM, SWEEP, SWEEP_PODIUM, WEEKLY_RACE, FLAWLESS_STREAK, TROPHY_CASE }

    /** §17 The card's header art: the page the board lives on. */
    private fun headerArt(v: Variant): Int = when (v) {
        Variant.VS -> R.drawable.art_title_vs
        Variant.FRIENDS, Variant.FRIENDS_PODIUM, Variant.WEEKLY_RACE -> R.drawable.art_titlecast_friends
        Variant.TROPHY_CASE -> R.drawable.art_titlecast_records
        else -> R.drawable.art_titlecast_leaderboard
    }

    private fun label(v: Variant): String = when (v) {
        Variant.SOLO -> "DAILY LEADERBOARD"
        Variant.VS -> "VS BATTLE LEADERBOARD"
        Variant.PODIUM -> "YESTERDAY’S PODIUM"
        Variant.FRIENDS -> "FRIENDS LEADERBOARD"
        Variant.FRIENDS_PODIUM -> "FRIENDS PODIUM"
        Variant.SWEEP -> "DAILY SWEEP BOARD"
        Variant.SWEEP_PODIUM -> "YESTERDAY’S SWEEP PODIUM"
        Variant.WEEKLY_RACE -> "FRIENDS WEEKLY RACE"
        Variant.FLAWLESS_STREAK -> "FLAWLESS STREAK"
        Variant.TROPHY_CASE -> "TROPHY CASE"
    }

    // ── Card input (web ShareLeaderboardInput) ─────────────────────────────────

    /** One row, all strings preformatted by the pure builders below so the
     *  renderer stays a dumb layout pass (web ShareLeaderboardRowInput). */
    data class RowInput(
        val rank: Int,
        val name: String,
        val scoreDisplay: String,
        /** Full-stats subline; null on the compressed top-5 rows of the
         *  sharer-below-top-5 layout. */
        val subline: String?,
        val isYou: Boolean,
        /** §249: nine-dot mode strip, SWEEP_DOT_MODES order — null element =
         *  unplayed (hollow), -1 = loss (red), else 0..1 win intensity t. */
        val dots: List<Double?>? = null,
    )

    /** "▲3 vs yesterday" (green) / "▼2 vs yesterday" (red) pill. */
    data class Delta(val text: String, val improved: Boolean)

    data class CardInput(
        val variant: Variant,
        /** Web ShareMode title ("Classic", "Six", …) — /s/ key + `lm` param. */
        val shareMode: String,
        /** Lowercased engine-mode name for share_events instrumentation. */
        val gameModeLower: String,
        /** Mode chip accent (solo/podium; the VS chip is always teal). */
        val accent: Int,
        val modeChip: String,
        val dateChip: String,
        /** Top rows (≤5; podium ≤3), ordered by rank. */
        val rows: List<RowInput>,
        /** Sharer's row when ranked below the top rows (after a "• • •" divider). */
        val you: RowInput? = null,
        /** "#12 of 87" under the out-of-top you-row. */
        val youRankLine: String? = null,
        val delta: Delta? = null,
        val footer: String,
        /** Board day (yyyy-MM-dd) — keys the storage object. */
        val day: String,
        val shareRank: Int? = null,
        val sharePlayers: Int? = null,
    )

    // ── Pure builders (web lib/leaderboard-share.ts) ───────────────────────────

    /** Day #1 of the daily system (migration 20260407000001) — drives the
     *  "#123" puzzle number on the date chip. */
    private val DAILY_PUZZLE_EPOCH: LocalDate = LocalDate.of(2026, 4, 7)

    /** 1-based daily puzzle number for a yyyy-MM-dd day; null for bad input or
     *  pre-epoch days (defensive — those never had a daily board). */
    fun puzzleNumberForDay(day: String): Int? = runCatching {
        (LocalDate.parse(day).toEpochDay() - DAILY_PUZZLE_EPOCH.toEpochDay() + 1).toInt()
    }.getOrNull()?.takeIf { it >= 1 }

    private val MONTHS = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

    /** "Aug 7, 2026" from a yyyy-MM-dd day string (no timezone involved). */
    fun formatBoardDate(day: String): String {
        val m = Regex("^(\\d{4})-(\\d{2})-(\\d{2})$").find(day) ?: return day
        val (y, mo, d) = m.destructured
        val mon = MONTHS.getOrNull(mo.toInt() - 1) ?: return day
        return "$mon ${d.toInt()}, $y"
    }

    /** "11:15 AM" — local clock time for the "as of" snapshot stamp. */
    fun formatClockTime(cal: Calendar = Calendar.getInstance()): String {
        var h = cal.get(Calendar.HOUR_OF_DAY)
        val ampm = if (h >= 12) "PM" else "AM"
        h %= 12; if (h == 0) h = 12
        return "%d:%02d %s".format(h, cal.get(Calendar.MINUTE), ampm)
    }

    /** Omitted entirely (null) when the sharer didn't play yesterday or their
     *  rank is unchanged — exactly per spec. */
    fun buildRankDelta(yesterdayRank: Int?, todayRank: Int): Delta? {
        if (yesterdayRank == null) return null
        val d = yesterdayRank - todayRank
        if (d == 0) return null
        return if (d > 0) Delta("▲$d vs yesterday", true) else Delta("▼${-d} vs yesterday", false)
    }

    private fun fmtClock(seconds: Int): String {
        val s = max(0, seconds)
        return "%d:%02d".format(s / 60, s % 60)
    }

    private fun soloSubline(e: LeaderboardService.LeaderboardEntry): String =
        "${e.guessCount} guesses · ${fmtClock(e.timeSeconds)} · ${if (e.completed) "Win" else "Loss"}"

    private fun vsSubline(e: LeaderboardService.LeaderboardEntry): String {
        // W-L today. vs_losses excludes draws; older rows without the column
        // fall back to games-minus-wins (web parity).
        val losses = e.vsLosses ?: max(0, e.vsGames - e.vsWins)
        return "${e.vsWins}-$losses today"
    }

    private fun toRow(
        rank: Int,
        e: LeaderboardService.LeaderboardEntry,
        userId: String?,
        subline: ((LeaderboardService.LeaderboardEntry) -> String)?,
        scoreLabels: Map<Double, String> = emptyMap(),
    ): RowInput = RowInput(
        rank = rank,
        name = e.username ?: "Player",
        scoreDisplay = scoreLabels[e.compositeScore] ?: formatScoreDisplay(e.compositeScore),
        subline = subline?.invoke(e),
        isYou = userId != null && e.userId == userId,
    )

    /** Same integer formatting as web formatScore / ui formatScore. */
    private fun formatScoreDisplay(score: Double): String =
        java.text.NumberFormat.getIntegerInstance(java.util.Locale.US).format(score.toLong())

    /**
     * Today's-board card (web buildDailyLeaderboardShareInput). Top 5 rows with
     * full stats; if the sharer sits below the top 5, the top rows compress to
     * name+score and their highlighted full-stats row follows a "• • •" divider
     * with "#R of TOTAL". A sharer who hasn't played today gets no you-row.
     * Returns null for an empty board.
     */
    fun buildDailyInput(
        variant: Variant,
        friends: Boolean = false,
        meta: com.wordocious.app.GenMode,
        day: String,
        entries: List<LeaderboardService.LeaderboardEntry>,
        userId: String?,
        userRank: LeaderboardService.RankInfo?,
        userEntry: LeaderboardService.LeaderboardEntry?,
        yesterdayRank: Int?,
        now: Calendar = Calendar.getInstance(),
    ): CardInput? {
        val top = entries.take(5)
        if (top.isEmpty()) return null

        // FRIENDS keeps solo/vs sublines; only the identity changes.
        val cardVariant = if (friends) Variant.FRIENDS else variant
        val subline: (LeaderboardService.LeaderboardEntry) -> String =
            if (variant == Variant.VS) ::vsSubline else ::soloSubline
        val youInTop = userId != null && top.any { it.userId == userId }
        val belowTop = !youInTop && userId != null && userRank != null && userEntry != null
        val delta = userRank?.let { buildRankDelta(yesterdayRank, it.rank) }

        val puzzle = puzzleNumberForDay(day)
        // TIE-AWARE scores (board parity): rows sharing a whole number on THIS
        // card render the decimals that rank them — the sharer's below-fold
        // row joins the collision set.
        val cardLabels = com.wordocious.app.ui.tieAwareScoreLabels(
            top.map { it.compositeScore } + if (belowTop) listOf(userEntry!!.compositeScore) else emptyList(),
        )
        return CardInput(
            variant = cardVariant,
            shareMode = meta.title,
            gameModeLower = (meta.dbKey ?: meta.title).lowercase(),
            accent = meta.accentInt,
            modeChip = if (variant == Variant.VS) "${meta.shareLabel} VS" else meta.shareLabel,
            // "as of h:mm" marks the card as a SNAPSHOT of a live board —
            // today's standings keep moving. The settled Podium says "· Final".
            dateChip = "${formatBoardDate(day)}${if (puzzle != null) " · #$puzzle" else ""} · as of ${formatClockTime(now)}",
            // Sharer below the top 5 → compress the top rows to name+score only.
            rows = top.mapIndexed { i, e -> toRow(i + 1, e, userId, if (belowTop) null else subline, cardLabels) },
            you = if (belowTop) toRow(userRank!!.rank, userEntry!!, userId, subline, cardLabels) else null,
            youRankLine = if (belowTop) "#${userRank!!.rank} of ${userRank!!.totalPlayers}" else null,
            delta = delta,
            footer = when (cardVariant) {
                Variant.FRIENDS -> "Add your friends — play free at wordocious.com"
                Variant.VS -> "Think you can take them? wordocious.com"
                else -> "Can you beat them? Play free at wordocious.com"
            },
            day = day,
            shareRank = userRank?.rank,
            sharePlayers = userRank?.totalPlayers,
        )
    }

    /**
     * The settled variant for the Yesterday's Winners surface (web
     * buildYesterdayPodiumShareInput): "YESTERDAY'S PODIUM" identity,
     * "MMM d, yyyy · Final" chip, top-3 rows with full stats. Null when
     * yesterday had no finishers.
     */
    fun buildPodiumInput(
        playType: String,
        friends: Boolean = false,
        meta: com.wordocious.app.GenMode,
        day: String,
        entries: List<LeaderboardService.LeaderboardEntry>,
        userId: String?,
        // Top 5 + sharer's final rank — daily-card parity (founder, Aug 10).
        userRank: LeaderboardService.RankInfo? = null,
        userEntry: LeaderboardService.LeaderboardEntry? = null,
    ): CardInput? {
        val top = entries.take(5)
        if (top.isEmpty()) return null
        val subline: (LeaderboardService.LeaderboardEntry) -> String =
            if (playType == "vs") ::vsSubline else ::soloSubline
        val youInTop = userId != null && top.any { it.userId == userId }
        val belowTop = !youInTop && userId != null && userRank != null && userEntry != null
        val cardLabels = com.wordocious.app.ui.tieAwareScoreLabels(
            top.map { it.compositeScore } + if (belowTop) listOf(userEntry!!.compositeScore) else emptyList(),
        )
        return CardInput(
            variant = if (friends) Variant.FRIENDS_PODIUM else Variant.PODIUM,
            shareMode = meta.title,
            gameModeLower = (meta.dbKey ?: meta.title).lowercase(),
            accent = meta.accentInt,
            modeChip = if (playType == "vs") "${meta.shareLabel} VS" else meta.shareLabel,
            dateChip = "${formatBoardDate(day)} · Final",
            rows = top.mapIndexed { i, e -> toRow(i + 1, e, userId, if (belowTop) null else subline, cardLabels) },
            you = if (belowTop) toRow(userRank!!.rank, userEntry!!, userId, subline, cardLabels) else null,
            youRankLine = if (belowTop) "#${userRank!!.rank} of ${userRank!!.totalPlayers}" else null,
            footer = "Today’s board is open — wordocious.com",
            day = day,
            shareRank = userRank?.rank,
            sharePlayers = userRank?.totalPlayers,
        )
    }

    // ── Sweep builders (§231) ──────────────────────────────────────────────────

    /** The Sweep board has no catalog mode: it rides the existing Daily Sweep
     *  share mode ("DailySweep" /s/ key segment, `lm=SWEEP` like the DB-style
     *  board id) and the violet the sweep label already uses. */
    private const val SWEEP_SHARE_MODE = "DailySweep"
    private const val SWEEP_LM = "SWEEP"
    private const val SWEEP_ACCENT = 0xFF7C3AED.toInt()

    /** "12m 4s · 7/8 · Flawless" — the sweep row's own stats, not guesses; the
     *  denominator is that day's sweep-era size (Stage 9: 8 today, 9 before). */
    private fun sweepSubline(e: LeaderboardService.SweepEntry, day: String): String =
        "${com.wordocious.app.ui.formatShortTime(e.totalTime)} · ${e.modesWon}/${com.wordocious.app.ModeGen.requiredSweepCount(day)} · ${if (e.isFlawless) "Flawless" else "Sweep"}"

    /** §249: per-dot values — null = unplayed, -1 = loss, else win intensity t.
     *  Order = the in-app SweepModeDots ([com.wordocious.app.ui.sweepDotModes]). */
    fun sweepDotValues(det: LeaderboardService.SweepDetails?, day: String): List<Double?>? {
        if (det == null) return null
        return com.wordocious.app.ui.sweepDotModes(day).map { mode ->
            val d = det.modes[mode] ?: return@map null
            if (!d.completed) return@map -1.0
            val ratio = d.score / DailyScoring.modeScoreCeiling(mode, day)
            ((ratio - 0.35) / 0.55).coerceIn(0.0, 1.0)
        }
    }

    private fun sweepRow(
        e: LeaderboardService.SweepEntry,
        userId: String?,
        scoreLabels: Map<Double, String>,
        day: String,
        dots: List<Double?>? = null,
    ): RowInput = RowInput(
        // The RPC already ranks tie-aware (§217) — never re-rank by index.
        rank = e.rank.toInt(),
        name = e.username ?: "Player",
        scoreDisplay = scoreLabels[e.totalScore] ?: com.wordocious.app.ui.formatScore(e.totalScore),
        subline = sweepSubline(e, day),
        isYou = userId != null && e.userId == userId,
        dots = dots,
    )

    /**
     * Sweep-board card (§231): top 5 (board) or top 3 (podium) rows from the
     * RPC, ranks carried verbatim. A sharer below the visible rows gets their
     * own row (if the caller's list holds it) and "#R of TOTAL" from the sweep
     * rank; either missing → omitted. No delta pill — the sweep rank has no
     * yesterday to compare against. Null for an empty board.
     */
    fun buildSweepInput(
        variant: Variant,
        day: String,
        entries: List<LeaderboardService.SweepEntry>,
        userId: String?,
        userRank: LeaderboardService.RankInfo? = null,
        now: Calendar = Calendar.getInstance(),
        // §249: per-user mode details — rows grow the nine-dot strip.
        details: Map<String, LeaderboardService.SweepDetails> = emptyMap(),
    ): CardInput? {
        val podium = variant == Variant.SWEEP_PODIUM
        val top = entries.take(if (podium) 3 else 5)
        if (top.isEmpty()) return null
        val youInTop = userId != null && top.any { it.userId == userId }
        val userEntry = if (!youInTop && userId != null) entries.firstOrNull { it.userId == userId } else null
        val belowTop = userEntry != null && userRank != null
        val puzzle = puzzleNumberForDay(day)
        val cardLabels = com.wordocious.app.ui.tieAwareScoreLabels(
            top.map { it.totalScore } + if (belowTop) listOf(userEntry!!.totalScore) else emptyList(),
        )
        return CardInput(
            variant = variant,
            shareMode = SWEEP_SHARE_MODE,
            gameModeLower = SWEEP_LM.lowercase(),
            accent = SWEEP_ACCENT,
            modeChip = "Daily Sweep",
            dateChip = if (podium) "${formatBoardDate(day)} · Final"
                else "${formatBoardDate(day)}${if (puzzle != null) " · #$puzzle" else ""} · as of ${formatClockTime(now)}",
            rows = top.map { sweepRow(it, userId, cardLabels, day, sweepDotValues(details[it.userId], day)) },
            you = if (belowTop) sweepRow(userEntry!!, userId, cardLabels, day, sweepDotValues(details[userEntry.userId], day)) else null,
            youRankLine = if (belowTop) "#${userRank!!.rank} of ${userRank.totalPlayers}" else null,
            footer = "Can you sweep them all? Play free at wordocious.com",
            day = day,
            shareRank = userRank?.rank,
            sharePlayers = userRank?.totalPlayers,
        )
    }

    // ── Weekly-race builder (§234) ─────────────────────────────────────────────

    /** Like the Sweep board, the weekly race has no catalog mode: its own
     *  "WeeklyRace" /s/ key segment with `lm=WEEKLY` and the friends board's
     *  indigo (shared verbatim with the web/iOS cards). */
    private const val WEEKLY_SHARE_MODE = "WeeklyRace"
    private const val WEEKLY_LM = "WEEKLY"
    private const val WEEKLY_ACCENT = 0xFF4F46E5.toInt()

    /** "4d 07:32" / "07:32:18" until Monday 00:00 local — the FriendsPanel
     *  countdown's next-Monday-midnight math, compacted for the date chip. */
    private fun weeklyTimeLeft(now: java.time.LocalDateTime = java.time.LocalDateTime.now()): String {
        // Weeks run Mon–Sun, reset Monday 00:00 local (§218 panel parity).
        val end = now.toLocalDate().plusDays((8 - now.dayOfWeek.value).toLong()).atStartOfDay()
        val secs = java.time.Duration.between(now, end).seconds.coerceAtLeast(0)
        val d = secs / 86400
        return if (d >= 1) "%dd %02d:%02d".format(d, (secs % 86400) / 3600, (secs % 3600) / 60)
        else "%02d:%02d:%02d".format(secs / 3600, (secs % 3600) / 60, secs % 60)
    }

    /**
     * Friends weekly-race card (§234): me + every friend ranked by this week's
     * points (dense positional ranks — the panel podium's ordering, extended
     * past three). Top 5 rows with a "N today" subline for anyone who scored
     * today; a sharer below the top 5 gets their highlighted row + "#R of N".
     * Null until anyone scored — the Monday zero-point podium isn't a card.
     */
    fun buildWeeklyRaceInput(
        friends: List<FriendsService.FriendProfile>,
        me: FriendsService.MeDigest?,
        username: String,
        now: Calendar = Calendar.getInstance(),
    ): CardInput? {
        // The sharer rides under their REAL username — this card lands in
        // other people's feeds, where "You" names nobody.
        data class Entry(val name: String, val week: Int, val today: Int, val isYou: Boolean)
        val entries = (friends.map { Entry(it.username, it.weekPoints ?: 0, it.todayPoints ?: 0, false) } +
            Entry(username, me?.weekPoints ?: 0, me?.todayPoints ?: 0, true))
            .sortedByDescending { it.week }
        if (entries.none { it.week > 0 }) return null

        fun row(rank: Int, e: Entry) = RowInput(
            rank = rank,
            name = e.name,
            scoreDisplay = String.format(java.util.Locale.US, "%,d pts", e.week),
            subline = if (e.today > 0) String.format(java.util.Locale.US, "%,d today", e.today) else null,
            isYou = e.isYou,
        )

        val top = entries.take(5)
        val myIdx = entries.indexOfFirst { it.isYou }
        val belowTop = myIdx >= 5
        val day = todayLocalDate()
        return CardInput(
            variant = Variant.WEEKLY_RACE,
            shareMode = WEEKLY_SHARE_MODE,
            gameModeLower = WEEKLY_LM.lowercase(),
            accent = WEEKLY_ACCENT,
            modeChip = "Weekly Race",
            // A race card is live TWICE over — the countdown names the window
            // still open, "as of" marks the standings as a snapshot.
            dateChip = "${formatBoardDate(day)} · ${weeklyTimeLeft()} left · as of ${formatClockTime(now)}",
            rows = top.mapIndexed { i, e -> row(i + 1, e) },
            you = if (belowTop) row(myIdx + 1, entries[myIdx]) else null,
            youRankLine = if (belowTop) "#${myIdx + 1} of ${entries.size}" else null,
            footer = "Think you can catch them? Play free at wordocious.com",
            day = day,
            shareRank = myIdx + 1,
            sharePlayers = entries.size,
        )
    }

    // ── Flawless streak (§244) + trophy case (§245) builders ───────────────────

    /** §248: per-day totals for the streak card's rows. */
    data class FlawlessDayStats(
        val day: String, val timeSeconds: Int, val guesses: Int, val hints: Int, val points: Double,
        /** §249: per-dot values for the row's mode strip. */
        val dots: List<Double?>? = null,
    )

    /** §244/§248 (founder: the first cut "doesn't make sense and looks ugly"):
     *  one row per streak day, OLDEST FIRST, each carrying the sweep-row stats
     *  (time · guesses · hints) and the day's points; today rides last with
     *  the gold you-treatment. Rows numbered by day-of-streak — the renderer
     *  skips crown/medals for this variant. Null when no streak. */
    fun buildFlawlessStreakInput(
        streak: Int, bestStreak: Int, username: String?,
        days: List<FlawlessDayStats> = emptyList(),
        now: Calendar = Calendar.getInstance(),
    ): CardInput? {
        if (streak < 1) return null
        val day = todayLocalDate()
        val statsByDay = days.associateBy { it.day }
        val shown = minOf(streak, 5)
        val rows = (0 until shown).map { i ->
            val dayNumber = streak - shown + i + 1
            val d = java.time.LocalDate.parse(day).plusDays((dayNumber - streak).toLong()).toString()
            val st = statsByDay[d]
            val subline = st?.let {
                buildString {
                    append(com.wordocious.app.ui.formatShortTime(it.timeSeconds))
                    append(" · ${it.guesses} guess${if (it.guesses == 1) "" else "es"}")
                    if (it.hints > 0) append(" · ${it.hints} hint${if (it.hints == 1) "" else "s"}")
                }
            }
            RowInput(rank = dayNumber, name = formatBoardDate(d),
                     scoreDisplay = st?.let { String.format(java.util.Locale.US, "%,d pts", Math.round(it.points)) }
                         ?: com.wordocious.app.ModeGen.requiredSweepCount(d).let { n -> "$n/$n won" },
                     subline = subline, isYou = i == shown - 1, dots = st?.dots)
        }
        val skipped = streak - shown
        var footer = "$streak straight day${if (streak == 1) "" else "s"} winning every daily"
        if (skipped > 0) footer += " (first $skipped not shown)"
        if (bestStreak > streak) footer += " · best $bestStreak"
        footer += " · wordocious.com"
        return CardInput(
            variant = Variant.FLAWLESS_STREAK,
            shareMode = "FlawlessStreak", gameModeLower = "flawlessstreak",
            accent = 0xFFD97706.toInt(), modeChip = "Flawless ×$streak",
            dateChip = "${formatBoardDate(day)} · as of ${formatClockTime(now)}",
            rows = rows, footer = footer, day = day,
        )
    }

    /** §245: held all-time records, most impressive first. */
    fun buildTrophyCaseInput(
        records: List<LeaderboardService.AllTimeRecord>, username: String?,
        now: Calendar = Calendar.getInstance(),
    ): CardInput? {
        if (records.isEmpty()) return null
        val order = listOf("fastest_win", "fewest_guesses", "longest_streak", "most_gold_medals",
            "highest_level", "most_games_played", "most_daily_completions")
        val lowerIsBetter = setOf("fastest_win", "fewest_guesses")
        val labels = mapOf(
            "fastest_win" to "Fastest Win", "fewest_guesses" to "Fewest Guesses",
            "most_games_played" to "Most Games Played", "longest_streak" to "Longest Streak",
            "most_gold_medals" to "Most Gold Medals", "highest_level" to "Highest Level",
            "most_daily_completions" to "Most Dailies Completed",
        )
        // "fewest_guesses" reads through the mode's guess semantics (More Games
        // §18): Sudoku "Fewest Mistakes · 0 mistakes", Hubbub "Best Rank · Hubbub".
        fun fewestMeta(gm: String?) = gm?.let { com.wordocious.app.ModeGen.byDbKey(it) }?.takeIf { it.guessSemantics != "guesses" }
        fun label(type: String, gm: String?): String =
            if (type == "fewest_guesses") fewestMeta(gm)?.let { ModeStats.fewestRecordLabel(it.guessSemantics) } ?: "Fewest Guesses"
            else labels[type] ?: type
        fun fmt(type: String, v: Int, gm: String? = null): String = when (type) {
            "fastest_win" -> if (v < 60) "${v}s" else "${v / 60}m ${v % 60}s"
            "fewest_guesses" -> fewestMeta(gm)?.let { com.wordocious.app.ui.formatGuessStat(it.guessSemantics, it.guessBase, v) } ?: com.wordocious.app.ui.formatGuessStat("guesses", 1, v)
            "most_games_played" -> "$v games"
            "longest_streak" -> "$v wins"
            "most_gold_medals" -> "$v golds"
            "highest_level" -> "Level $v"
            "most_daily_completions" -> "$v dailies"
            else -> "$v"
        }
        val sorted = records.sortedWith(compareBy({ order.indexOf(it.recordType).let { i -> if (i == -1) 99 else i } },
            { if (it.recordType in lowerIsBetter) it.recordValue else -it.recordValue }))
        // MODE_OPTIONS holds the sweep picker only — a More Games record
        // (ProperNoundle, Sudoku…) reads its title from the catalog.
        fun title(gm: String?): String = gm?.let { key ->
            com.wordocious.app.ui.MODE_OPTIONS.firstOrNull { it.first == key }?.second
                ?: com.wordocious.app.ModeGen.byDbKey(key)?.title
        } ?: "Global"
        val rows = sorted.take(5).mapIndexed { i, r ->
            RowInput(rank = i + 1,
                     name = "${title(r.gameMode)} · ${label(r.recordType, r.gameMode)}",
                     scoreDisplay = fmt(r.recordType, r.recordValue.toInt(), r.gameMode),
                     subline = null, isYou = false)
        }
        val extra = records.size - rows.size
        var footer = "${records.size} all-time record${if (records.size == 1) "" else "s"} held"
        if (extra > 0) footer += " (+$extra more)"
        footer += " · wordocious.com"
        val day = todayLocalDate()
        return CardInput(
            variant = Variant.TROPHY_CASE,
            shareMode = "TrophyCase", gameModeLower = "trophycase",
            accent = 0xFFD97706.toInt(),
            modeChip = username?.let { "$it's Records" } ?: "Trophy Case",
            dateChip = "${formatBoardDate(day)} · as of ${formatClockTime(now)}",
            rows = rows, footer = footer, day = day,
        )
    }

    // ── Renderer (FINISH_SPEC E1: the leaderboard card in the finished look) ────

    /** Vertically-centered text (web textBaseline='middle'). */
    private fun Canvas.textV(text: String, x: Float, cy: Float, p: Paint) {
        drawText(text, x, cy - (p.ascent() + p.descent()) / 2, p)
    }

    /** Truncate with an ellipsis to fit maxWidth at the paint's current font. */
    private fun clampText(p: Paint, text: String, maxWidth: Float): String {
        if (p.measureText(text) <= maxWidth) return text
        var t = text
        while (t.length > 1 && p.measureText(t + "…") > maxWidth) t = t.dropLast(1)
        return t + "…"
    }

    /** The wallpaper behind each variant (the page it lives on). */
    private fun wallpaper(v: Variant): Int = when (v) {
        Variant.VS -> com.wordocious.app.ui.PageTint.VS.wallpaperRes()
        Variant.FRIENDS, Variant.FRIENDS_PODIUM, Variant.WEEKLY_RACE -> com.wordocious.app.ui.PageTint.FRIENDS.wallpaperRes()
        else -> com.wordocious.app.ui.PageTint.LEADERBOARD.wallpaperRes()
    }

    /** The page accent the rows panel is tinted in (A1: Leaderboard gold, VS teal, Friends pink). */
    private fun pageAccent(v: Variant): Int = when (v) {
        Variant.VS -> com.wordocious.app.ui.PageTint.VS.accent.toArgb()
        Variant.FRIENDS, Variant.FRIENDS_PODIUM, Variant.WEEKLY_RACE -> com.wordocious.app.ui.PageTint.FRIENDS.accent.toArgb()
        else -> com.wordocious.app.ui.PageTint.LEADERBOARD.accent.toArgb()
    }

    /** Day boards head with that weekday's title art (A6); the brag cards keep their page art. */
    private fun isDayBoard(v: Variant): Boolean = v != Variant.WEEKLY_RACE && v != Variant.FLAWLESS_STREAK && v != Variant.TROPHY_CASE

    /** No podium on the brag cards: their rows are days / records, not competitors. */
    private fun hasPodium(v: Variant): Boolean = v != Variant.FLAWLESS_STREAK && v != Variant.TROPHY_CASE

    /** The medal step colors (FinishPages PodiumInk: gold / silver / bronze). */
    private fun stepColors(place: Int): IntArray = when (place) {
        1 -> intArrayOf(0xFFFFD66B.toInt(), 0xFFF5A524.toInt())
        2 -> intArrayOf(0xFFE4E8F0.toInt(), 0xFFAAB3C5.toInt())
        else -> intArrayOf(0xFFFFC9A0.toInt(), 0xFFD9844A.toInt())
    }
    private fun medal(place: Int): Int = when (place) { 1 -> 0xFFF5A524.toInt(); 2 -> 0xFFAAB3C5.toInt(); else -> 0xFFD9844A.toInt() }

    /** A tinted chip (A1 `.pill`): the wash, a 1.5-unit line, the accent band across the top; dark ink text. */
    private fun drawChip(c: Canvas, text: String, x: Float, y: Float, h: Float, accent: Int, p: Paint, ink: Int): Float {
        val w = p.measureText(text) + 44f
        val r = RectF(x, y, x + w, y + h)
        ShareFinish.drawTintedCard(c, r, h / 2f, ShareFinish.wash(accent, 0.14f), ShareFinish.wash(accent, 0.32f),
            intArrayOf(accent), 4f * U / 1.5f, shadow = 0x143C1E6E, shadowDy = 6f, shadowBlur = 14f)
        p.color = ink
        c.textV(text, x + 22f, r.centerY() + 2f, p)
        return w
    }

    /** The darker readable ink for an accent (FinishPages darkenInk). */
    private fun inkOf(accent: Int): Int = com.wordocious.app.ui.TintMath.over(0xFF000000.toInt(), 0.45f, accent or (0xFF shl 24))

    /** §249 nine-dot mode strip (violet win intensity, red loss, hollow unplayed), left edge [x0]. */
    private fun drawDots(c: Canvas, dots: List<Double?>, x0: Float, cy: Float, r: Float, step: Float) {
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        dots.forEachIndexed { i, d ->
            val cx = x0 + r + i * step
            when {
                d == null -> { p.style = Paint.Style.STROKE; p.strokeWidth = 2f; p.color = 0xFFD8C8F3.toInt(); c.drawCircle(cx, cy, r, p); p.style = Paint.Style.FILL }
                d < 0 -> { p.color = 0xFFEF4444.toInt(); c.drawCircle(cx, cy, r, p) }
                else -> { p.color = 0xFF7C3AED.toInt(); p.alpha = ((0.18 + 0.82 * d) * 255).toInt().coerceIn(0, 255); c.drawCircle(cx, cy, r, p); p.alpha = 255 }
            }
        }
    }

    /** The rank mark in a row: a glossy medal tile for 1–3, else the soft rank number. */
    private fun drawRankMark(c: Canvas, fonts: ShareFinish.Fonts, rank: Int, cx: Float, cy: Float, size: Float, numeric: Boolean) {
        if (!numeric && rank in 1..3) {
            ShareFinish.drawTile(c, RectF(cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2), ShareFinish.family(medal(rank)), "$rank", fonts.black, 0.5f)
        } else {
            val p = ShareFinish.softPaint(fonts, min(34f, size * 0.7f))
            c.textV("$rank", cx, cy, p)
        }
    }

    /**
     * One leaderboard row in the rows panel: soft stripe (or the gold "you" wash),
     * rank mark, name (+ · YOU, delta pill, dots), soft score with its subline.
     */
    private fun drawRow(
        c: Canvas, fonts: ShareFinish.Fonts, row: RowInput, index: Int, accent: Int,
        x: Float, y: Float, w: Float, h: Float,
        rankLine: String? = null, delta: Delta? = null, numericRank: Boolean = false,
    ) {
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        val rect = RectF(x + 8f, y + 3f, x + w - 8f, y + h - 3f)
        if (row.isYou) {
            ShareFinish.drawTintedCard(c, rect, 14f * U / 1.5f, 0xFFFFF5DF.toInt(), 0xFFF8E2B4.toInt(), intArrayOf(0xFFF5A524.toInt(), 0xFFFFD166.toInt()), 4f * U / 1.5f,
                shadow = 0x40F59E0B, shadowDy = 4f, shadowBlur = 24f)
        } else if (index % 2 == 0) {
            p.color = (0x1A shl 24) or (accent and 0xFFFFFF)
            c.drawRoundRect(rect, 12f * U / 1.5f, 12f * U / 1.5f, p)
        }
        val midY = y + h / 2
        drawRankMark(c, fonts, row.rank, x + 52f, midY, min(54f, h * 0.62f), numericRank)

        // Right block: soft score, optional subline underneath.
        val rightX = x + w - 30f
        val score = ShareFinish.softPaint(fonts, min(36f, h * 0.42f), Paint.Align.RIGHT)
        c.textV(row.scoreDisplay, rightX, if (row.subline != null) midY - h * 0.14f else midY, score)
        var rightBlockW = score.measureText(row.scoreDisplay)
        if (row.subline != null) {
            p.typeface = fonts.bold; p.textSize = min(21f, h * 0.26f); p.color = ShareFinish.INK_LABEL; p.textAlign = Paint.Align.RIGHT
            c.textV(row.subline, rightX, midY + h * 0.2f, p)
            rightBlockW = max(rightBlockW, p.measureText(row.subline))
        }

        val nameX = x + 96f
        val nameMaxW = w - 96f - 30f - rightBlockW - 24f
        val hasDots = !row.dots.isNullOrEmpty()
        val nameY = if (rankLine != null || hasDots) midY - h * 0.16f else midY
        p.textAlign = Paint.Align.LEFT
        var reserved = 0f
        if (row.isYou) { p.typeface = fonts.black; p.textSize = 24f; reserved = p.measureText(" · YOU") }
        p.typeface = fonts.black; p.textSize = min(30f, h * 0.36f); p.color = ShareFinish.INK_HEADING
        val name = clampText(p, row.name, max(60f, nameMaxW - reserved))
        c.textV(name, nameX, nameY, p)
        var cursorX = nameX + p.measureText(name)
        if (row.isYou) {
            p.textSize = 24f; p.color = 0xFFA2560C.toInt()
            c.textV(" · YOU", cursorX, nameY, p)
            cursorX += p.measureText(" · YOU")
        }
        var dotsEndX = nameX
        if (hasDots) {
            val r = 7f
            drawDots(c, row.dots!!, nameX, midY + h * 0.2f, r, 20f)
            dotsEndX = nameX + r + (row.dots.size - 1) * 20f + r + 14f
        }
        if (row.isYou && (delta != null || rankLine != null)) {
            val lineY = midY + h * 0.2f
            var lx = if (hasDots) dotsEndX else nameX
            if (rankLine != null) {
                p.typeface = fonts.heavy; p.textSize = 21f; p.color = 0xFFA2560C.toInt()
                c.textV(rankLine, lx, lineY, p)
                lx += p.measureText(rankLine) + 12f
            }
            if (delta != null) {
                p.typeface = fonts.heavy; p.textSize = 18f
                val pillH = 30f
                val pillTop = if (rankLine != null) lineY - pillH / 2 else nameY - pillH / 2
                val pillX = if (rankLine != null) lx else cursorX + 12f
                drawDeltaPill(c, p, delta, pillX, pillTop, pillH)
            }
        }
    }

    /** The rank-delta pill: tinted green / rose. Returns its width. */
    private fun drawDeltaPill(c: Canvas, p: Paint, delta: Delta, x: Float, top: Float, h: Float): Float {
        val w = p.measureText(delta.text) + 24f
        val accent = if (delta.improved) 0xFF16A34A.toInt() else 0xFFE11D48.toInt()
        ShareFinish.drawTintedCard(c, RectF(x, top, x + w, top + h), h / 2f, ShareFinish.wash(accent, 0.14f), ShareFinish.wash(accent, 0.34f), shadow = 0)
        p.color = inkOf(accent)
        c.textV(delta.text, x + 12f, top + h / 2f + 1f, p)
        return w
    }

    /**
     * The podium (second · first · third on gold / silver / bronze steps, first tallest):
     * a glossy letter-tile avatar per spot (the crown over first), the name and soft
     * points (+ the sweep dots) above each step. [h] = the block's height.
     */
    private fun drawPodium(context: Context, c: Canvas, fonts: ShareFinish.Fonts, spots: List<RowInput>, left: Float, right: Float, top: Float, h: Float) {
        val gap = 8f * U
        val colW = (right - left - gap * 2) / 3f
        val k = (h / 380f).coerceIn(0.6f, 1.2f)
        val stepH = mapOf(1 to 130f * k, 2 to 96f * k, 3 to 70f * k)
        // The podium art (10-03): the floor plate across the block's foot, the glossy pedestals on it.
        val rise = 14f * k
        val bottom = top + h - rise
        val bmpPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        runCatching { BitmapFactory.decodeResource(context.resources, com.wordocious.app.ui.PodiumArt.FLOOR_RES) }.getOrNull()?.let { floor ->
            c.drawBitmap(floor, null, RectF(left, bottom - rise - 4f, right, bottom + rise), bmpPaint)
        }
        listOf(2, 1, 3).forEachIndexed { colIdx, place ->
            val s = spots.getOrNull(place - 1) ?: return@forEachIndexed
            val x = left + colIdx * (colW + gap)
            val cx = x + colW / 2f
            val sh = stepH.getValue(place)
            val step = RectF(x, bottom - sh, x + colW, bottom)
            val numbered = s.rank == place
            val ped = runCatching { BitmapFactory.decodeResource(context.resources, com.wordocious.app.ui.PodiumArt.pedestal(place, numbered)) }.getOrNull()
            if (ped != null) {
                val pw = min(colW, sh * ped.width / ped.height.toFloat())
                c.drawBitmap(ped, null, RectF(cx - pw / 2f, step.top, cx + pw / 2f, step.bottom), bmpPaint)
            } else {
                val sp = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    shader = android.graphics.LinearGradient(0f, step.top, 0f, step.bottom, stepColors(place), null, android.graphics.Shader.TileMode.CLAMP)
                }
                val rr = 12f * U / 1.5f
                c.drawPath(Path().apply { addRoundRect(step, floatArrayOf(rr, rr, rr, rr, 0f, 0f, 0f, 0f), Path.Direction.CW) }, sp)
            }
            if (!numbered || ped == null) {
                val num = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    textAlign = Paint.Align.CENTER; typeface = fonts.black; textSize = min(48f, sh * 0.42f); color = Color.WHITE
                    setShadowLayer(0.01f, 0f, 4f, 0x2E000000)
                }
                c.textV("${s.rank}", cx, step.centerY() + sh * 0.12f, num)
            }
            // Name, soft points, dots — stacked up from the step.
            var y = step.top - 10f
            if (!s.dots.isNullOrEmpty()) {
                val r = 6f * k; val stepX = 16f * k
                val w = r * 2 + (s.dots.size - 1) * stepX
                drawDots(c, s.dots, cx - w / 2f, y - r, r, stepX)
                y -= r * 2 + 8f
            }
            val pts = ShareFinish.softPaint(fonts, 36f * k)
            ShareFinish.fitText(pts, s.scoreDisplay, colW - 8f)
            c.drawText(s.scoreDisplay, cx, y - 2f, pts)
            y -= pts.textSize + 6f
            val name = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                textAlign = Paint.Align.CENTER; typeface = fonts.black; textSize = 28f * k
                color = if (s.isYou) 0xFFA2560C.toInt() else ShareFinish.INK_HEADING
                ShareFinish.softShadow(this)
            }
            val label = clampText(name, if (s.isYou) "${s.name} · YOU" else s.name, colW - 8f)
            c.drawText(label, cx, y - 2f, name)
            y -= name.textSize + 12f
            // The letter-tile avatar (first bigger) with the crown on first.
            val a = (if (place == 1) 112f else 92f) * k
            val av = RectF(cx - a / 2f, y - a, cx + a / 2f, y)
            if (s.isYou) {
                val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = 6f; color = 0xFFF5A524.toInt() }
                c.drawRoundRect(RectF(av.left - 7f, av.top - 7f, av.right + 7f, av.bottom + 7f), a * 0.28f, a * 0.28f, ring)
            }
            // AN5: every podium player's mascot (the same composer as the on-screen avatars).
            run {
                // BJ5: the shared resolver's mascot (share podiums stay mascot-only, never a letter tile).
                val cfg = ShareAvatars.mascotConfig(null, s.name)
                val key = com.wordocious.app.ui.MascotKey.of(cfg, MascotConfigRules.initialOf(s.name), 200f, a.toInt(), dark = false)
                com.wordocious.app.ui.MascotComposer.draw(context, c, av.left, av.top, a, key)
            }
            if (place == 1) {
                val cw = 64f * k
                ShareFinish.drawArtInto(context, c, R.drawable.icon3d_crown, RectF(cx - cw / 2f, av.top - cw * 0.78f, cx + cw / 2f, av.top + cw * 0.22f))
            }
        }
    }

    /** The brag cards keep their footer's facts ("12 straight days winning every daily · best 14") as a caption. */
    private fun bragCaption(input: CardInput): String? =
        if (input.variant == Variant.FLAWLESS_STREAK || input.variant == Variant.TROPHY_CASE) SharePicks.footerLines(input.footer).first else null

    /**
     * Render the card — FINISH_SPEC E1 look, S2-fitted ([ShareCard]): the day's (or the
     * page's) title art, the variant label as the info line, then the body — the mode /
     * date chips, the podium, the rows panel (and a brag card's caption) — and the S3
     * cast wordmark. Height follows the rows.
     */
    fun render(context: Context, input: CardInput): Bitmap {
        val fonts = ShareFinish.Fonts(context)
        val accent = pageAccent(input.variant)
        val w = 950f
        val cx = w / 2f

        // A6 the day's title art (or the page's), no box.
        val dayArt = if (isDayBoard(input.variant)) com.wordocious.app.ui.dayTitleArtRes(input.day, null) else null
        val headerRes = dayArt ?: headerArt(input.variant)

        val chipH = 52f
        val podium = hasPodium(input.variant)
        val podiumRows = if (podium) input.rows.take(3) else emptyList()
        val listRows = if (podium) input.rows.drop(3) else input.rows
        val dividerH = if (input.you != null) 34f else 0f
        val nList = listRows.size + (if (input.you != null) 1 else 0)
        val listRowH = if (podium) 92f else 110f
        val listH = if (nList > 0) nList * listRowH + dividerH + 20f else 0f
        val podiumH = if (podiumRows.isNotEmpty()) 400f else 0f
        val caption = bragCaption(input)
        val captionH = if (caption != null) 64f else 0f
        var bodyH = chipH + 24f + podiumH + listH + captionH
        if (podiumH > 0f && listH > 0f) bodyH += 16f

        val body = ShareCard.Body(w, bodyH) { c ->
            // Chips: the mode (its accent; swords on VS), the date, and — when the sharer is on
            // the podium — their rank delta.
            val chipP = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = fonts.heavy; textSize = 25f; textAlign = Paint.Align.LEFT }
            val modeAccent = if (input.variant == Variant.VS) VS_ACCENT else input.accent
            val youOnPodium = podium && input.you == null && input.rows.take(3).any { it.isYou }
            val deltaOnChips = if (youOnPodium) input.delta else null
            val deltaP = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = fonts.heavy; textSize = 22f }
            fun chipsW() = chipP.measureText(input.modeChip) + 44f + chipP.measureText(input.dateChip) + 44f + 14f +
                (deltaOnChips?.let { deltaP.measureText(it.text) + 24f + 14f } ?: 0f)
            val widths = chipsW()
            if (widths > w) chipP.textSize *= (w - 60f) / (widths - 60f)
            var chipX = (w - chipsW()) / 2f
            chipX += drawChip(c, input.modeChip, chipX, 0f, chipH, modeAccent, chipP, inkOf(modeAccent)) + 14f
            chipX += drawChip(c, input.dateChip, chipX, 0f, chipH, 0xFF7C3AED.toInt(), chipP, ShareFinish.INK_LABEL) + 14f
            deltaOnChips?.let { drawDeltaPill(c, deltaP, it, chipX, (chipH - 40f) / 2f, 40f) }

            var y = chipH + 24f
            if (podiumRows.isNotEmpty()) {
                drawPodium(context, c, fonts, podiumRows, 20f, w - 20f, y, podiumH)
                y += podiumH + (if (listH > 0f) 16f else 0f)
            }
            if (nList > 0) {
                val panel = RectF(0f, y, w, y + listH)
                ShareFinish.drawTintedCard(c, panel, 18f * U / 1.5f, ShareFinish.wash(accent, 0.12f), ShareFinish.wash(accent, 0.30f),
                    intArrayOf(accent), 4f * U / 1.5f * 2f)
                var ry = panel.top + 12f
                listRows.forEachIndexed { i, row ->
                    drawRow(c, fonts, row, i, accent, panel.left, ry, panel.width(), listRowH,
                        delta = if (row.isYou) input.delta else null, numericRank = input.variant == Variant.FLAWLESS_STREAK)
                    ry += listRowH
                }
                if (input.you != null) {
                    val dp = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = fonts.black; textSize = 26f; color = ShareFinish.INK_LABEL; textAlign = Paint.Align.CENTER }
                    c.textV("• • •", cx, ry + dividerH / 2, dp)
                    ry += dividerH
                    drawRow(c, fonts, input.you, 1, accent, panel.left, ry, panel.width(), listRowH,
                        rankLine = input.youRankLine, delta = input.delta, numericRank = input.variant == Variant.FLAWLESS_STREAK)
                }
                y += listH
            }
            if (caption != null) {
                val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    typeface = fonts.black; textSize = 30f; color = ShareFinish.INK_HEADING; textAlign = Paint.Align.CENTER
                    ShareFinish.softShadow(this)
                }
                ShareFinish.fitText(p, caption, w)
                c.textV(caption, cx, y + captionH / 2f + 6f, p)
            }
        }
        return ShareCard.render(context, ShareCard.Spec(
            wallpaper = wallpaper(input.variant),
            title = headerRes,
            titleFallback = label(input.variant),
            info = label(input.variant),
            body = body,
        ))
    }

    /** S4 the chooser title + file name for a variant ("Share your leaderboard"). */
    private fun shareName(v: Variant): String = when (v) {
        Variant.SOLO, Variant.VS, Variant.FRIENDS, Variant.SWEEP -> "leaderboard"
        Variant.PODIUM, Variant.FRIENDS_PODIUM, Variant.SWEEP_PODIUM -> "podium"
        Variant.WEEKLY_RACE -> "weekly race"
        Variant.FLAWLESS_STREAK -> "flawless streak"
        Variant.TROPHY_CASE -> "trophy case"
    }

    /**
     * Render → share. S1: the IMAGE ONLY (FileProvider PNG + ClipData, no EXTRA_TEXT) —
     * no hosted /s link is created anymore (old links keep resolving on the web).
     */
    suspend fun renderAndShare(context: Context, input: CardInput) {
        val bitmap = withContext(Dispatchers.Default) { render(context, input) }
        withContext(Dispatchers.Main) {
            val name = shareName(input.variant)
            val sent = ShareHelper.shareImages(
                context,
                listOf(bitmap to ShareHelper.fileName(name.split(" ").joinToString("") { it.replaceFirstChar { ch -> ch.titlecase() } })),
                "Share your $name",
                fallbackText = "wordocious.com",
            )
            ShareEvents.log(if (sent) "image" else "text", input.gameModeLower, SURFACE)
        }
    }

    // ── Fetch-and-share glue (web leaderboard-share-flow.ts) ───────────────────

    /**
     * Share today's board (solo or VS variant per the caller's toggle). The
     * page's already-fetched rows + rank come in; this adds the two cheap
     * lookups the card needs — the sharer's row when they rank below the
     * visible list, and yesterday's final rank for the delta pill. No-op for
     * an empty board or the synthetic Sweep id (no card design).
     */
    suspend fun shareDailyLeaderboardCard(
        context: Context,
        dbMode: String,
        playType: String,
        entries: List<LeaderboardService.LeaderboardEntry>,
        rankWindow: LeaderboardService.RankWindow?,
        userId: String?,
        userRank: LeaderboardService.RankInfo?,
        friends: Boolean = false,
    ) {
        val meta = ModeGen.byDbKey(dbMode) ?: return
        if (entries.isEmpty()) return
        val day = todayLocalDate()
        val variant = if (playType == "vs") Variant.VS else Variant.SOLO

        val inTop5 = userId != null && entries.take(5).any { it.userId == userId }

        // Sharer ranks below the top 5 and the page doesn't hold their row →
        // read a small window around their offset in the same ranked ordering
        // (ties can shift the exact offset — the window absorbs that). Not
        // found → the card simply omits the you-row.
        var userEntry = if (userId != null) {
            entries.firstOrNull { it.userId == userId }
                ?: rankWindow?.entries?.firstOrNull { it.userId == userId }
        } else null
        if (userId != null && userRank != null && !inTop5 && userEntry == null && !friends) {
            // Global board only — a friends board is entirely in `entries`.
            val offset = max(0, userRank.rank - 6)
            userEntry = LeaderboardService.fetchDailyLeaderboardOrNull(
                dbMode, playType, day, limit = 11, offset = offset,
            )?.firstOrNull { it.userId == userId }
        }

        // Yesterday's final rank for the delta pill — only meaningful when the
        // sharer is on today's board at all. Null = didn't play yesterday.
        val yesterdayRank = if (userId != null && userRank != null) {
            if (friends) {
                // Friend-rank vs friend-rank: dense index into yesterday's
                // friends-filtered board (§207).
                val ids = (FriendsService.friendIds + userId.lowercase()).toList()
                LeaderboardService.fetchDailyLeaderboardOrNull(
                    dbMode, playType, yesterdayLocalDate(), userIds = ids,
                )?.indexOfFirst { it.userId == userId }?.takeIf { it >= 0 }?.plus(1)
            } else {
                LeaderboardService.getUserDailyRank(userId, dbMode, playType, day = yesterdayLocalDate())?.rank
            }
        } else null

        val input = buildDailyInput(variant, friends, meta, day, entries, userId, userRank, userEntry, yesterdayRank) ?: return
        renderAndShare(context, input)
    }

    /** Share yesterday's settled podium (top 5 + sharer's final rank,
     *  "· Final" chip — daily-card parity, founder ask 2026-08-10). */
    suspend fun shareYesterdayPodiumCard(
        context: Context,
        dbMode: String,
        playType: String,
        entries: List<LeaderboardService.LeaderboardEntry>,
        userId: String?,
        friends: Boolean = false,
    ) {
        val meta = ModeGen.byDbKey(dbMode) ?: return
        val day = yesterdayLocalDate()
        // Sharer's FINAL rank yesterday + their own row for the below-top-5
        // treatment. Friends mode dense-ranks the friends-filtered board.
        var userRank: LeaderboardService.RankInfo? = null
        var userEntry = userId?.let { uid -> entries.firstOrNull { it.userId == uid } }
        if (userId != null) {
            if (friends) {
                val ids = (FriendsService.friendIds + userId.lowercase()).toList()
                val board = LeaderboardService.fetchDailyLeaderboardOrNull(dbMode, playType, day, userIds = ids)
                val idx = board?.indexOfFirst { it.userId == userId } ?: -1
                if (board != null && idx >= 0) {
                    userRank = LeaderboardService.RankInfo(idx + 1, board.size)
                    if (userEntry == null) userEntry = board[idx]
                }
            } else {
                userRank = LeaderboardService.getUserDailyRank(userId, dbMode, playType, day, entries, 5)
                if (userRank != null && userEntry == null) {
                    userEntry = LeaderboardService.fetchDailyLeaderboardOrNull(
                        dbMode, playType, day, limit = 1, userIds = listOf(userId),
                    )?.firstOrNull()
                }
            }
        }
        val input = buildPodiumInput(playType, friends, meta, day, entries, userId, userRank, userEntry) ?: return
        renderAndShare(context, input)
    }

    /**
     * Share today's Daily Sweep board (§231). The page's RPC rows + the
     * sharer's sweep rank come in already tie-ranked; nothing else to fetch —
     * a sharer below the visible rows whose row isn't in the list simply gets
     * no you-row.
     */
    suspend fun shareDailySweepCard(
        context: Context,
        entries: List<LeaderboardService.SweepEntry>,
        userId: String?,
        userRank: LeaderboardService.RankInfo?,
    ) {
        val day = todayLocalDate()
        // §249: one cheap details read for the rows the card shows.
        val details = cardSweepDetails(day, entries.take(5), userId)
        val input = buildSweepInput(Variant.SWEEP, day, entries, userId, userRank, details = details) ?: return
        renderAndShare(context, input)
    }

    /** §249: mode details for just the users a sweep card will render. */
    private suspend fun cardSweepDetails(
        day: String,
        top: List<LeaderboardService.SweepEntry>,
        userId: String?,
    ): Map<String, LeaderboardService.SweepDetails> {
        val ids = (top.map { it.userId } + listOfNotNull(userId)).distinct()
        return LeaderboardService.fetchSweepModeDetails(day, ids)
    }

    /** Share yesterday's settled sweep podium (§231): top 3, "· Final" chip,
     *  plus the sharer's final sweep rank when they're below the podium. */
    suspend fun shareYesterdaySweepPodiumCard(
        context: Context,
        entries: List<LeaderboardService.SweepEntry>,
        userId: String?,
    ) {
        val day = yesterdayLocalDate()
        val userRank = if (userId != null && entries.take(3).none { it.userId == userId })
            LeaderboardService.getUserSweepRank(userId, day) else null
        val details = cardSweepDetails(day, entries.take(3), userId)
        val input = buildSweepInput(Variant.SWEEP_PODIUM, day, entries, userId, userRank, details = details) ?: return
        renderAndShare(context, input)
    }

    /**
     * Share the friends weekly race (§234). Everything the card needs is the
     * FriendsPanel's own state — the cached friends digest and the sharer's
     * meDigest + username — so there is nothing to fetch.
     */
    suspend fun shareWeeklyRaceCard(
        context: Context,
        friends: List<FriendsService.FriendProfile>,
        me: FriendsService.MeDigest?,
        username: String,
    ) {
        val input = buildWeeklyRaceInput(friends, me, username) ?: return
        renderAndShare(context, input)
    }

    /** §244/§248: the flawless-streak brag card — fetches the sharer's own
     *  per-day stats (time · guesses · hints · points) before building. */
    suspend fun shareFlawlessStreakCard(context: Context, streak: Int, bestStreak: Int, username: String?) {
        val days = fetchFlawlessDayStats(streak)
        val input = buildFlawlessStreakInput(streak, bestStreak, username, days) ?: return
        renderAndShare(context, input)
    }

    @kotlinx.serialization.Serializable
    private data class FlawlessStatRow(
        val day: String,
        @kotlinx.serialization.SerialName("game_mode") val gameMode: String = "",
        val completed: Boolean = false,
        @kotlinx.serialization.SerialName("time_seconds") val timeSeconds: Int = 0,
        @kotlinx.serialization.SerialName("guess_count") val guessCount: Int = 0,
        @kotlinx.serialization.SerialName("hints_used") val hintsUsed: Int = 0,
        @kotlinx.serialization.SerialName("composite_score") val compositeScore: Double = 0.0,
    )

    private suspend fun fetchFlawlessDayStats(streak: Int): List<FlawlessDayStats> = runCatching {
        val uid = AuthService.userId ?: return emptyList()
        val today = java.time.LocalDate.parse(todayLocalDate())
        val days = (0 until minOf(streak, 5)).map { today.minusDays(it.toLong()).toString() }
        val rows = SupabaseConfig.client.postgrest["daily_results"]
            .select(io.github.jan.supabase.postgrest.query.Columns.raw("day,game_mode,completed,time_seconds,guess_count,hints_used,composite_score")) {
                filter { eq("user_id", uid); eq("play_type", "solo"); isIn("day", days) }
            }
            .decodeList<FlawlessStatRow>()
        rows.groupBy { it.day }.map { entry ->
            val rs = entry.value
            // §249: each day-row wears the in-app nine-dot mode strip.
            val det = LeaderboardService.SweepDetails(
                modes = rs.associate { it.gameMode to LeaderboardService.SweepModeDetail(it.compositeScore, it.completed) },
                guesses = rs.sumOf { it.guessCount }, hints = rs.sumOf { it.hintsUsed },
            )
            FlawlessDayStats(entry.key, rs.sumOf { it.timeSeconds }, rs.sumOf { it.guessCount },
                             rs.sumOf { it.hintsUsed }, rs.sumOf { it.compositeScore },
                             dots = sweepDotValues(det, entry.key))
        }
    }.getOrElse { emptyList() }

    /** §245: the trophy-case brag card. */
    suspend fun shareTrophyCaseCard(context: Context, records: List<LeaderboardService.AllTimeRecord>, username: String?) {
        val input = buildTrophyCaseInput(records, username) ?: return
        renderAndShare(context, input)
    }
}
