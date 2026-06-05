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
    }

    fun set(key: String) {
        prefs.edit().putString("theme", key).apply()
        WTheme.palette = Palettes.byKey(key)
    }

    fun current(): String = prefs.getString("theme", "light") ?: "light"
}
