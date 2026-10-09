package com.wordocious.app.data

import android.content.Context
import com.wordocious.app.App
import com.wordocious.app.ui.theme.Palettes
import com.wordocious.app.ui.theme.WTheme

/**
 * Persists the selected theme (light/dark/ocean/forest) and applies it to
 * WTheme.palette — mirrors the web `[data-theme]` switch. The whole app recolors
 * because composables read WTheme.* (a mutableStateOf-backed palette).
 */
object ThemePref {
    private val prefs by lazy {
        App.instance.getSharedPreferences("wordocious_prefs", Context.MODE_PRIVATE)
    }

    fun load() {
        WTheme.palette = Palettes.byKey(current())
        com.wordocious.app.ui.SeasonKit.applySurfaces(App.instance)
        WTheme.colorblind = SettingsPref.get(SettingsPref.COLORBLIND, false)
        WTheme.reducedMotionPref = SettingsPref.get(SettingsPref.REDUCED_MOTION, false)
        // Fold in the OS accessibility setting, like iOS does with
        // UIAccessibility.isReduceMotionEnabled. Users who disable animations
        // system-wide expect apps to obey without hunting for an in-app toggle.
        WTheme.osReducedMotion = runCatching {
            android.provider.Settings.Global.getFloat(
                App.instance.contentResolver,
                android.provider.Settings.Global.ANIMATOR_DURATION_SCALE,
                1f,
            ) == 0f
        }.getOrDefault(false)
        // FINISH_SPEC AD: Battery Saver calms ambient motion too (kept live by a receiver).
        com.wordocious.app.ui.theme.PowerSaveWatcher.start(App.instance)
    }

    fun set(key: String) {
        prefs.edit().putString("theme", key).apply()
        WTheme.palette = Palettes.byKey(key)
        com.wordocious.app.ui.SeasonKit.applySurfaces(App.instance)
    }

    fun current(): String = prefs.getString("theme", "light") ?: "light"

    /** Item 24: Settings > Theme row tap ("seasonal" or a registry id): the core rules, then a re-resolve of the season. */
    fun pick(picked: String) {
        val today = java.time.LocalDate.now().toString()
        val optOut = SettingsPref.get(com.wordocious.app.ui.SeasonSkins.OPT_OUT_KEY, "").ifBlank { null }
        val next = ThemeChoiceRules.pick(
            ThemeChoiceRules.Choice(ThemeChoiceRules.fromStored(current()), optOut),
            picked, com.wordocious.app.ui.SeasonSkins.calendarSeason(), today,
        )
        SettingsPref.set(com.wordocious.app.ui.SeasonSkins.OPT_OUT_KEY, next.seasonOptOut ?: "")
        set(ThemeChoiceRules.toStored(next.theme))
        com.wordocious.app.ui.SeasonSkins.bumpEpoch()
    }
}
