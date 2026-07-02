package com.wordocious.app.data

import android.app.Activity
import android.content.Context
import com.google.android.play.core.review.ReviewManagerFactory
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Play in-app review with deliberate timing: only after a WIN while the player
 * is on a streak of 3+, at most once per version, delayed a beat so it never
 * competes with the confetti. Never on a loss or at launch. (Play itself also
 * quota-limits how often the sheet actually shows.)
 */
object ReviewPrompter {
    fun maybeAskAfterWin(context: Context) {
        val streak = AuthService.profile.value?.currentStreak ?: 0
        if (streak < 3) return
        val version = runCatching {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName
        }.getOrNull() ?: "0"
        val prefs = context.getSharedPreferences("review", Context.MODE_PRIVATE)
        val key = "asked-v$version"
        if (prefs.getBoolean(key, false)) return
        prefs.edit().putBoolean(key, true).apply()

        val activity = context as? Activity ?: return
        CoroutineScope(Dispatchers.Main).launch {
            delay(2500) // let the win celebration land first
            runCatching {
                val manager = ReviewManagerFactory.create(activity)
                manager.requestReviewFlow().addOnSuccessListener { info ->
                    manager.launchReviewFlow(activity, info)
                }
            }
        }
    }
}
