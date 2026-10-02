package com.wordocious.app.data

import android.app.Activity

/**
 * Legacy entry point kept so old call sites compile. FINISH_SPEC AI moved the review ask
 * to ONE path, [StoreReview] (Flawless / Daily Sweep / 7-day streak milestone, after the
 * celebration finishes, 3-day + 120-day gates). The Flawless ask now fires when the
 * SweepCelebration closes, so this is a no-op (it used to fire 3 s into the celebration).
 */
object RatingPrompt {
    @Suppress("UNUSED_PARAMETER")
    fun maybeAsk(activity: Activity) { /* see StoreReview */ }
}
