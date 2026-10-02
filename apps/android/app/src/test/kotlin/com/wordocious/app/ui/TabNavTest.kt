package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/** FINISH_SPEC AJ: the footer Home tab always lands on the Home root. */
class TabNavTest {
    @Test
    fun home_from_three_levels_deep_lands_on_the_root_at_the_top() {
        // Stats tab → a public profile + Records pushed → Settings layered on top.
        val deep = TabNavState(selectedTab = 2, pushedPages = 2, layers = 1)
        assertEquals(TabTapOutcome.GoToRoot(TabNav.HOME, scrollToTop = true), TabNav.onTabTap(deep, TabNav.HOME))
        assertEquals(TabNavState(selectedTab = 0), TabNav.root(0))
    }

    @Test
    fun re_tapping_the_current_tab_pops_it_and_scrolls_up() {
        assertEquals(TabTapOutcome.GoToRoot(1, scrollToTop = true), TabNav.onTabTap(TabNavState(1, pushedPages = 1), 1))
        assertEquals(TabTapOutcome.GoToRoot(3, scrollToTop = false), TabNav.onTabTap(TabNavState(1), 3))
    }

    @Test
    fun a_live_vs_match_asks_first() {
        assertEquals(TabTapOutcome.ConfirmLeaveMatch(0), TabNav.onTabTap(TabNavState(0, layers = 1, liveVsMatch = true), 0))
    }
}
