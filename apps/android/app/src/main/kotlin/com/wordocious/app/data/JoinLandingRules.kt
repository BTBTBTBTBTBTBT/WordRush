package com.wordocious.app.data

/**
 * The referral / gift-a-week invite landing (wordocious.com/join/<CODE>; web app/join/[code]).
 * Pure rules, unit-tested in JoinLandingRulesTest; the screen is ui/JoinLanding.kt.
 */
object JoinLandingRules {
    /** SettingsPref key: the invite code waiting to be redeemed (survives a sign-up / relaunch). */
    const val PENDING_KEY = "pending-referral-code"

    private val CODE = Regex("^[A-Z2-9]{4,16}$")

    /** The code from a link path segment, upper-cased, or null when it isn't a referral code. */
    fun normalize(raw: String?): String? = raw?.trim()?.uppercase()?.takeIf { CODE.matches(it) }

    enum class Status { LOADING, READY, USED, EXPIRED, NOT_FOUND }

    /** GET /api/referrals/lookup's `status` → the landing state. */
    fun status(api: String?): Status = when (api) {
        "ok" -> Status.READY
        "used" -> Status.USED
        "expired" -> Status.EXPIRED
        else -> Status.NOT_FOUND
    }

    /** The headline for a ready invite. */
    fun headline(inviter: String?): String =
        inviter?.trim()?.takeIf { it.isNotEmpty() }?.let { "$it sent you a week of Pro!" } ?: "A week of Pro, on a friend!"

    /** Whether a redeem reply's reason means the code is spent for good (stop retrying it). */
    fun isFinal(reason: String?): Boolean = reason != null && reason != "network"
}
