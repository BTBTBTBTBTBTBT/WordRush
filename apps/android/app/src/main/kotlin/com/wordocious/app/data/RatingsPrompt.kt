package com.wordocious.app.data

import android.app.Activity
import android.content.Context

/**
 * Legacy win-path hooks, kept so the game screens' call sites keep working. FINISH_SPEC AI:
 * an ordinary win is no longer a review moment; the ONE review path is [StoreReview]
 * (Flawless / Daily Sweep / 7-day streak milestone). [recordWin] still feeds it (first-play
 * stamp, last result = win); [maybeAsk] no longer asks.
 */
object RatingsPrompt {
    /** Call on every post-game WIN. */
    @Suppress("UNUSED_PARAMETER")
    fun recordWin(context: Context) = StoreReview.notePlayed(won = true)

    /** No-op: plain wins don't ask any more (see [StoreReview]). */
    @Suppress("UNUSED_PARAMETER", "RedundantSuspendModifier")
    suspend fun maybeAsk(activity: Activity) { }
}
