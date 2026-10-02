package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/** FINISH_SPEC AY: the top-left home button always lands on the Home root, single-fire, no tap-through. */
class HomeNavTest {
    @Before fun setUp() = HomeNav.reset()

    @Test fun gameA_nextDaily_gameB_home_landsOnHomeRootWithNoGame() {
        // Game A opened from the Leaderboard tab, then "Next daily" presents game B over it.
        val inGameA = TabNavState(selectedTab = 1, pushedPages = 1, layers = 1)
        val inGameB = inGameA.copy(layers = 1) // the next daily replaces the game layer
        val after = HomeNav.onHomeButton(inGameB)
        assertEquals(TabNav.HOME, after.selectedTab)
        assertEquals(0, after.layers)       // no game presented
        assertEquals(0, after.pushedPages)  // nothing pushed underneath either
        assertEquals(TabNav.root(TabNav.HOME), after)
    }

    @Test fun homeIsSingleFireAndHomeCardsIgnoreTheTouchUp() {
        assertTrue(HomeNav.tryGoHome(10_000))
        assertFalse("a double tap acts once", HomeNav.tryGoHome(10_150))
        assertFalse("the touch-up landing on a Home card is ignored", HomeNav.cardTapAllowed(10_200))
        assertTrue(HomeNav.cardTapAllowed(10_000 + HomeNav.TAP_GUARD_MS))
        assertTrue(HomeNav.tryGoHome(10_000 + HomeNav.TAP_GUARD_MS))
    }

    @Test fun cardsTakeTapsWhenHomeWasNeverPressed() {
        assertTrue(HomeNav.cardTapAllowed(0))
    }
}
