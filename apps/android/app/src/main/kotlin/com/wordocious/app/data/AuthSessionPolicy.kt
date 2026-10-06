package com.wordocious.app.data

/**
 * What a failed session refresh / restore means for the signed-in state (founder, 2026-10-03:
 * during a Supabase outage a late Daily Sweep popped AND the app showed the sign-in screen).
 *
 * The rule (iOS / Android / web parity): a refresh that fails because the network or the auth
 * server is unhealthy NEVER signs the user out. The cached session, user and profile stay, and
 * the refresh is retried later. Only an explicit invalid / revoked refresh token, or the user
 * signing out, ends the session.
 *
 * Pure (no Supabase types) so the decision is JVM-unit-tested: AuthSessionPolicyTest.
 */
object AuthSessionPolicy {
    enum class Outcome {
        /** Network / server trouble — keep everything, retry later. */
        TRANSIENT,
        /** The refresh token is invalid or revoked — the session is really over. */
        REVOKED,
        /** There is no stored session to refresh at all. */
        NO_SESSION,
    }

    /** GoTrue error codes that mean the refresh token / session can never work again. */
    val REVOKING_CODES = setOf(
        "refresh_token_not_found",
        "refresh_token_already_used",
        "session_not_found",
        "session_expired",
        "user_not_found",
        "user_banned",
    )

    /**
     * Classify one failed refresh.
     *
     * - [isSessionMissing]: nothing stored → [Outcome.NO_SESSION].
     * - A revoking GoTrue [errorCode] → [Outcome.REVOKED] (whatever the status).
     * - A 400 / 401 whose [message] says "Invalid Refresh Token" (older GoTrue, no code) → REVOKED.
     * - Everything else — a network error (timeout, IOException, unknown host, connect), a 5xx,
     *   a 429, a 408, an unknown status, any other 4xx without a revoking code (a proxy's 403) —
     *   is [Outcome.TRANSIENT]. Signing a player out over an error we can't prove is a
     *   revocation is the worse failure: they lose nothing by waiting for the next retry.
     */
    fun classify(
        errorCode: String?,
        httpStatus: Int?,
        isNetworkError: Boolean,
        isSessionMissing: Boolean,
        message: String? = null,
    ): Outcome {
        if (isSessionMissing) return Outcome.NO_SESSION
        val code = errorCode?.trim()?.lowercase()
        if (code != null && code in REVOKING_CODES) return Outcome.REVOKED
        if (isNetworkError || httpStatus == null) return Outcome.TRANSIENT
        if (httpStatus >= 500 || httpStatus == 429 || httpStatus == 408) return Outcome.TRANSIENT
        if ((httpStatus == 400 || httpStatus == 401) &&
            message?.contains("invalid refresh token", ignoreCase = true) == true
        ) return Outcome.REVOKED
        return Outcome.TRANSIENT
    }

    /** True when the player stays signed in (cached profile kept, no sign-in screen). */
    fun keepsUserSignedIn(outcome: Outcome, hasStoredSession: Boolean): Boolean =
        outcome == Outcome.TRANSIENT && hasStoredSession

    /** Retry backoff after the [attempt]-th consecutive transient failure (0-based):
     *  5 s, 15 s, 30 s, 60 s, then every 60 s. */
    fun retryDelaySeconds(attempt: Int): Int = RETRY_SECONDS.getOrElse(attempt.coerceAtLeast(0)) { 60 }

    private val RETRY_SECONDS = listOf(5, 15, 30, 60)

    // ── Guest mode across process / activity recreation (2026-10-05) ──

    /** Whether a cold start (or a recreated process) brings guest mode back: the player
     *  chose "Play without an account" and nothing signed in since. A device that last ran
     *  signed in restores that session instead; the guest flag never outranks it. */
    fun restoresGuest(storedGuestFlag: Boolean, hadSignedInSession: Boolean): Boolean =
        storedGuestFlag && !hadSignedInSession

    /** What a launch that ends with no signed-in session does with the on-device saves. */
    enum class SignedOutSaves {
        /** An owner is recorded — the normal claim (sign-in / enterGuest) decides later. */
        KEEP,
        /** A restored guest with no owner on record: the saves are the guest's — record
         *  "guest" as the owner and keep them. */
        CLAIM_FOR_GUEST,
        /** Nobody owns them (an upgrade from a build that wiped on sign-out) — discard once. */
        DISCARD,
    }

    /** 2026-10-05: the unattributed-save discard used to run on every signed-out launch with
     *  no owner recorded, guest or not — so a guest whose owner key was missing (prefs restored
     *  or seeded without it) lost today's finishes and boards on every cold start. A restored
     *  guest now claims them instead. Cross-account isolation is unchanged: the guest is its own
     *  owner, so the next account to sign in still wipes them (claimSavesFor). */
    /** claimSavesFor's rule: local saves are wiped only when they belonged to a DIFFERENT
     *  recorded owner ("guest" or a user id) — never on a first claim, never for the same owner. */
    fun ownerChangeWipesSaves(previousOwner: String, newOwner: String): Boolean =
        previousOwner.isNotEmpty() && previousOwner != newOwner

    fun savesOnSignedOutLaunch(recordedOwner: String, guestRestored: Boolean): SignedOutSaves = when {
        recordedOwner.isNotEmpty() -> SignedOutSaves.KEEP
        guestRestored -> SignedOutSaves.CLAIM_FOR_GUEST
        else -> SignedOutSaves.DISCARD
    }

    /** MainActivity's gate: the app shell (not the sign-in screen) is shown for a signed-in
     *  player, a guest, or while the last signed-in session is still restoring. */
    fun showsApp(isAuthenticated: Boolean, isGuest: Boolean, isLoading: Boolean, hadSession: Boolean): Boolean =
        isAuthenticated || isGuest || (isLoading && hadSession)
}
