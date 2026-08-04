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
        else -> Triple(null, null, null)
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
            val modes = ModeGen.daily.map { m ->
                val c = m.dbKey?.let { byMode[it] }
                val (kind, asset, text) = iconSpec(m.id)
                ModeEntry(
                    key = m.dbKey ?: m.id, title = m.shortTitle,
                    glyph = m.romanNumeral ?: m.glyph ?: m.title.take(1),
                    colorHex = m.accentHex,
                    played = c != null, won = c?.completed ?: false,
                    iconKind = kind, iconAsset = asset, iconText = text,
                )
            }
            // Same totals helper as the banner/celebration/share card, so the
            // widget's time · points can never disagree with the home banner.
            val totals = DailyCompletionsService.totals(byMode)
            val snap = Snapshot(
                day = todayLocalDate(), streak = streak, modes = modes,
                points = totals.totalScore, seconds = totals.totalTimeSeconds,
                shields = AuthService.headerShields,
            )
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(SNAPSHOT_KEY, json.encodeToString(Snapshot.serializer(), snap))
                .apply()
            push(ctx)
        }
    }

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
        modes = ModeGen.daily.map { m ->
            val (kind, asset, text) = iconSpec(m.id)
            ModeEntry(
                key = m.dbKey ?: m.id, title = m.shortTitle,
                glyph = m.romanNumeral ?: m.glyph ?: m.title.take(1),
                colorHex = m.accentHex, played = false, won = false,
                iconKind = kind, iconAsset = asset, iconText = text,
            )
        },
    )

    /** Read the app-written snapshot; a snapshot from a previous day keeps the
     *  streak and shields but resets every mode (and the day's stats) to zero —
     *  new puzzles dropped at midnight. Mirrors iOS loadSnapshot(for:). */
    fun loadSnapshot(context: Context): Snapshot {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(SNAPSHOT_KEY, null) ?: return emptySnapshot()
        val snap = runCatching { json.decodeFromString(Snapshot.serializer(), raw) }
            .getOrElse { return emptySnapshot() }
        if (snap.day == todayLocalDate()) return snap
        return Snapshot(
            day = todayLocalDate(), streak = snap.streak,
            modes = snap.modes.map { it.copy(played = false, won = false) },
            points = 0, seconds = 0, shields = snap.shields,
        )
    }
}
