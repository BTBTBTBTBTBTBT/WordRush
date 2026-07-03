package com.wordocious.app.data

import android.content.Context
import com.wordocious.app.App

/**
 * Persists the Settings toggles (sound, daily reminder, colorblind, reduced
 * motion) — mirrors the iOS @AppStorage keys (pref-sound, pref-daily-reminder,
 * pref-colorblind, pref-reduced-motion).
 */
object SettingsPref {
    private val prefs by lazy {
        App.instance.getSharedPreferences("wordocious_prefs", Context.MODE_PRIVATE)
    }

    fun get(key: String, default: Boolean): Boolean = prefs.getBoolean(key, default)
    fun set(key: String, value: Boolean) = prefs.edit().putBoolean(key, value).apply()

    fun get(key: String, default: String): String = prefs.getString(key, default) ?: default
    fun set(key: String, value: String) = prefs.edit().putString(key, value).apply()

    fun get(key: String, default: Int): Int = prefs.getInt(key, default)
    fun set(key: String, value: Int) = prefs.edit().putInt(key, value).apply()

    const val SOUND = "pref-sound"
    const val DAILY_REMINDER = "pref-daily-reminder"
    const val COLORBLIND = "pref-colorblind"
    const val REDUCED_MOTION = "pref-reduced-motion"
}
