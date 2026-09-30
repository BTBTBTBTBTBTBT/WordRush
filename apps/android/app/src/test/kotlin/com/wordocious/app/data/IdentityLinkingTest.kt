package com.wordocious.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Settings › Linked sign-ins helpers (founder, 2026-09-30; web identity-linking.test.ts parity). */
class IdentityLinkingTest {
    @Test fun readsGoTrueErrorFromQueryOrFragment() {
        val q = IdentityLinking.readRedirectError(
            "wordocious://auth-callback?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user",
        )
        assertEquals("identity_already_exists", q?.code)
        assertEquals("Identity is already linked to another user", q?.description)
        val h = IdentityLinking.readRedirectError("wordocious://auth-callback#error=access_denied&error_description=User%20cancelled")
        assertEquals("access_denied", h?.code)
        assertNull(IdentityLinking.readRedirectError("wordocious://auth-callback#access_token=abc&refresh_token=def"))
        assertNull(IdentityLinking.readRedirectError("wordocious://auth-callback?code=123"))
    }

    @Test fun alreadyUsedMessageNamesTheProvider() {
        assertEquals(
            "That Google account is already used by another Wordocious account. Sign in with it and delete that account in Settings, then link it here.",
            IdentityLinking.linkErrorMessage("identity_already_exists", "", "google"),
        )
        assertTrue(IdentityLinking.linkErrorMessage("", "Identity is already linked to another user", "apple").startsWith("That Apple ID is already used"))
        assertEquals("Google linking was canceled.", IdentityLinking.linkErrorMessage("access_denied", "", "google"))
    }

    @Test fun neverUnlinksTheLastSignIn() {
        assertFalse(IdentityLinking.canUnlink(1))
        assertTrue(IdentityLinking.canUnlink(2))
        assertEquals("This is your only way to sign in, so it can’t be removed.", IdentityLinking.unlinkErrorMessage("single_identity_not_deletable", "x"))
    }

    @Test fun labelsAndHideMyEmail() {
        assertEquals("Google", IdentityLinking.providerLabel("google"))
        assertEquals("Email", IdentityLinking.providerLabel("email"))
        assertTrue(IdentityLinking.isHideMyEmail("abc123@privaterelay.appleid.com"))
        assertFalse(IdentityLinking.isHideMyEmail("bt@example.com"))
    }
}
