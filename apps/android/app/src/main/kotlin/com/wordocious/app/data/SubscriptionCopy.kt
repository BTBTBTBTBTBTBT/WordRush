package com.wordocious.app.data

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * FINISH_SPEC BJ11 (founder 10-03: "When I clicked check subscription somewhere the Apple
 * menu popped up"): every hand-off to a billing page we don't draw — Google Play's (or
 * Apple's) subscription settings, Stripe's billing page — is announced first, in our
 * look, saying what opens. Plus the lapsed-Pro line a former member sees ("Your Pro
 * ended Sep 30, 2026"). Pure copy (SubscriptionCopyTest); iOS parity
 * Sources/Core/SubscriptionCopy.swift, web lib/payment/subscription-copy.ts.
 */
object SubscriptionCopy {
    enum class Store { APPLE, GOOGLE, STRIPE }

    data class Handoff(val title: String, val line: String, val body: String, val cta: String)

    fun handoff(store: Store): Handoff = when (store) {
        Store.APPLE -> Handoff(
            "Manage on the App Store",
            "Opens your Apple subscription settings",
            "Apple handles Pro billing for iPhone and iPad, so changing plans or canceling happens in your Apple subscription settings. Your Pro stays tied to your Wordocious account.",
            "Open Apple subscriptions",
        )
        Store.GOOGLE -> Handoff(
            "Manage on Google Play",
            "Opens your Google Play subscriptions",
            "Google Play handles Pro billing on Android, so changing plans or canceling happens in your Play subscriptions. Your Pro stays tied to your Wordocious account.",
            "Open Play subscriptions",
        )
        Store.STRIPE -> Handoff(
            "Manage web billing",
            "Opens Stripe's secure billing page",
            "Pro bought on wordocious.com is billed by Stripe. Update your card, switch plans or cancel on Stripe's secure page, then come right back.",
            "Open billing",
        )
    }

    /** The Google Play auto-renew disclosure with the live Play prices. */
    fun playDisclosure(monthly: String, yearly: String): String =
        "Monthly ($monthly) and Yearly ($yearly) are auto-renewing subscriptions billed through Google Play. " +
            "Payment is charged to your Google account at confirmation. Subscriptions renew automatically unless " +
            "canceled at least 24 hours before the period ends; manage or cancel in Google Play › Subscriptions. " +
            "The Day Pass is a one-time 24-hour purchase and does not renew."

    /**
     * "Your Pro ended Sep 30, 2026" for a former member: the Pro window ([expiresAt],
     * profiles.pro_expires_at) is in the past and Pro isn't active. Null for players who
     * never had Pro, active members, or a missing / unreadable expiry.
     */
    fun lapsedLine(expiresAt: String?, proActive: Boolean, now: Instant = Instant.now(), zone: ZoneId = ZoneId.systemDefault()): String? {
        if (proActive) return null
        val end = com.wordocious.app.ui.ProIdentityText.parseInstant(expiresAt) ?: return null
        if (!end.isBefore(now)) return null
        return "Your Pro ended " + DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US).format(end.atZone(zone))
    }

    /** The lapsed card's second line. */
    const val LAPSED_BODY = "Everything you earned is still here. Pick a plan to switch Pro back on."
}
