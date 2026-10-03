package com.wordocious.app.data

/**
 * FINISH_SPEC AP "Welcome to Pro": the pure rules behind the one-time welcome screen
 * (no Android types, unit-tested in ProWelcomeRulesTest). The screen itself and its
 * runtime state live in ui/ProWelcome.kt.
 */

/** How a player just became Pro. */
enum class ProActivation {
    /** A Play Billing purchase the player just made (never a restore / launch reconcile). */
    PURCHASE,
    /** A friend's gifted week (referral redemption). */
    GIFT,
}

object ProWelcomeRules {
    /** The per-account "already welcomed" flag in SettingsPref: `pro-welcomed:<userId>`. */
    const val FLAG = "pro-welcomed"

    fun flagKey(userId: String): String = "$FLAG:$userId"

    /** The gap between two benefit cards popping in. */
    const val CARD_STAGGER_MS = 70L

    /**
     * Whether a Pro activation earns the welcome. Shown ONCE per account, and only when
     * the player is actually joining:
     * - [signedIn]: Pro is account-based (no account, nothing to welcome).
     * - [alreadyWelcomed]: the `pro-welcomed` flag — never twice.
     * - [wasProActive]: Pro was already live before this activation (a Day Pass stacked
     *   on a live plan, a plan bought while gifted days run) — that is not joining.
     * - [isNewPurchase]: a purchase must be a fresh purchase action; restores and the
     *   launch reconcile re-deliver existing purchases and never welcome. A gift has no
     *   purchase, so it only needs its first activation.
     */
    fun shouldWelcome(
        source: ProActivation,
        isNewPurchase: Boolean,
        alreadyWelcomed: Boolean,
        wasProActive: Boolean,
        signedIn: Boolean,
    ): Boolean {
        if (!signedIn || alreadyWelcomed || wasProActive) return false
        return when (source) {
            ProActivation.PURCHASE -> isNewPurchase
            ProActivation.GIFT -> true
        }
    }

    /** A gifted week's welcome window: redeemed within the gift week (+1 day of slack). */
    const val GIFT_WELCOME_DAYS = 8L

    /**
     * The gifted week's server marker (GET /api/pro/gift → the caller's redeemed referral,
     * web lib/pro-welcome giftWelcomeDue): due when it was redeemed within [GIFT_WELCOME_DAYS].
     */
    fun giftWelcomeDue(redeemedAtMs: Long?, nowMs: Long): Boolean {
        if (redeemedAtMs == null) return false
        return redeemedAtMs <= nowMs + 60_000 && nowMs - redeemedAtMs < GIFT_WELCOME_DAYS * 86_400_000L
    }

    /** Pro that ends at most ~8 days out: the shape of a gifted week (worth asking the server). */
    fun giftShaped(expiresAtMs: Long?, nowMs: Long): Boolean =
        expiresAtMs != null && expiresAtMs > nowMs && expiresAtMs - nowMs <= (GIFT_WELCOME_DAYS * 86_400_000L + 3_600_000L)

    /** The headline: the gift week reads as a gift. */
    fun headline(source: ProActivation): String = when (source) {
        ProActivation.PURCHASE -> "WELCOME TO PRO!"
        ProActivation.GIFT -> "YOUR FREE WEEK OF PRO!"
    }

    /** The thanks line under the headline ([name] = the username; blank → no name). */
    fun thanksLine(name: String?): String {
        val n = name?.trim().orEmpty()
        val who = if (n.isEmpty()) "" else ", $n"
        return "Thanks for joining$who! Here's everything you just unlocked."
    }

    /**
     * Shields credited at activation, or null when none can be shown: the chip only
     * appears when the profile's shield count went UP from the count captured just
     * before the activation (the +4 per period is granted server-side by the Play
     * webhook, so the client can't know it any other way; a Day Pass credits none).
     */
    fun shieldsCredited(before: Int?, now: Int?): Int? {
        if (before == null || now == null) return null
        val delta = now - before
        return if (delta > 0) delta else null
    }

    /** The shield chip's words for [count] credited shields. */
    fun shieldChip(count: Int): String =
        if (count == 1) "Your streak shield is ready" else "Your $count streak shields are ready"

    /** When benefit card [index] (0-based) starts popping in, after the cards' [baseMs]. */
    fun cardDelayMs(index: Int, baseMs: Long = 0L): Long = baseMs + index.coerceAtLeast(0) * CARD_STAGGER_MS
}
