package com.wordocious.app.data

import android.app.Activity
import android.content.Context
import com.google.android.play.core.review.ReviewManagerFactory

/**
 * FINISH_SPEC AI: the pure eligibility rule for the store review ask. No Android types,
 * so it runs on the JVM ([StoreReviewGateTest]).
 *
 * Ask only at a happy moment (a Flawless, a Daily Sweep, a 7-day streak milestone),
 * never in the first 3 days of play, at most once per 120 days, never after a loss.
 */
object ReviewGate {
    const val MIN_DAYS_OF_PLAY = 3
    const val COOLDOWN_DAYS = 120
    const val STREAK_MILESTONE_EVERY = 7
    private const val DAY_MS = 86_400_000L

    /**
     * @param firstPlayMs when this player first played (null = unknown → not yet eligible).
     * @param lastAskMs the last time we asked (null = never).
     * @param lastResultWasLoss the most recent recorded game was a loss.
     */
    fun isEligible(nowMs: Long, firstPlayMs: Long?, lastAskMs: Long?, lastResultWasLoss: Boolean): Boolean {
        if (lastResultWasLoss) return false
        if (firstPlayMs == null || firstPlayMs <= 0L) return false
        if (nowMs - firstPlayMs < MIN_DAYS_OF_PLAY * DAY_MS) return false
        if (lastAskMs != null && lastAskMs > 0L && nowMs - lastAskMs < COOLDOWN_DAYS * DAY_MS) return false
        return true
    }

    /** The 7-day streak milestones (7, 14, 21 …): the same cadence that earns a shield. */
    fun isStreakMilestone(streak: Int): Boolean = streak >= STREAK_MILESTONE_EVERY && streak % STREAK_MILESTONE_EVERY == 0

    /** First-play stamp: the earliest known of the local stamp and the account's creation. */
    fun firstPlay(localStampMs: Long?, accountCreatedMs: Long?): Long? =
        listOfNotNull(localStampMs?.takeIf { it > 0 }, accountCreatedMs?.takeIf { it > 0 }).minOrNull()
}

/**
 * The ONE Play In-App Review path (replaces the old RatingPrompt / RatingsPrompt gates,
 * which now forward here). Called right after a celebration finishes (the Daily Sweep /
 * Flawless overlay closes; Home is back after a 7-day streak milestone). No custom
 * "do you like us?" pre-prompt: Google policy forbids gating, so we just call the system
 * sheet, which Play itself may also quietly decline (its own quota).
 */
object StoreReview {
    enum class Moment { FLAWLESS, DAILY_SWEEP, STREAK_MILESTONE }

    private const val K_FIRST_PLAY = "store-review-first-play-ms"
    private const val K_LAST_ASK = "store-review-last-ask-ms"
    private const val K_LAST_LOSS = "store-review-last-result-loss"
    private const val K_PENDING_STREAK = "store-review-pending-streak"
    // Legacy gates' stamps, honored so an ask made by an older build counts toward the cooldown.
    private const val LEGACY_RATING_PROMPT_KEY = "rating-prompt-last-asked"
    private const val LEGACY_RATINGS_PREFS = "ratings_prompt"
    private const val LEGACY_RATINGS_LAST_ASK = "last_ask_ms"

    private fun getLong(key: String): Long? = SettingsPref.get(key, "").toLongOrNull()

    /** Record a finished game (win or loss): stamps first play, remembers whether it was a loss. */
    fun notePlayed(won: Boolean) {
        runCatching {
            if (getLong(K_FIRST_PLAY) == null) SettingsPref.set(K_FIRST_PLAY, System.currentTimeMillis().toString())
            SettingsPref.set(K_LAST_LOSS, !won)
        }
    }

    /** A won game moved the daily streak onto a 7-day milestone: ask once Home is back. */
    fun noteStreak(streak: Int, won: Boolean) {
        if (won && ReviewGate.isStreakMilestone(streak)) runCatching { SettingsPref.set(K_PENDING_STREAK, true) }
    }

    /** Consumes the pending streak-milestone moment (true once). */
    fun takePendingStreakMilestone(): Boolean = runCatching {
        val pending = SettingsPref.get(K_PENDING_STREAK, false)
        if (pending) SettingsPref.set(K_PENDING_STREAK, false)
        pending
    }.getOrDefault(false)

    private fun lastAskMs(context: Context): Long? {
        val legacy = runCatching {
            context.getSharedPreferences(LEGACY_RATINGS_PREFS, Context.MODE_PRIVATE).getLong(LEGACY_RATINGS_LAST_ASK, 0L)
        }.getOrDefault(0L)
        return listOfNotNull(getLong(K_LAST_ASK), getLong(LEGACY_RATING_PROMPT_KEY), legacy.takeIf { it > 0 }).maxOrNull()
    }

    private fun accountCreatedMs(): Long? = AuthService.profile.value?.createdAt?.let { s ->
        runCatching { java.time.OffsetDateTime.parse(s).toInstant().toEpochMilli() }.getOrNull()
            ?: runCatching { java.time.Instant.parse(s).toEpochMilli() }.getOrNull()
    }

    /** Ask for a review if [ReviewGate] allows it. Call when the celebration has finished. */
    @Suppress("UNUSED_PARAMETER")
    fun maybeAsk(activity: Activity, moment: Moment) {
        val now = System.currentTimeMillis()
        val ok = runCatching {
            ReviewGate.isEligible(
                nowMs = now,
                firstPlayMs = ReviewGate.firstPlay(getLong(K_FIRST_PLAY), accountCreatedMs()),
                lastAskMs = lastAskMs(activity),
                lastResultWasLoss = SettingsPref.get(K_LAST_LOSS, false),
            )
        }.getOrDefault(false)
        if (!ok || activity.isFinishing) return
        // Stamp BEFORE launching: a quota decline or crash still consumes the ask.
        SettingsPref.set(K_LAST_ASK, now.toString())
        runCatching {
            val manager = ReviewManagerFactory.create(activity)
            manager.requestReviewFlow().addOnSuccessListener { info ->
                if (!activity.isFinishing) manager.launchReviewFlow(activity, info)
            }
        }
    }
}
