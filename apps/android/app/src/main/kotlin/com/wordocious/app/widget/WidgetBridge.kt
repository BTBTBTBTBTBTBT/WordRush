package com.wordocious.app.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import com.wordocious.app.App
import com.wordocious.app.ModeGen
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.DailyCompletionsService
import com.wordocious.app.todayLocalDate
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Android side of iOS WidgetBridge.swift: serializes the SAME snapshot JSON
 * (field-for-field — key/title/glyph/colorHex/played/won + flattened icon
 * spec, day/streak/points/seconds/shields) into SharedPreferences and pokes
 * the home-screen widget. The widget is a dumb renderer; the mode catalog
 * stays single-sourced in ModeGen exactly as iOS keeps it in the app target.
 */
object WidgetBridge {
    private const val PREFS = "wordocious_widget"
    private const val SNAPSHOT_KEY = "widget-snapshot"

    // Mirrors WidgetBridge.ModeEntry / WSnapshot.Mode on iOS. Keep names in sync.
    @Serializable
    data class ModeEntry(
        val key: String,
        val title: String,
        val glyph: String,
        val colorHex: String,
        val played: Boolean,
        val won: Boolean,
        val iconKind: String? = null,   // "asset" | "original" | "roman" | "hand"
        val iconAsset: String? = null,  // drawable-name equivalent (wordle-grid, skull…)
        val iconText: String? = null,   // roman text, or the hand modes' digit
    )

    @Serializable
    data class Snapshot(
        val day: String,
        val streak: Int,
        val modes: List<ModeEntry>,
        val points: Int? = null,
        val seconds: Int? = null,
        val shields: Int? = null,
        // Home redesign (founder, 2026-10-01): the widget mirrors the home banner, so the
        // snapshot also carries the ten Puzzles dailies, the username (headline greeting)
        // and both rows' runs. All optional: an older snapshot still decodes.
        val puzzles: List<ModeEntry>? = null,
        val puzzlePoints: Int? = null,
        val username: String? = null,
        val wordSweepStreak: Int? = null,
        val wordFlawlessStreak: Int? = null,
        val puzzlesSweepStreak: Int? = null,
        val puzzlesFlawlessStreak: Int? = null,
        /** FINISH_SPEC E2: today's Daily Sweep rank (the leaderboard's cached board), null when unknown. */
        val rank: Int? = null,
    )

    private val json = Json { ignoreUnknownKeys = true }

    /** Home-menu icon spec per catalog id — the flattened ModeIconKind iOS
     *  writes. six/seven are "hand" like iOS: the brand hand drawable
     *  (ic_six_hand/ic_seven_hand) with the digit kept in iconText for the
     *  renderer's overlay. */
    private fun iconSpec(id: String): Triple<String?, String?, String?> = when (id) {
        "practice" -> Triple("original", "wordle-grid", null)
        "quordle" -> Triple("roman", null, "IV")
        "octordle" -> Triple("roman", null, "VIII")
        "sequence" -> Triple("asset", "trending-up", null)
        "rescue" -> Triple("asset", "shield", null)
        "six" -> Triple("hand", "six-hand", "6")
        "seven" -> Triple("hand", "seven-hand", "7")
        "gauntlet" -> Triple("asset", "skull", null)
        "propernoundle" -> Triple("asset", "crown", null)
        // The Puzzles row (the More Games dailies): their home-card icons.
        "sudoku" -> Triple("asset", "grid-3x3", null)
        "scramble" -> Triple("asset", "shuffle", null)
        "hub" -> Triple("asset", "hexagon", null)
        "crossword" -> Triple("asset", "quote", null)
        "groups" -> Triple("asset", "group", null)
        "ladder" -> Triple("asset", "ladder", null)
        "cryptogram" -> Triple("asset", "key-round", null)
        "wordsearch" -> Triple("asset", "text-search", null)
        "regions" -> Triple("asset", "star", null)
        else -> Triple(null, null, null)
    }

    /** The More Games dailies, catalog order (the Puzzles row). Remote flags are
     *  not read here (the widget renders off the main process' state), so a
     *  flagged-off title still shows; FlagsService gates are the home page's job. */
    private fun puzzleModes(): List<com.wordocious.app.GenMode> =
        ModeGen.more.filter { it.dailyEligible && it.dbKey != null }

    private fun entry(m: com.wordocious.app.GenMode, c: DailyCompletionsService.Completion?): ModeEntry {
        val (kind, asset, text) = iconSpec(m.id)
        return ModeEntry(
            key = m.dbKey ?: m.id, title = m.shortTitle,
            glyph = m.romanNumeral ?: m.glyph ?: m.title.take(1),
            colorHex = m.accentHex,
            played = c != null, won = c?.completed ?: false,
            iconKind = kind, iconAsset = asset, iconText = text,
        )
    }

    /** Called wherever today's completions change (record, refetch, sign-out) —
     *  the Android analog of iOS WidgetBridge.update(completions:). Safe from
     *  any thread; a no-op render when no widget is placed. */
    fun update(byMode: Map<String, DailyCompletionsService.Completion>) {
        runCatching {
            val ctx = App.instance
            // Same source as the header pill (daily streak, NOT the win streak —
            // that mismatch was iOS's 🔥1-vs-🔥19 bug; don't re-import it here).
            val streak = AuthService.headerStreak ?: 0
            val modes = ModeGen.sweep.map { m -> entry(m, m.dbKey?.let { byMode[it] }) }
            val puzzles = puzzleModes().map { m -> entry(m, m.dbKey?.let { byMode[it] }) }
            // Same totals helpers as the banner/celebration/share card, so the
            // widget's points can never disagree with the app. FINISH_SPEC AL: the
            // widget's "points today" chip is points + puzzlePoints (all dailies,
            // WidgetStats.dayStats), the same combined sum iOS writes.
            val totals = DailyCompletionsService.totals(byMode)
            val rows = com.wordocious.app.data.HomeStreaksService.cachedRowStreaks()
            val snap = Snapshot(
                day = todayLocalDate(), streak = streak, modes = modes,
                points = totals.totalScore, seconds = totals.totalTimeSeconds,
                shields = AuthService.headerShields,
                puzzles = puzzles,
                puzzlePoints = com.wordocious.app.ui.moreTotals(byMode).totalScore,
                username = AuthService.profile.value?.username,
                wordSweepStreak = rows?.wordSweep, wordFlawlessStreak = rows?.wordFlawless,
                puzzlesSweepStreak = rows?.puzzlesSweep, puzzlesFlawlessStreak = rows?.puzzlesFlawless,
                rank = cachedRank(),
            )
            val encoded = json.encodeToString(Snapshot.serializer(), snap)
            // FINISH_SPEC BJ3 (iOS parity): Home refetches on every return, and an
            // unchanged snapshot used to rewrite the prefs and re-render every placed
            // widget (RemoteViews + bitmap work) each time. Same JSON → nothing to do.
            synchronized(this) {
                if (encoded == lastWritten) return@runCatching
                lastWritten = encoded
            }
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(SNAPSHOT_KEY, encoded)
                .apply()
            push(ctx)
        }
    }

    /** BJ3: the last snapshot JSON handed to the widget this process. */
    private var lastWritten: String? = null

    /**
     * Today's Daily Sweep rank from the leaderboard's own disk cache (no network: the
     * widget shows what the Leaderboard page last saw). Signed out → null. The cache
     * is keyed by day, so a stale yesterday's rank never shows.
     */
    private fun cachedRank(): Int? = runCatching {
        if (AuthService.userId == null) return@runCatching null
        com.wordocious.app.data.LeaderboardService.cachedSweep(
            com.wordocious.app.data.LeaderboardService.sweepCacheKey(todayLocalDate()),
        )?.rank?.rank
    }.getOrNull()

    /** Re-render every placed widget from the stored snapshot (the Android
     *  WidgetCenter.reloadAllTimelines). */
    fun push(context: Context) {
        val mgr = AppWidgetManager.getInstance(context)
        val ids = mgr.getAppWidgetIds(ComponentName(context, DailyWidgetProvider::class.java))
        if (ids.isNotEmpty()) DailyWidgetProvider.render(context, mgr, ids)
    }

    /** Fallback roster before the app has ever written a snapshot (fresh
     *  install / not signed in) — real mode grid from ModeGen, all unplayed. */
    fun emptySnapshot(): Snapshot = Snapshot(
        day = todayLocalDate(), streak = 0,
        modes = ModeGen.sweep.map { entry(it, null) },
        puzzles = puzzleModes().map { entry(it, null) },
    )

    /** Read the app-written snapshot; a snapshot from a previous day keeps the
     *  streak and shields but resets every mode (and the day's stats) to zero —
     *  new puzzles dropped at midnight. Mirrors iOS loadSnapshot(for:). */
    fun loadSnapshot(context: Context): Snapshot {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(SNAPSHOT_KEY, null) ?: return emptySnapshot()
        val snap = runCatching { json.decodeFromString(Snapshot.serializer(), raw) }
            .getOrElse { return emptySnapshot() }
        // A snapshot written before the Puzzles row existed has no `puzzles`: fill the
        // roster (all unplayed) so the widget's second row never renders empty.
        val withPuzzles = if (snap.puzzles.isNullOrEmpty()) snap.copy(puzzles = puzzleModes().map { entry(it, null) }) else snap
        // FINISH_SPEC AL: the day rollover lives in WidgetStats (unit tested).
        return WidgetStats.rollover(withPuzzles, todayLocalDate())
    }
}
