package com.wordocious.app

import android.app.Application

/** Application subclass holding a static context for SharedPreferences access. */
class App : Application() {
    override fun onCreate() {
        super.onCreate()
        instance = this
        // Storage hygiene + cross-midnight grace (iOS launch-sweep parity):
        // Android previously never swept per-seed daily saves, so they
        // accumulated forever.
        com.wordocious.app.data.GamePersistence.cleanupStaleDailyGames(todayLocalDate())
        // Cold starts always land on the DAILY surface (founder-approved UX,
        // iOS WordociousApp.init parity): the Pro Daily⇄Unlimited toggle is
        // deliberately NOT restored across launches — reopening in Unlimited
        // made a "Classic" tap silently miss the daily leaderboard. The pref
        // still carries the choice across screens WITHIN a session (HomeScreen
        // is disposed while a game shows), and an in-progress unlimited board
        // stays resumable via its save + "unlimited-current-*" marker.
        com.wordocious.app.data.SettingsPref.set("pref-play-mode", "daily")
    }

    companion object {
        lateinit var instance: App
            private set
    }
}
