package com.wordocious.app.data

import com.wordocious.app.data.AuthSessionPolicy.Outcome
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * A failed session refresh signs the player out ONLY on an explicit invalid / revoked refresh
 * token. Network and server trouble (the 2026-10-03 Supabase outage) keeps them signed in.
 */
class AuthSessionPolicyTest {

    private fun keeps(outcome: Outcome) = AuthSessionPolicy.keepsUserSignedIn(outcome, hasStoredSession = true)

    @Test fun `a transient refresh error keeps the user signed in`() {
        // Timeout / socket / unknown host: no status at all.
        val timeout = AuthSessionPolicy.classify(null, null, isNetworkError = true, isSessionMissing = false)
        assertEquals(Outcome.TRANSIENT, timeout)
        assertTrue(keeps(timeout))
        // Auth server 5xx (the outage: "connection to database not available").
        for (status in listOf(500, 502, 503, 504)) {
            val o = AuthSessionPolicy.classify(null, status, isNetworkError = false, isSessionMissing = false)
            assertEquals("HTTP $status", Outcome.TRANSIENT, o)
            assertTrue(keeps(o))
        }
        // Auth server unreachable, reported with an unexpected_failure code.
        val unreachable = AuthSessionPolicy.classify("unexpected_failure", 503, isNetworkError = false, isSessionMissing = false)
        assertTrue(keeps(unreachable))
    }

    @Test fun `rate limits, request timeouts and unknown failures are transient`() {
        assertEquals(Outcome.TRANSIENT, AuthSessionPolicy.classify("over_request_rate_limit", 429, false, false))
        assertEquals(Outcome.TRANSIENT, AuthSessionPolicy.classify(null, 408, false, false))
        assertEquals(Outcome.TRANSIENT, AuthSessionPolicy.classify(null, null, false, false))
        // A proxy's 403 without a revoking code is not proof of a revocation.
        assertEquals(Outcome.TRANSIENT, AuthSessionPolicy.classify(null, 403, false, false, "Forbidden"))
        // A plain 400 that doesn't say the token is invalid.
        assertEquals(Outcome.TRANSIENT, AuthSessionPolicy.classify("validation_failed", 400, false, false))
    }

    @Test fun `a revoked refresh token signs out`() {
        for (code in AuthSessionPolicy.REVOKING_CODES) {
            val o = AuthSessionPolicy.classify(code, 400, isNetworkError = false, isSessionMissing = false)
            assertEquals(code, Outcome.REVOKED, o)
            assertFalse(code, keeps(o))
        }
        // Case / whitespace tolerant, and the code wins even on a 403 / 404.
        assertEquals(Outcome.REVOKED, AuthSessionPolicy.classify(" Refresh_Token_Not_Found ", 403, false, false))
        assertEquals(Outcome.REVOKED, AuthSessionPolicy.classify("user_not_found", 404, false, false))
        assertEquals(Outcome.REVOKED, AuthSessionPolicy.classify("user_banned", 403, false, false))
    }

    @Test fun `an Invalid Refresh Token 400 or 401 without a code signs out`() {
        assertEquals(
            Outcome.REVOKED,
            AuthSessionPolicy.classify(null, 400, false, false, "Invalid Refresh Token: Refresh Token Not Found"),
        )
        assertEquals(
            Outcome.REVOKED,
            AuthSessionPolicy.classify("invalid_grant", 401, false, false, "invalid refresh token: already used"),
        )
        // The same message on a 5xx is still the server's problem.
        assertEquals(Outcome.TRANSIENT, AuthSessionPolicy.classify(null, 500, false, false, "Invalid Refresh Token"))
    }

    @Test fun `no stored session is not signed in`() {
        val o = AuthSessionPolicy.classify(null, null, isNetworkError = true, isSessionMissing = true)
        assertEquals(Outcome.NO_SESSION, o)
        assertFalse(AuthSessionPolicy.keepsUserSignedIn(o, hasStoredSession = false))
        // Even a transient failure needs a session to keep.
        assertFalse(AuthSessionPolicy.keepsUserSignedIn(Outcome.TRANSIENT, hasStoredSession = false))
    }

    @Test fun `retry backoff is 5, 15, 30, 60 then every 60 seconds`() {
        assertEquals(listOf(5, 15, 30, 60, 60, 60), (0..5).map { AuthSessionPolicy.retryDelaySeconds(it) })
        assertEquals(5, AuthSessionPolicy.retryDelaySeconds(-1))
        assertEquals(60, AuthSessionPolicy.retryDelaySeconds(100))
    }
}
