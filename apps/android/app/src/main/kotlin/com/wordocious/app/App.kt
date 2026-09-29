package com.wordocious.app

import android.app.Application
import kotlinx.coroutines.launch

/** Application subclass holding a static context for SharedPreferences access. */
class App : Application() {
    override fun onCreate() {
        super.onCreate()
        instance = this
        // Storage hygiene + cross-midnight grace (iOS launch-sweep parity):
        // Android previously never swept per-seed daily saves, so they
        // accumulated forever.
        // Off the main thread (founder, 2026-09-29): each sweep loads a whole prefs file, and
        // Unlimited saves (never deleted before) made those files grow without bound.
        val today = todayLocalDate()
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            com.wordocious.app.data.GamePersistence.cleanupStaleDailyGames(today)
            com.wordocious.app.data.GamePersistence.cleanupStaleUnlimitedGames()
            com.wordocious.app.data.GamePersistence.cleanupStaleMoreGamesSaves()
        }
        // Cold starts always land on the DAILY surface (founder-approved UX,
        // iOS WordociousApp.init parity): the Pro Daily⇄Unlimited toggle is
        // deliberately NOT restored across launches — reopening in Unlimited
        // made a "Classic" tap silently miss the daily leaderboard. The pref
        // still carries the choice across screens WITHIN a session, and an
        // in-progress unlimited board
        // stays resumable via its save + "unlimited-current-*" marker.
        com.wordocious.app.data.SettingsPref.set("pref-play-mode", "daily")
    }

    companion object {
        lateinit var instance: App
            private set
    }
}
