package com.wordocious.app.data

import com.wordocious.app.data.AuthSessionPolicy.restoresGuest
import com.wordocious.app.data.AuthSessionPolicy.showsApp
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 2026-10-05: a guest ("Play without an account") was dropped back on the sign-in screen
 * whenever the process was rebuilt (a configuration change that restarted the app, Android
 * reclaiming it in the background, an update), because guest mode lived only in memory.
 * It is now persisted and restored on start; these pin the restore rule and the gate.
 */
class GuestPersistenceTest {

    @Test fun `a stored guest choice comes back on a fresh process`() {
        assertTrue(restoresGuest(storedGuestFlag = true, hadSignedInSession = false))
    }

    @Test fun `no stored guest choice means the sign-in screen`() {
        assertFalse(restoresGuest(storedGuestFlag = false, hadSignedInSession = false))
    }

    @Test fun `a signed-in session outranks a stale guest flag`() {
        assertFalse(restoresGuest(storedGuestFlag = true, hadSignedInSession = true))
    }

    @Test fun `a restored guest reaches the app shell before auth finishes loading`() {
        // Cold start: auth still loading, no previous session, guest restored synchronously.
        assertTrue(showsApp(isAuthenticated = false, isGuest = true, isLoading = true, hadSession = false))
        // ...and after it finishes with no session.
        assertTrue(showsApp(isAuthenticated = false, isGuest = true, isLoading = false, hadSession = false))
    }

    @Test fun `a signed-out non-guest sees the sign-in screen`() {
        assertFalse(showsApp(isAuthenticated = false, isGuest = false, isLoading = false, hadSession = false))
        // While loading with no previous session the gate shows the loader, not the shell.
        assertFalse(showsApp(isAuthenticated = false, isGuest = false, isLoading = true, hadSession = false))
    }

    @Test fun `a returning signed-in player paints the shell while the session restores`() {
        assertTrue(showsApp(isAuthenticated = false, isGuest = false, isLoading = true, hadSession = true))
        assertTrue(showsApp(isAuthenticated = true, isGuest = false, isLoading = false, hadSession = true))
    }
}
