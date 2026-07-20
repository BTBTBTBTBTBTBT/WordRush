package com.wordocious.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.Instant

/**
 * Guards the Pro-expiry timestamp parse. The shipped bug: `Instant.parse`
 * rejects PostgREST's offset format (2026-…+00:00), threw, and the catch
 * returned "active" — so every Android Pro row stayed Pro forever and ads
 * never reappeared. parseTimestamp must accept BOTH the offset form (what the
 * server returns) and the …Z form (what the client writes), and fail CLOSED
 * (null) on garbage.
 */
class ProExpiryParseTest {

    @Test
    fun accepts_postgrest_offset_format() {
        val expected = Instant.parse("2026-08-19T12:00:00Z")
        assertEquals(expected, AuthService.parseTimestamp("2026-08-19T12:00:00+00:00"))
        // With microseconds, as timestamptz commonly returns.
        assertEquals(
            Instant.parse("2026-08-19T12:00:00.123456Z"),
            AuthService.parseTimestamp("2026-08-19T12:00:00.123456+00:00"),
        )
        // A non-zero offset resolves to the same instant.
        assertEquals(expected, AuthService.parseTimestamp("2026-08-19T07:00:00-05:00"))
    }

    @Test
    fun accepts_zulu_format_the_client_writes() {
        assertEquals(
            Instant.parse("2026-08-19T12:00:00Z"),
            AuthService.parseTimestamp("2026-08-19T12:00:00Z"),
        )
    }

    @Test
    fun fails_closed_on_garbage() {
        assertNull(AuthService.parseTimestamp("not a date"))
        assertNull(AuthService.parseTimestamp(""))
        assertNull(AuthService.parseTimestamp("2026-13-40T99:99:99Z"))
    }
}
