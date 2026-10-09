package com.wordocious.app.data

import com.wordocious.core.Season
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch

/**
 * Theme choice + the "Seasonal" row (FRIDAY-QUEUE items 24 + 25). Port of core theme-choice.ts, pinned by
 * theme-choice-fixtures.json (web + Swift + Kotlin read the same file). Pure (JVM-tested: ThemeChoiceTest).
 *
 *  - the player's BASE theme is never overwritten by a season: it is what comes back when the season ends
 *  - inside the window Seasonal is preset ON; picking another theme opts out for THIS season + year
 *  - picking Seasonal clears the opt-out; outside a season the row is hidden
 *  - the `season_halloween` off-switch turns every season look off
 */
object ThemeChoiceRules {
    val BASE_THEMES = listOf("default", "ocean", "forest", "dark")

    data class Choice(val theme: String = "default", val seasonOptOut: String? = null)

    /** "<season>:<year>" for a season and a local "YYYY-MM-DD" date. */
    fun optOutKey(season: String, date: String): String = "$season:${date.take(4)}"

    fun seasonalActive(c: Choice, season: String?, switchOn: Boolean, date: String): Boolean {
        if (season == null || !switchOn) return false
        return c.seasonOptOut != optOutKey(season, date)
    }

    fun showSeasonalRow(season: String?, switchOn: Boolean): Boolean = season != null && switchOn

    /** What to draw: the base theme, and whether the season layers on top. */
    fun effective(c: Choice, season: String?, switchOn: Boolean, date: String): Pair<String, Boolean> =
        c.theme to seasonalActive(c, season, switchOn, date)

    /** The choice after a tap on a Settings theme row ("seasonal" or a base theme). */
    fun pick(c: Choice, picked: String, season: String?, date: String): Choice =
        if (picked == "seasonal") Choice(c.theme, null)
        else Choice(picked, if (season != null) optOutKey(season, date) else c.seasonOptOut)

    /** "Oct 31": the window's last day, for the row subtitle. */
    fun endLabel(season: String): String? {
        val w = Season.windows.firstOrNull { it.id == season } ?: return null
        val months = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
        return "${months[w.endMonth - 1]} ${w.endDay}"
    }

    /** The stored Android theme key ("light" = Default) as a registry id. */
    fun fromStored(key: String?): String = when (key) {
        "dark", "ocean", "forest" -> key
        else -> "default"
    }

    /** A registry id as the stored Android key. */
    fun toStored(id: String): String = if (id == "default") "light" else id
}

/**
 * Item 24: the Seasonal opt-out follows the account (profiles.season_opt_out), same rules as web / iOS: a pick writes
 * it, and another device's choice is adopted once when this device has none. A missing column (migration not
 * applied) or being signed out is silently ignored; the local choice always holds.
 */
object ThemeSync {
    private val scope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.SupervisorJob() + kotlinx.coroutines.Dispatchers.IO)

    @kotlinx.serialization.Serializable
    private data class Remote(@kotlinx.serialization.SerialName("season_opt_out") val seasonOptOut: String? = null)

    fun push(value: String?) {
        val uid = AuthService.userId ?: return
        scope.launch {
            runCatching {
                SupabaseConfig.client.postgrest["profiles"].update({ set<String?>("season_opt_out", value) }) { filter { eq("id", uid) } }
            }
        }
    }

    /** Adopt the account's opt-out when this device has none (call after the profile loads). */
    fun pull() {
        val uid = AuthService.userId ?: return
        scope.launch {
            val remote = runCatching {
                SupabaseConfig.client.postgrest["profiles"]
                    .select(io.github.jan.supabase.postgrest.query.Columns.raw("season_opt_out")) { filter { eq("id", uid) } }
                    .decodeSingleOrNull<Remote>()?.seasonOptOut
            }.getOrNull()
            if (remote.isNullOrBlank()) return@launch
            if (SettingsPref.get(com.wordocious.app.ui.SeasonSkins.OPT_OUT_KEY, "").isNotBlank()) return@launch
            SettingsPref.set(com.wordocious.app.ui.SeasonSkins.OPT_OUT_KEY, remote)
            android.os.Handler(android.os.Looper.getMainLooper()).post { com.wordocious.app.ui.SeasonSkins.bumpEpoch() }
        }
    }
}
