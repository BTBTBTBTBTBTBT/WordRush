package com.wordocious.app.ui

import com.wordocious.app.data.Profile
import com.wordocious.app.ui.OnboardingGate.Decision
import com.wordocious.app.ui.OnboardingGate.Prime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC AO (was W): only players who have never played see the first-run flow. */
class OnboardingGateTest {
    private val fresh = Profile(id = "u1")

    @Test fun primeMarksABrandNewDevicePending() {
        assertEquals(Prime.MARK_PENDING, OnboardingGate.prime(flagged = false, pending = false, firstLaunchEver = true, hasLocalGameData = false))
    }

    @Test fun primeMarksExistingPlayersDoneSilently() {
        // An earlier launch on record = an existing install.
        assertEquals(Prime.MARK_DONE, OnboardingGate.prime(false, false, firstLaunchEver = false, hasLocalGameData = false))
        // Local game data = has played.
        assertEquals(Prime.MARK_DONE, OnboardingGate.prime(false, false, firstLaunchEver = true, hasLocalGameData = true))
    }

    @Test fun primeNeverOverridesAnEarlierVerdict() {
        assertEquals(Prime.NOTHING, OnboardingGate.prime(flagged = true, pending = false, firstLaunchEver = true, hasLocalGameData = false))
        // Still pending on a later launch (killed before the tour) -> stays pending.
        assertEquals(Prime.NOTHING, OnboardingGate.prime(flagged = false, pending = true, firstLaunchEver = false, hasLocalGameData = true))
    }

    @Test fun gateIsTheV2Flag() {
        assertEquals("onboarded-v2", OnboardingGate.FLAG)
        assertEquals("onboard-pending-v2", OnboardingGate.PENDING)
    }

    @Test fun primeTreatsWsDonePlayersAsExisting() {
        // Finished or skipped W's tour (onboarded-v1) = an existing player: never sees AO.
        assertEquals(Prime.MARK_DONE, OnboardingGate.prime(false, false, firstLaunchEver = true, hasLocalGameData = false, legacyDone = true))
        assertEquals(Prime.MARK_DONE, OnboardingGate.prime(false, false, firstLaunchEver = false, hasLocalGameData = false, legacyDone = true))
    }

    @Test fun primeCarriesAPendingWPlayerOver() {
        // Installed the W build, closed it before the tour, never played: still brand new.
        assertEquals(Prime.MARK_PENDING, OnboardingGate.prime(false, false, firstLaunchEver = false, hasLocalGameData = false, legacyPending = true))
        // ...unless they have played since.
        assertEquals(Prime.MARK_DONE, OnboardingGate.prime(false, false, firstLaunchEver = false, hasLocalGameData = true, legacyPending = true))
    }

    @Test fun decideShowsOnlyForPendingNewPlayers() {
        assertEquals(Decision.SHOW, OnboardingGate.decide(false, true, signedIn = false, profile = null, blocked = false))
        assertEquals(Decision.SHOW, OnboardingGate.decide(false, true, signedIn = true, profile = fresh, blocked = false))
        assertEquals(Decision.NONE, OnboardingGate.decide(true, true, signedIn = false, profile = null, blocked = false))
        assertEquals(Decision.NONE, OnboardingGate.decide(false, false, signedIn = false, profile = null, blocked = false))
    }

    @Test fun decideWaitsForTheIntroWelcomeAndProfile() {
        assertEquals(Decision.WAIT, OnboardingGate.decide(false, true, signedIn = false, profile = null, blocked = true))
        assertEquals(Decision.WAIT, OnboardingGate.decide(false, true, signedIn = true, profile = null, blocked = false))
    }

    @Test fun decideSkipsAccountsThatAlreadyPlayed() {
        val played = listOf(
            fresh.copy(totalWins = 1),
            fresh.copy(totalLosses = 2),
            fresh.copy(lastPlayedAt = "2026-09-30T12:00:00Z"),
            fresh.copy(bestStreak = 3),
            fresh.copy(bronzeMedals = 1),
        )
        played.forEach {
            assertTrue(OnboardingGate.hasPlayed(it))
            assertEquals(Decision.MARK_DONE, OnboardingGate.decide(false, true, signedIn = true, profile = it, blocked = true))
        }
        assertFalse(OnboardingGate.hasPlayed(fresh))
        assertFalse(OnboardingGate.hasPlayed(null))
    }
}
