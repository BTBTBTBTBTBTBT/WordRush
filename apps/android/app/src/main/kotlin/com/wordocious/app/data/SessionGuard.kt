package com.wordocious.app.data

import io.github.jan.supabase.auth.SessionManager
import io.github.jan.supabase.auth.SettingsSessionManager
import io.github.jan.supabase.auth.user.UserSession
import java.util.concurrent.atomic.AtomicInteger

/**
 * The stored Supabase session, guarded against the library wiping it on its own.
 *
 * supabase-kt 3.0.2's auto-refresh (AuthImpl.tryImportingSession) keeps the session and retries
 * on a network error or a 5xx, but treats EVERY other HTTP error as a revocation and calls
 * clearSession(), which deletes the stored session: a 429 (rate limit), a 408, a proxy's 403 —
 * the player is signed out and their next launch shows the sign-in screen. So deletes only go
 * through while [AuthService] has allowed them: an explicit sign-out, or a refresh failure
 * that [AuthSessionPolicy] classified as REVOKED. Anything else keeps the session on disk, and
 * AuthService re-tries it (see AuthService.runRecoveryProbe).
 *
 * Same storage as the library's default (SettingsSessionManager with its default key), so
 * existing sessions survive the upgrade.
 */
object SessionGuard : SessionManager {
    private val delegate by lazy { SettingsSessionManager() }
    private val allowance = AtomicInteger(0)

    override suspend fun saveSession(session: UserSession) = delegate.saveSession(session)

    override suspend fun loadSession(): UserSession? = delegate.loadSession()

    override suspend fun deleteSession() {
        // Not allowed: the library decided on its own (see above). Keep it.
        if (allowance.get() > 0) delegate.deleteSession()
    }

    /** Runs [block] with deletes allowed (sign-out, a confirmed revocation). */
    suspend fun <T> allowingDelete(block: suspend () -> T): T {
        allowance.incrementAndGet()
        try {
            return block()
        } finally {
            allowance.decrementAndGet()
        }
    }
}
