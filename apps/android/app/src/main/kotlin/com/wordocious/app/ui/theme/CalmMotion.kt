package com.wordocious.app.ui.theme

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.PowerManager
import androidx.core.content.ContextCompat

/**
 * FINISH_SPEC AD (older phones): Battery Saver and Reduce Motion both calm the app —
 * no light rays, no continuous bobbing, no living-cast idle moves, half the confetti.
 * One-shot springs stay. Pure (unit-tested); [WTheme.calmMotion] reads it.
 */
object CalmMotion {
    /** Calm when either Reduce Motion (in-app or system) or Battery Saver is on. */
    fun calm(reducedMotion: Boolean, powerSave: Boolean): Boolean = reducedMotion || powerSave

    /** A confetti burst's piece count: half (rounded up, at least 1) when [calm]. */
    fun confettiCount(count: Int, calm: Boolean): Int =
        if (!calm || count <= 0) count.coerceAtLeast(0) else ((count + 1) / 2).coerceAtLeast(1)
}

/**
 * Keeps [WTheme.powerSave] in step with the OS Battery Saver: samples it once, then
 * listens for ACTION_POWER_SAVE_MODE_CHANGED on the application context (registered
 * once per process; a protected system broadcast, so NOT_EXPORTED still receives it).
 */
object PowerSaveWatcher {
    @Volatile private var registered = false

    fun start(context: Context) {
        val app = context.applicationContext
        sample(app)
        if (registered) return
        registered = true
        runCatching {
            ContextCompat.registerReceiver(
                app,
                object : BroadcastReceiver() {
                    override fun onReceive(c: Context, intent: Intent) = sample(c)
                },
                IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED),
                ContextCompat.RECEIVER_NOT_EXPORTED,
            )
        }.onFailure { registered = false }
    }

    private fun sample(context: Context) {
        val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        WTheme.powerSave = runCatching { pm?.isPowerSaveMode == true }.getOrDefault(false)
    }
}
