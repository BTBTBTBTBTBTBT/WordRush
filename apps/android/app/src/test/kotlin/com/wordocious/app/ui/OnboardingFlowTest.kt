package com.wordocious.app.ui

import com.wordocious.app.ui.OnboardingEvent.Authenticated
import com.wordocious.app.ui.OnboardingMove.Finish
import com.wordocious.app.ui.OnboardingMove.Go
import com.wordocious.app.ui.OnboardingStep.ALL_SET
import com.wordocious.app.ui.OnboardingStep.MASCOT
import com.wordocious.app.ui.OnboardingStep.PROFILE
import com.wordocious.app.ui.OnboardingStep.SIGN_IN
import com.wordocious.app.ui.OnboardingStep.SIGN_UP
import com.wordocious.app.ui.OnboardingStep.TOUR
import com.wordocious.app.ui.OnboardingStep.USERNAME
import com.wordocious.app.ui.OnboardingStep.WELCOME
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC AO: the first-run welcome + profile setup routing. */
class OnboardingFlowTest {
    private val signedOut = OnboardingContext(signedIn = false, guest = false)
    private val signedIn = OnboardingContext(signedIn = true, guest = false)
    private val guest = OnboardingContext(signedIn = false, guest = true)
    private val replay = OnboardingContext(signedIn = true, guest = false, replay = true)
    private val newAccount = Authenticated(needsUsername = true, hasMascot = false)

    private fun next(s: OnboardingStep, e: OnboardingEvent, c: OnboardingContext = signedOut) = OnboardingFlow.next(s, e, c)

    @Test fun theHappyPathRunsAllFiveSteps() {
        assertEquals(Go(TOUR), next(WELCOME, OnboardingEvent.LetsGo))
        assertEquals(Go(PROFILE), next(TOUR, OnboardingEvent.TourDone))
        assertEquals(Go(SIGN_UP), next(PROFILE, OnboardingEvent.CreateAccount))
        assertEquals(Go(USERNAME), next(SIGN_UP, newAccount))
        assertEquals(Go(MASCOT), next(USERNAME, OnboardingEvent.UsernameSaved, signedIn))
        assertEquals(Go(ALL_SET), next(MASCOT, OnboardingEvent.MascotSaved, signedIn))
        assertEquals(Finish(playClassic = true), next(ALL_SET, OnboardingEvent.Play, signedIn))
        assertEquals(Finish(), next(ALL_SET, OnboardingEvent.Explore, signedIn))
    }

    @Test fun iAlreadyHaveAnAccountGoesStraightHomeAfterSignIn() {
        assertEquals(Go(SIGN_IN), next(WELCOME, OnboardingEvent.HaveAccount))
        assertEquals(Finish(), next(SIGN_IN, Authenticated(needsUsername = false, hasMascot = false), signedIn))
        // A brand-new account made there (Google) still picks its username first.
        assertEquals(Go(USERNAME), next(SIGN_IN, newAccount, signedIn))
        assertEquals(Go(WELCOME), next(SIGN_IN, OnboardingEvent.Back))
    }

    @Test fun guestsSkipTheProfileAndMascot() {
        assertEquals(Go(ALL_SET), next(PROFILE, OnboardingEvent.Guest, guest))
        assertEquals(Go(ALL_SET), next(SIGN_UP, OnboardingEvent.Guest, guest))
        assertEquals(Go(ALL_SET), next(SIGN_IN, OnboardingEvent.Guest, guest))
        assertEquals(ALL_SET, OnboardingFlow.afterTour(guest))
    }

    @Test fun mascotDoItLaterKeepsTheDefaultAndFinishes() {
        assertEquals(Go(ALL_SET), next(MASCOT, OnboardingEvent.MascotLater, signedIn))
    }

    @Test fun skipRules() {
        // The tour's Skip skips the tour only.
        assertEquals(Go(PROFILE), next(TOUR, OnboardingEvent.Skip))
        assertEquals(Go(USERNAME), next(TOUR, OnboardingEvent.Skip, signedIn))
        // Skip on 3–4 ends the setup; no account yet = in as a guest.
        assertEquals(Finish(asGuest = true), next(PROFILE, OnboardingEvent.Skip))
        assertEquals(Finish(asGuest = true), next(SIGN_UP, OnboardingEvent.Skip))
        assertEquals(Finish(asGuest = false), next(PROFILE, OnboardingEvent.Skip, guest))
        assertEquals(Finish(), next(USERNAME, OnboardingEvent.Skip, signedIn))
        assertEquals(Finish(), next(MASCOT, OnboardingEvent.Skip, signedIn))
        // Skip shows on steps 2–4 only.
        assertFalse(WELCOME.hasSkip); assertFalse(SIGN_IN.hasSkip); assertFalse(ALL_SET.hasSkip)
        listOf(TOUR, PROFILE, SIGN_UP, USERNAME, MASCOT).forEach { assertTrue(it.name, it.hasSkip) }
    }

    @Test fun replayIsStepsOneAndTwoOnly() {
        assertEquals(Go(TOUR), next(WELCOME, OnboardingEvent.LetsGo, replay))
        assertEquals(Finish(), next(TOUR, OnboardingEvent.TourDone, replay))
        assertEquals(Finish(), next(TOUR, OnboardingEvent.Skip, replay))
        assertEquals(Finish(), next(WELCOME, OnboardingEvent.HaveAccount, replay))
    }

    @Test fun backWalksBackButNeverUndoesAnAccount() {
        assertEquals(Go(WELCOME), next(TOUR, OnboardingEvent.Back))
        assertEquals(Go(TOUR), next(PROFILE, OnboardingEvent.Back))
        assertEquals(Go(PROFILE), next(SIGN_UP, OnboardingEvent.Back))
        assertEquals(OnboardingMove.Stay, next(USERNAME, OnboardingEvent.Back, signedIn))
        assertEquals(Go(USERNAME), next(MASCOT, OnboardingEvent.Back, signedIn))
        assertEquals(Finish(), next(WELCOME, OnboardingEvent.Back))
    }

    @Test fun afterAuthSkipsWhatTheAccountAlreadyHas() {
        assertEquals(USERNAME, OnboardingFlow.afterAuth(needsUsername = true, hasMascot = true))
        assertEquals(MASCOT, OnboardingFlow.afterAuth(needsUsername = false, hasMascot = false))
        assertEquals(ALL_SET, OnboardingFlow.afterAuth(needsUsername = false, hasMascot = true))
        assertEquals(Go(MASCOT), next(PROFILE, Authenticated(false, false), signedIn))
    }

    @Test fun unrelatedEventsStayPut() {
        assertEquals(OnboardingMove.Stay, next(WELCOME, OnboardingEvent.Play))
        assertEquals(OnboardingMove.Stay, next(TOUR, newAccount))
        assertEquals(OnboardingMove.Stay, next(ALL_SET, newAccount, signedIn))
    }

    @Test fun resumePicksUpWhereTheFirstRunWasLeft() {
        assertEquals(WELCOME, OnboardingFlow.resume(null, false, false))
        assertEquals(WELCOME, OnboardingFlow.resume("nonsense", false, false))
        assertEquals(WELCOME, OnboardingFlow.resume("SIGN_IN", false, false))
        assertEquals(TOUR, OnboardingFlow.resume("TOUR", false, false))
        // Left on sign-up to tap the confirmation email, back signed in: the username next.
        assertEquals(USERNAME, OnboardingFlow.resume("SIGN_UP", signedIn = true, guest = false))
        assertEquals(PROFILE, OnboardingFlow.resume("SIGN_UP", signedIn = false, guest = false))
        assertEquals(MASCOT, OnboardingFlow.resume("MASCOT", signedIn = true, guest = false))
        assertEquals(PROFILE, OnboardingFlow.resume("MASCOT", signedIn = false, guest = false))
        assertEquals(ALL_SET, OnboardingFlow.resume("USERNAME", signedIn = false, guest = true))
        assertEquals(ALL_SET, OnboardingFlow.resume("ALL_SET", false, true))
    }

    @Test fun sectionsDriveTheDots() {
        assertEquals(listOf(0, 0, 1, 2, 2, 2, 3, 4), OnboardingStep.entries.map { it.section })
        assertTrue(OnboardingFlow.watchesAuth(SIGN_UP)); assertTrue(OnboardingFlow.watchesAuth(PROFILE))
        assertFalse(OnboardingFlow.watchesAuth(USERNAME))
    }

    @Test fun usernameRules() {
        assertNull(OnboardingNames.problem("word_fan_9"))
        assertNotNull(OnboardingNames.problem("ab"))
        assertNotNull(OnboardingNames.problem("a".repeat(21)))
        assertNotNull(OnboardingNames.problem("has space"))
        assertNotNull(OnboardingNames.problem("dash-name"))
    }

    @Test fun exactIlikeEscapesWildcards() {
        assertEquals("word\\_fan", OnboardingNames.exactIlike("word_fan"))
        assertEquals("a\\%b", OnboardingNames.exactIlike(" a%b "))
        assertEquals("plain", OnboardingNames.exactIlike("plain"))
    }

    @Test fun suggestionsAreThreeValidDistinctNewNames() {
        listOf("brian", "Brian_T", null, "", "x", "wörd", "averyveryverylongusername").forEach { base ->
            repeat(5) { seed ->
                val ideas = OnboardingNames.suggestions(base, seed)
                assertEquals("$base/$seed $ideas", 3, ideas.size)
                assertEquals(3, ideas.map { it.lowercase() }.toSet().size)
                ideas.forEach {
                    assertNull("$it", OnboardingNames.problem(it))
                    assertFalse(it.equals(base, ignoreCase = true))
                }
            }
        }
        // Deterministic per seed.
        assertEquals(OnboardingNames.suggestions("brian", 42), OnboardingNames.suggestions("brian", 42))
        assertTrue(OnboardingNames.suggestions("brian", 1).first().startsWith("brian"))
    }
}
