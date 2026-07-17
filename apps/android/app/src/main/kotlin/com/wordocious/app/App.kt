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
    }

    companion object {
        lateinit var instance: App
            private set
    }
}
