package com.wordocious.app.data

import android.app.Activity
import com.google.android.play.core.review.ReviewManagerFactory

/**
 * Play Store in-app review, asked only at peak moments (a Flawless Victory
 * celebration) and self-throttled to once per 30 days on-device — mirrors
 * iOS RatingPrompt.swift. Google's own quota sits on top: launchReviewFlow
 * is a REQUEST and may silently show nothing, which is why it must ride a
 * moment of genuine delight rather than an app launch.
 */
object RatingPrompt {
    private const val LAST_ASKED_KEY = "rating-prompt-last-asked"
    private const val THROTTLE_MS = 30L * 86_400_000L

    fun maybeAsk(activity: Activity) {
        val now = System.currentTimeMillis()
        val last = SettingsPref.get(LAST_ASKED_KEY, "0").toLongOrNull() ?: 0L
        if (now - last <= THROTTLE_MS) return
        SettingsPref.set(LAST_ASKED_KEY, now.toString())
        val manager = ReviewManagerFactory.create(activity)
        manager.requestReviewFlow().addOnSuccessListener { info ->
            if (!activity.isFinishing) manager.launchReviewFlow(activity, info)
        }
        // On failure: nothing to show, and the throttle already advanced —
        // better to skip a month than to double-ask.
    }
}
