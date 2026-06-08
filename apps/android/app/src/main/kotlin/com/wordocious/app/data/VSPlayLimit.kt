package com.wordocious.app.data

import android.content.Context
import com.wordocious.app.App
import com.wordocious.app.todayLocalDate

/**
 * SharedPreferences-backed daily-VS play limit — the Android equivalent of the
 * web play-limit-service / iOS VSPlayLimit. Keyed by local day; the freemium
 * daily VS gate (free + DUEL only) bites once the free match is used today.
 */
object VSPlayLimit {
    private const val KEY = "vs_daily_played_on"
    private val prefs by lazy { App.instance.getSharedPreferences("wordocious_vs", Context.MODE_PRIVATE) }

    fun hasPlayedToday(): Boolean = prefs.getString(KEY, null) == todayLocalDate()
    fun markPlayedToday() { prefs.edit().putString(KEY, todayLocalDate()).apply() }
}
