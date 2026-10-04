package com.wordocious.app

import android.app.Application
import kotlinx.coroutines.launch

/** Application subclass holding a static context for SharedPreferences access. */
class App : Application() {
    override fun onCreate() {
        super.onCreate()
        instance = this
        // FINISH_SPEC U: preload the 16-sound pack once + track the resumed activity for haptics.
        com.wordocious.app.data.Haptics.install(this)
        // Perf (2026-10-02): the SoundPool build + 16 file opens ran on the main thread
        // before the first frame; preload() is @Synchronized and idempotent, so a sound
        // played mid-load simply waits for it (nothing plays before the intro anyway).
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            com.wordocious.app.data.SoundManager.preload()
        }
        // Podium art + common avatar parts, decoded off main before Home / the Leaderboard paint them.
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            runCatching { com.wordocious.app.ui.PodiumArt.prewarm(this@App, resources.displayMetrics.density) }
            runCatching { com.wordocious.app.ui.MascotComposer.prewarm(this@App) }
            // FINISH_SPEC BJ15: cast button skins + art labels (decoded + pre-scaled before any button paints).
            runCatching { com.wordocious.app.ui.CastArt.prewarm(this@App, resources.displayMetrics.density) }
            // FINISH_SPEC BJ16: popup / sheet heading lettering, pre-scaled to its display size.
            runCatching { com.wordocious.app.ui.HeadingArtCache.prewarm(this@App, resources.displayMetrics.density) }
        }
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
        // FINISH_SPEC AL: refresh the widget on every launch (guests included) from today's
        // cached completions, so its solved / points / countdown chips are current.
        runCatching { com.wordocious.app.widget.WidgetBridge.update(com.wordocious.app.data.DailyCompletionsService.readCache()) }
    }

    companion object {
        lateinit var instance: App
            private set
    }
}
