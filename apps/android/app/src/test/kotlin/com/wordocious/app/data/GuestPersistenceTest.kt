package com.wordocious.app.data

import com.wordocious.app.data.AuthSessionPolicy.SignedOutSaves
import com.wordocious.app.data.AuthSessionPolicy.ownerChangeWipesSaves
import com.wordocious.app.data.AuthSessionPolicy.restoresGuest
import com.wordocious.app.data.AuthSessionPolicy.savesOnSignedOutLaunch
import com.wordocious.app.data.AuthSessionPolicy.showsApp
import org.junit.Assert.assertEquals
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

    // ── Save ownership across a cold start (2026-10-05) ──

    @Test fun `a restored guest keeps its saves on a cold start`() {
        assertEquals(SignedOutSaves.KEEP, savesOnSignedOutLaunch(recordedOwner = "guest", guestRestored = true))
    }

    @Test fun `a restored guest with no owner on record claims its saves instead of discarding them`() {
        assertEquals(SignedOutSaves.CLAIM_FOR_GUEST, savesOnSignedOutLaunch(recordedOwner = "", guestRestored = true))
    }

    @Test fun `unattributed saves on a signed-out non-guest device are discarded once`() {
        assertEquals(SignedOutSaves.DISCARD, savesOnSignedOutLaunch(recordedOwner = "", guestRestored = false))
    }

    @Test fun `a signed-out device that last belonged to an account keeps them for that account`() {
        // Same person signing back in keeps their boards; anyone else wipes them on sign-in.
        assertEquals(SignedOutSaves.KEEP, savesOnSignedOutLaunch(recordedOwner = "user-a", guestRestored = false))
    }

    @Test fun `a guest's saves never reach an account that signs in`() {
        assertTrue(ownerChangeWipesSaves(previousOwner = "guest", newOwner = "user-a"))
    }

    @Test fun `one account's saves never reach a different account`() {
        assertTrue(ownerChangeWipesSaves(previousOwner = "user-a", newOwner = "user-b"))
        // ...nor a guest started after signing out.
        assertTrue(ownerChangeWipesSaves(previousOwner = "user-a", newOwner = "guest"))
    }

    @Test fun `the same owner keeps its saves`() {
        assertFalse(ownerChangeWipesSaves(previousOwner = "user-a", newOwner = "user-a"))
        assertFalse(ownerChangeWipesSaves(previousOwner = "guest", newOwner = "guest"))
        // First claim on a device with no owner recorded: nothing to wipe.
        assertFalse(ownerChangeWipesSaves(previousOwner = "", newOwner = "guest"))
    }
}
