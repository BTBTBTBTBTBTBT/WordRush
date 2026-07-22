package com.wordocious.app.data

import android.app.Activity
import android.content.Context
import com.google.android.play.core.review.ReviewManagerFactory
import kotlinx.coroutines.delay

/**
 * Play in-app review with deliberate timing (replaces ReviewPrompter):
 * only after a WIN once the player has 5+ lifetime wins, at most once every
 * 14 days, and once per app version — delayed ~2s so it never competes with
 * the confetti. NEVER on a loss or at launch. Play itself also quota-limits
 * the sheet: when it declines, launchReviewFlow shows no UI, which is fine.
 */
object RatingsPrompt {
    private const val PREFS = "ratings_prompt"
    private const val KEY_WINS = "win_count"
    private const val KEY_LAST_ASK_MS = "last_ask_ms"
    private const val MIN_WINS = 5
    private const val MIN_INTERVAL_MS = 14L * 24 * 60 * 60 * 1000 // 14 days

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Bump the lifetime win counter — call on every post-game WIN. */
    fun recordWin(context: Context) {
        val p = prefs(context)
        p.edit().putInt(KEY_WINS, p.getInt(KEY_WINS, 0) + 1).apply()
    }

    /**
     * Ask for a review when all gates pass: wins >= 5, >= 14 days since the
     * last ask, and not yet asked on this versionName. Call from the WIN path
     * only; suspends ~2s first so the celebration lands before the sheet.
     */
    suspend fun maybeAsk(activity: Activity) {
        val p = prefs(activity)
        if (p.getInt(KEY_WINS, 0) < MIN_WINS) return

        val now = System.currentTimeMillis()
        val lastAsk = p.getLong(KEY_LAST_ASK_MS, 0L)
        if (lastAsk != 0L && now - lastAsk < MIN_INTERVAL_MS) return

        val version = runCatching {
            activity.packageManager.getPackageInfo(activity.packageName, 0).versionName
        }.getOrNull() ?: "0"
        val versionKey = "asked-v$version"
        if (p.getBoolean(versionKey, false)) return

        // Mark BEFORE launching so a crash/quota-decline still consumes the ask.
        p.edit().putLong(KEY_LAST_ASK_MS, now).putBoolean(versionKey, true).apply()

        delay(2000) // let the win celebration land first
        runCatching {
            val manager = ReviewManagerFactory.create(activity)
            manager.requestReviewFlow().addOnSuccessListener { info ->
                manager.launchReviewFlow(activity, info)
            }
        }
    }
}
